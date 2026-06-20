"""Zero-dependency stdlib HTTP server for the Portfolio Intelligence Platform.

Runs on any Python 3.11+ with NO pip installs for CSV ingestion.
(XLSX needs openpyxl, HTML uses a stdlib fallback.) The FastAPI app in
app/main.py is the documented production entrypoint; this server is the
always-runnable equivalent that reuses the exact same engines.

Run:  python backend/server.py   ->  http://localhost:8000
"""
import json
import os
import time
import hmac
import base64
import secrets
import hashlib
import mimetypes
import datetime as dt
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from pathlib import Path

from app import parser, normalize, aggregate, aria, storage, config

# Single-process production: this server serves BOTH the built SPA (dist/) and
# the /api. PN_PORT lets the prod watchdog run it on 8080 (dev default 8077).
PORT = int(os.environ.get("PN_PORT", "8077"))
DIST = config.ROOT / "dist"

# ---------------------------- auth (login/session) -------------------------
AUTH_FILE = config.STORAGE / "auth.json"
SECRET_FILE = config.STORAGE / ".auth_secret"
SESSION_DAYS = 30


def _load_auth():
    try:
        c = json.loads(AUTH_FILE.read_text("utf-8"))
        if c.get("username") and c.get("password"):
            return c
    except Exception:
        pass
    cfg = {"username": "admin", "password": "ProjectNest2026!"}
    try:
        config.STORAGE.mkdir(parents=True, exist_ok=True)
        AUTH_FILE.write_text(json.dumps(cfg, indent=2), "utf-8")
    except Exception:
        pass
    return cfg


def _secret() -> bytes:
    try:
        b = SECRET_FILE.read_bytes()
        if len(b) >= 16:
            return b
    except Exception:
        pass
    s = secrets.token_bytes(32)
    try:
        config.STORAGE.mkdir(parents=True, exist_ok=True)
        SECRET_FILE.write_bytes(s)
    except Exception:
        pass
    return s


SECRET = _secret()


def _make_token(user: str) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps({"u": user, "exp": int(time.time()) + SESSION_DAYS * 86400}).encode()
    ).decode()
    sig = hmac.new(SECRET, payload.encode(), "sha256").hexdigest()[:32]
    return f"{payload}.{sig}"


def _check_token(tok: str):
    try:
        payload, sig = tok.split(".", 1)
        good = hmac.new(SECRET, payload.encode(), "sha256").hexdigest()[:32]
        if not hmac.compare_digest(sig, good):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload.encode()))
        if int(data.get("exp", 0)) < time.time():
            return None
        return data.get("u")
    except Exception:
        return None


def _ingest_path(path: Path, filename: str, mode: str = "replace"):
    raw = path.read_bytes()
    h = hashlib.sha256(raw).hexdigest()[:16]
    # Always re-run normalize so the status audit (RAW → canonical mapping
    # counts) is captured for THIS upload. The cache hit only saves us the parse
    # cost; we re-canonicalize against the raw rows so the audit is faithful.
    normalize.reset_status_audit()
    rows_cache = None
    issues = storage.parse_cache_get(h)
    if issues is None:
        rows = parser.parse_file(path)
        if not rows:
            raise ValueError(
                "This file has no data table — it looks like a Jira login/auth page, "
                "not an export. Export -> 'Excel CSV (all fields)' (or Printable HTML / XLSX)."
            )
        issues = normalize.normalize_rows(rows)
        if not issues:
            cols = ", ".join(list(rows[0].keys())[:12])
            raise ValueError(f"No issue-key column recognised. Detected columns: [{cols}].")
        storage.parse_cache_put(h, issues)
    else:
        # Re-run normalize purely to repopulate the audit from raw values.
        try:
            rows_cache = parser.parse_file(path)
            normalize.normalize_rows(rows_cache)
        except Exception:
            pass

    # merge with the active dataset (combine PMD + PMO), dedup by key (new wins)
    if mode == "merge":
        cur = storage.load_current()
        if cur and cur.get("issues"):
            by_key = {i["key"]: i for i in cur["issues"]}
            for i in issues:
                by_key[i["key"]] = i
            issues = list(by_key.values())

    payload = aggregate.build(issues)
    jira_base = ""
    for i in issues:
        if i.get("url") and "/browse/" in i["url"]:
            jira_base = i["url"].split("/browse/")[0]
            break
    audit = normalize.get_status_audit()
    normalize.stop_status_audit()
    storage.save_status_audit(audit)
    meta = {
        "filename": filename, "stored_as": path.name, "mode": mode,
        "issues": len(issues), "epics": payload["kpis"]["total_epics"],
        "projects": sorted({i["project"] for i in issues}),
        "jira_base": jira_base,
        "uploaded_at": dt.datetime.now().isoformat(timespec="seconds"),
        "status_audit_summary": {
            "mixed_normalized_events": sum(r["count"] for r in audit["mixed_normalized"]),
            "mixed_normalized_distinct": len(audit["mixed_normalized"]),
            "dead_dropped_events": sum(r["count"] for r in audit["dead_dropped"]),
            "dead_dropped_distinct": len(audit["dead_dropped"]),
            "unknown_events": sum(r["count"] for r in audit["unknown"]),
            "unknown_distinct": len(audit["unknown"]),
            "dead_issue_types_events": sum(r["count"] for r in audit.get("dead_issue_types", [])),
            "dead_issue_types_distinct": len(audit.get("dead_issue_types", [])),
        },
    }
    storage.set_current({"issues": issues, "payload": payload}, meta)
    _clear_proj_cache()
    return meta, payload


def _ingest_history(path: Path, filename: str):
    """Enrich the active dataset's issues with REAL status-transition timelines
    from a Jira History export → exact TTM (Discovery/Delivery), lead/flow."""
    # History parse calls canon_status() for every old/new value in the XLSX —
    # reset the audit so this upload's mixed/dead counts are accurate.
    normalize.reset_status_audit()
    timelines = parser.parse_jira_history(path)
    if not timelines:
        raise ValueError("No status transitions found — is this a 'History (Current fields)' export?")
    cur = storage.load_current()
    if not cur or not cur.get("issues"):
        raise ValueError("Upload the PMD/PMO issue export (CSV/HTML) first, then add the History file.")
    issues = cur["issues"]
    enriched = 0
    DONE = {"DONE"}
    for i in issues:
        tl = timelines.get(i["key"])
        if tl:
            i["history"] = tl
            enriched += 1
            # Derive created / resolved dates from the timeline so the date-based
            # ITSM reports (resource calendar, request-type dynamics) light up.
            # The .xls issue export carries no dates; the History export does.
            if not i.get("created") and tl[0].get("entered"):
                i["created"] = tl[0]["entered"]
            if not i.get("resolved"):
                done_seg = next((s for s in reversed(tl) if s.get("status") in DONE), None)
                if done_seg and done_seg.get("entered"):
                    i["resolved"] = done_seg["entered"]
    payload = aggregate.build(issues)
    audit = normalize.get_status_audit()
    normalize.stop_status_audit()
    # Merge with any prior audit (from the corresponding PMD/PMO CSV ingest)
    # so the final saved audit covers BOTH issue + history files of this batch.
    prior = storage.load_status_audit()
    if prior:
        merged_by_raw: dict[str, dict] = {}
        for src in (prior, audit):
            for bucket_name in ("mixed_normalized", "dead_dropped"):
                for row in src.get(bucket_name, []):
                    k = row["raw"]
                    rec = merged_by_raw.setdefault(k, {**row, "_bucket": bucket_name, "count": 0})
                    rec["count"] += row["count"]
            for row in src.get("unknown", []):
                k = row["raw"]
                rec = merged_by_raw.setdefault(k, {"raw": k, "canonical": "", "_bucket": "unknown", "count": 0})
                rec["count"] += row["count"]
        # Dead issue-types are tracked once per ingest of the CSV (history files
        # don't have issue rows), so the prior CSV-pass tally is authoritative.
        dead_types_combined: dict[str, int] = {}
        for src in (prior, audit):
            for row in src.get("dead_issue_types", []):
                dead_types_combined[row["raw"]] = max(dead_types_combined.get(row["raw"], 0), row["count"])
        dead_types = sorted([{"raw": k, "count": v} for k, v in dead_types_combined.items()], key=lambda r: -r["count"])
        mixed = [r for r in merged_by_raw.values() if r["_bucket"] == "mixed_normalized"]
        dead = [r for r in merged_by_raw.values() if r["_bucket"] == "dead_dropped"]
        unknown = [{"raw": r["raw"], "count": r["count"]} for r in merged_by_raw.values() if r["_bucket"] == "unknown"]
        for lst in (mixed, dead): lst.sort(key=lambda r: -r["count"])
        for r in mixed + dead: r.pop("_bucket", None)
        audit = {
            "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
            "total_distinct": len(merged_by_raw),
            "total_events": sum(r["count"] for r in merged_by_raw.values()),
            "mixed_normalized": mixed, "dead_dropped": dead, "unknown": unknown,
            "dead_issue_types": dead_types,
            "by_canonical": prior.get("by_canonical", {}),
        }
    storage.save_status_audit(audit)
    meta = storage.load_current_meta() or {}
    meta = {**meta, "history_enriched": enriched, "history_file": filename,
            "uploaded_at": dt.datetime.now().isoformat(timespec="seconds"),
            "status_audit_summary": {
                "mixed_normalized_events": sum(r["count"] for r in audit["mixed_normalized"]),
                "mixed_normalized_distinct": len(audit["mixed_normalized"]),
                "dead_dropped_events": sum(r["count"] for r in audit["dead_dropped"]),
                "dead_dropped_distinct": len(audit["dead_dropped"]),
                "unknown_events": sum(r["count"] for r in audit["unknown"]),
                "unknown_distinct": len(audit["unknown"]),
                "dead_issue_types_events": sum(r["count"] for r in audit.get("dead_issue_types", [])),
                "dead_issue_types_distinct": len(audit.get("dead_issue_types", [])),
            }}
    storage.set_current({"issues": issues, "payload": payload}, meta)
    _clear_proj_cache()
    return meta, payload, enriched


def _seed_if_empty():
    if storage.load_current() is None:
        sample = config.TEMP / "sample_jira.csv"
        if sample.exists():
            _ingest_path(sample, "sample_jira.csv")
            print("Seeded dashboard with sample dataset.")


def _payload():
    data = storage.load_current()
    return data.get("payload") if data else None


# Per-service-desk payload cache. Service desk = Jira project key (e.g. ITSM, AP).
# Keyed by (project, dataset_size); cleared whenever a new dataset is activated.
_proj_cache: dict = {}


def _clear_proj_cache():
    _proj_cache.clear()


def _projects_list():
    """Distinct service-desk project keys with ticket counts, plus an 'all' row."""
    data = storage.load_current()
    if not data or not data.get("issues"):
        return {"has_data": False, "projects": []}
    issues = data["issues"]
    counts: dict[str, int] = {}
    for i in issues:
        counts[i.get("project") or "?"] = counts.get(i.get("project") or "?", 0) + 1
    projects = [{"key": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]
    return {"has_data": True, "total": len(issues), "projects": projects}


# ---- global time filter (year / quarter / month / week) ---------------------
def _issue_dt(i: dict):
    """The calendar date used for time filtering: resolved first, else created.
    Both come from the History export (the .xls issue export has no dates)."""
    s = i.get("resolved") or i.get("created")
    if not s:
        return None
    try:
        return dt.datetime.fromisoformat(s)
    except Exception:
        return None


def _period_keys(d: dt.datetime) -> dict:
    iso = d.isocalendar()
    return {
        "year": d.strftime("%Y"),
        "quarter": f"{d.year}-Q{(d.month - 1) // 3 + 1}",
        "month": d.strftime("%Y-%m"),
        "week": f"{iso[0]}-W{iso[1]:02d}",
    }


def _available_periods(issues: list[dict]) -> dict:
    """Distinct period keys present in the data, for the filter dropdowns."""
    years, quarters, months, weeks = set(), set(), set(), set()
    dated = 0
    for i in issues:
        d = _issue_dt(i)
        if not d:
            continue
        dated += 1
        k = _period_keys(d)
        years.add(k["year"]); quarters.add(k["quarter"]); months.add(k["month"]); weeks.add(k["week"])
    return {
        "has_dates": dated > 0,
        "dated_issues": dated,
        "years": sorted(years),
        "quarters": sorted(quarters),
        "months": sorted(months),
        "weeks": sorted(weeks),
    }


def _filter_period(issues: list[dict], period: str | None, value: str | None) -> list[dict]:
    if not period or period.lower() == "all" or not value:
        return issues
    out = []
    for i in issues:
        d = _issue_dt(i)
        if not d:
            continue
        if _period_keys(d).get(period) == value:
            out.append(i)
    return out


def _projects_list():
    """Distinct service-desk project keys with ticket counts, plus available periods."""
    data = storage.load_current()
    if not data or not data.get("issues"):
        return {"has_data": False, "projects": []}
    issues = data["issues"]
    counts: dict[str, int] = {}
    for i in issues:
        counts[i.get("project") or "?"] = counts.get(i.get("project") or "?", 0) + 1
    projects = [{"key": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]
    return {"has_data": True, "total": len(issues), "projects": projects,
            "periods": _available_periods(issues)}


def _payload_for(project: str | None, period: str | None = None, value: str | None = None):
    """Build (and cache) the widget payload filtered to one service-desk project
    AND one time period. project/period None/'all' → no filter on that axis."""
    data = storage.load_current()
    if not data or not data.get("issues"):
        return None
    issues = data["issues"]
    no_proj = (not project or project.lower() == "all")
    no_period = (not period or period.lower() == "all" or not value)
    if no_proj and no_period:
        return data.get("payload") or aggregate.build(issues)
    key = (project or "all", period or "all", value or "", len(issues))
    if key in _proj_cache:
        return _proj_cache[key]
    subset = issues if no_proj else [i for i in issues if (i.get("project") or "") == project]
    subset = _filter_period(subset, period, value)
    payload = aggregate.build(subset)
    _proj_cache[key] = payload
    return payload


class Handler(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass

    # ----------------------- auth + static helpers -----------------------
    def _cookie(self, name):
        for part in (self.headers.get("Cookie", "") or "").split(";"):
            if "=" in part:
                k, v = part.strip().split("=", 1)
                if k == name:
                    return v
        return None

    def _user(self):
        tok = self._cookie("pn_session")
        return _check_token(tok) if tok else None

    def _send_login(self, user):
        body = json.dumps({"ok": True, "user": user}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Set-Cookie", f"pn_session={_make_token(user)}; HttpOnly; SameSite=Lax; Path=/; Max-Age={SESSION_DAYS * 86400}")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, route):
        rel = (route or "/").lstrip("/") or "index.html"
        try:
            f = (DIST / rel).resolve()
            if not str(f).startswith(str(DIST.resolve())) or not f.is_file():
                f = DIST / "index.html"
        except Exception:
            f = DIST / "index.html"
        if not f.is_file():
            return self._send({"error": "Frontend not built yet. Run: npm run build"}, 503)
        data = f.read_bytes()
        ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        if "/assets/" in route:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send({}, 204)

    def do_GET(self):
        route = urlparse(self.path).path
        # public endpoints
        if route == "/api/health":
            return self._send({"status": "ok", "has_data": storage.load_current_meta() is not None,
                               "active": storage.load_current_meta()})
        if route == "/api/me":
            u = self._user()
            return self._send({"authed": bool(u), "user": u})
        # everything else under /api requires a valid session
        if route.startswith("/api/") and not self._user():
            return self._send({"error": "auth required"}, 401)
        # non-API GET → serve the built SPA (static + index fallback)
        if not route.startswith("/api/"):
            return self._serve_static(route)
        if route == "/api/projects":
            return self._send(_projects_list())
        if route == "/api/dashboard":
            q = parse_qs(urlparse(self.path).query)
            proj = q.get("project", [None])[0]
            period = q.get("period", [None])[0]
            value = q.get("value", [None])[0]
            p = _payload_for(proj, period, value)
            pl = _projects_list()
            if not p:
                return self._send({"has_data": True, "empty_period": True,
                                   "project": proj or "all", "period": period or "all", "value": value or "",
                                   "projects": pl.get("projects", []), "periods": pl.get("periods", {}),
                                   "widgets": {}, "kpis": {}})
            return self._send({"has_data": True, "meta": storage.load_current_meta(),
                               "project": proj or "all", "period": period or "all", "value": value or "",
                               "projects": pl.get("projects", []), "periods": pl.get("periods", {}),
                               "widgets": p["widgets"], "kpis": p["kpis"]})
        if route == "/api/analytics":
            proj = parse_qs(urlparse(self.path).query).get("project", [None])[0]
            p = _payload_for(proj)
            if not p:
                return self._send({"has_data": False})
            return self._send({"has_data": True, **p["analytics"]})
        if route == "/api/uploads":
            return self._send({"history": storage.upload_history()})
        if route == "/api/pm-leaderboard":
            data = storage.load_current()
            if not data:
                return self._send({"has_data": False, "rows": []})
            from app.metrics import engines as E
            period = parse_qs(urlparse(self.path).query).get("period", ["all"])[0]
            return self._send({"has_data": True, **E.pm_leaderboard_period(data["issues"], period)})
        if route == "/api/notifications":
            data = storage.load_current()
            if not data:
                return self._send({"has_data": False, "epics": [], "tasks": []})
            from app.metrics import engines as E
            return self._send({"has_data": True, **E.recent_closures(data["issues"])})
        if route == "/api/data-quality":
            data = storage.load_current()
            if not data:
                return self._send({"has_data": False, "fields": []})
            from app.metrics import engines as E
            return self._send({"has_data": True, **E.data_quality(data["issues"])})
        if route == "/api/status-audit":
            audit = storage.load_status_audit()
            if not audit:
                return self._send({"has_data": False})
            return self._send({"has_data": True, **audit})
        if route == "/api/issue":
            data = storage.load_current()
            key = parse_qs(urlparse(self.path).query).get("key", [None])[0]
            if not data or not key:
                return self._send({"found": False}, 404)
            issue = next((i for i in data["issues"] if i["key"] == key), None)
            if not issue:
                return self._send({"found": False}, 404)
            from app.metrics import engines as E
            dur = None
            if issue.get("created") and issue.get("resolved"):
                dur = max(0, (E._d(issue["resolved"]) - E._d(issue["created"])).days)
            children = [c["key"] for c in data["issues"] if c.get("epic_key") == key]
            is_open = not E.is_done(issue) and not E.is_declined(issue)
            # AI summary is fetched separately (/api/issue-summary) so the detail
            # popup opens instantly instead of blocking on the LLM call.
            return self._send({"found": True, "issue": issue, "duration_days": dur,
                               "children": children, "is_open": is_open})
        if route == "/api/issue-summary":
            data = storage.load_current()
            key = parse_qs(urlparse(self.path).query).get("key", [None])[0]
            if not data or not key:
                return self._send({"found": False}, 404)
            issue = next((i for i in data["issues"] if i["key"] == key), None)
            if not issue:
                return self._send({"found": False}, 404)
            return self._send({"found": True, **aria.summarize_issue(issue)})
        if route == "/api/issue-recommend":
            data = storage.load_current()
            key = parse_qs(urlparse(self.path).query).get("key", [None])[0]
            if not data or not key:
                return self._send({"found": False}, 404)
            issue = next((i for i in data["issues"] if i["key"] == key), None)
            if not issue:
                return self._send({"found": False}, 404)
            return self._send({"found": True, **aria.recommend_issue(issue)})
        if route == "/api/ttm":
            data = storage.load_current()
            if not data:
                return self._send({"has_data": False})
            from app.metrics import engines as E
            q = parse_qs(urlparse(self.path).query)
            g = lambda k: (q.get(k, [None])[0])
            return self._send({"has_data": True, **E.ttm_analysis(
                data["issues"], type_filter=g("type") or "all",
                period=g("period") or "all", value=g("value"),
                granularity=g("granularity") or "year", since=g("since"))})
        if route == "/api/flow":
            data = storage.load_current()
            if not data:
                return self._send({"series": [], "summary": {}})
            from app.metrics import engines as E
            g = parse_qs(urlparse(self.path).query).get("granularity", ["month"])[0]
            return self._send(E.flow_balance(data["issues"], granularity=g))
        if route == "/api/epic-quality":
            data = storage.load_current()
            if not data:
                return self._send({"count": 0, "flagged": []})
            from app.metrics import engines as E
            q = parse_qs(urlparse(self.path).query)
            proj = q.get("project", ["PMD"])[0]
            try:
                days = int(q.get("days", ["90"])[0])
            except ValueError:
                days = 90
            return self._send(E.epic_quality(data["issues"], project=proj, window_days=days))
        if route == "/api/epic-quality-recommend":
            data = storage.load_current()
            key = parse_qs(urlparse(self.path).query).get("key", [None])[0]
            lang = parse_qs(urlparse(self.path).query).get("lang", ["ru"])[0]
            if not data or not key:
                return self._send({"found": False}, 404)
            epic = next((i for i in data["issues"] if i["key"] == key), None)
            if not epic:
                return self._send({"found": False}, 404)
            from app.metrics import engines as E
            probs = E.epic_problems(epic)
            return self._send({"found": True, **aria.recommend_epic_quality(epic, probs, lang)})
        if route == "/api/risk":
            data = storage.load_current()
            if not data:
                return self._send({"rollup": {}, "health_buckets": {}, "register": [],
                                   "heatmap": [], "blocked": {}, "aging": [], "insights": []})
            from app.metrics import engines as E
            return self._send(E.risk_insights(data["issues"]))
        if route == "/api/calendar":
            data = storage.load_current()
            if not data:
                return self._send({"count": 0, "events": [], "types": []})
            from app.metrics import engines as E
            q = parse_qs(urlparse(self.path).query)
            g = lambda k: (q.get(k, [None])[0])
            return self._send(E.calendar_events(
                data["issues"], mode=g("mode") or "resolved",
                start=g("from"), end=g("to"), itype=g("type"), pm=g("pm")))
        if route == "/api/issues":
            data = storage.load_current()
            if not data:
                return self._send({"count": 0, "issues": []})
            from app.metrics import engines as E
            q = parse_qs(urlparse(self.path).query)
            g = lambda k: (q.get(k, [None])[0])
            return self._send(E.filter_issues(
                data["issues"], scope=g("scope") or "all", state=g("state") or "all",
                pm=g("pm"), project=g("project"), status=g("status"),
                period=g("period"), value=g("value"), itype=g("type")))
        return self._send({"error": "not found"}, 404)

    def do_POST(self):
        route = urlparse(self.path).path
        qs = parse_qs(urlparse(self.path).query)
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        # ---- auth: login / logout (public), everything else needs a session ----
        if route == "/api/login":
            try:
                b = json.loads(body or b"{}")
            except Exception:
                b = {}
            cfg = _load_auth()
            if str(b.get("username", "")).strip() == cfg["username"] and str(b.get("password", "")) == cfg["password"]:
                return self._send_login(cfg["username"])
            return self._send({"ok": False, "error": "Invalid username or password"}, 401)
        if route == "/api/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", "pn_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
            self.send_header("Content-Length", "11")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return
        if not self._user():
            return self._send({"error": "auth required"}, 401)

        if route == "/api/upload":
            filename = qs.get("filename", ["upload.csv"])[0]
            mode = qs.get("mode", ["replace"])[0]
            saved = storage.save_upload(filename, body)
            try:
                # A History export enriches existing issues with the real changelog
                # (exact TTM); a normal issue export replaces/merges the dataset.
                if parser.is_history_file(saved):
                    meta, payload, enriched = _ingest_history(saved, filename)
                    return self._send({"ok": True, "kind": "history", "enriched": enriched,
                                       "meta": meta, "kpis": payload["kpis"]})
                meta, payload = _ingest_path(saved, filename, mode)
            except Exception as e:
                return self._send({"ok": False, "error": str(e)}, 422)
            return self._send({"ok": True, "meta": meta, "kpis": payload["kpis"]})

        if route == "/api/aria":
            try:
                _b = json.loads(body or b"{}")
                q = _b.get("question", "")
                lang = _b.get("lang", "en")
                scope = _b.get("scope")
                context = _b.get("context")
            except Exception:
                q, lang, scope, context = "", "en", None, None
            p = _payload()
            if not p:
                return self._send({"answer": "No portfolio dataset uploaded yet.", "source": "system"})
            return self._send(aria.ask(q, p, lang, scope=scope, context=context))

        if route == "/api/analyze":
            try:
                text = json.loads(body or b"{}").get("text", "")
            except Exception:
                text = ""
            data = storage.load_current()
            if not data or not text.strip():
                return self._send({"recommendation": "", "similar": [], "source": "system"})
            return self._send(aria.recommend_from_description(text, data["issues"]))

        return self._send({"error": "not found"}, 404)


if __name__ == "__main__":
    _seed_if_empty()
    print(f"Portfolio Intelligence API -> http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
