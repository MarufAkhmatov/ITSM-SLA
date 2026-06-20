"""ITSM Service Desk metrics — resource utilization, request-type usage, and
time-based dynamics. Pure functions over the normalized issue list.

Date-based outputs (resource_calendar, request_type_dynamics) rely on each
issue's `resolved` / `created` date. The Jira Issue-Navigator .xls export has no
date columns, so those populate only after a History export (which carries
Создано + status transitions) is uploaded and enriches the issues.
"""
import collections
import difflib
import re
import datetime as dt


_DONE = {"DONE"}


def _is_done(i: dict) -> bool:
    return i.get("status") in _DONE or i.get("status_group") == "done"


def _status_bucket(i: dict) -> str:
    if _is_done(i):
        return "done"
    if i.get("status") in ("IN PROGRESS", "TESTING", "ANALYSIS", "NEED INFO"):
        return "in_progress"
    return "todo"


def _itsm_issues(issues: list[dict]) -> list[dict]:
    return [i for i in issues if i.get("customer_request_type")]


# ---- Resource (assignee) utilization ----------------------------------------
def resource_utilization(issues: list[dict]) -> dict:
    """Per IT staff member (assignee): total tickets, status split, and the
    request types they handle. Also the inverse: per request type, the staff
    count + names. Everything keyed so the FE can make each cell clickable."""
    items = _itsm_issues(issues)
    by_assignee: dict[str, dict] = {}
    by_request_type: dict[str, dict] = {}

    for i in items:
        a = i.get("assignee") or "Unassigned"
        crt = i["customer_request_type"]
        bucket = _status_bucket(i)

        ra = by_assignee.setdefault(a, {
            "name": a, "total": 0, "done": 0, "in_progress": 0, "todo": 0,
            "request_types": collections.Counter(),
            "react_met": 0, "react_breach": 0, "resol_met": 0, "resol_breach": 0,
        })
        ra["total"] += 1
        ra[bucket] += 1
        ra["request_types"][crt] += 1
        if i.get("sla_reaction_met") is True: ra["react_met"] += 1
        elif i.get("sla_reaction_met") is False: ra["react_breach"] += 1
        if i.get("sla_resolution_met") is True: ra["resol_met"] += 1
        elif i.get("sla_resolution_met") is False: ra["resol_breach"] += 1

        rt = by_request_type.setdefault(crt, {
            "name": crt, "total": 0, "assignees": collections.Counter(),
        })
        rt["total"] += 1
        rt["assignees"][a] += 1

    def pct(m, b):
        n = m + b
        return round(100.0 * m / n, 1) if n else None

    staff = []
    for r in by_assignee.values():
        staff.append({
            "name": r["name"], "total": r["total"],
            "done": r["done"], "in_progress": r["in_progress"], "todo": r["todo"],
            "request_type_count": len(r["request_types"]),
            "top_request_types": [{"name": k, "count": v} for k, v in r["request_types"].most_common(8)],
            "reaction_pass_rate_pct": pct(r["react_met"], r["react_breach"]),
            "resolution_pass_rate_pct": pct(r["resol_met"], r["resol_breach"]),
        })
    staff.sort(key=lambda x: -x["total"])

    per_type = []
    for r in by_request_type.values():
        per_type.append({
            "name": r["name"], "total": r["total"],
            "assignee_count": len(r["assignees"]),
            "assignees": [{"name": k, "count": v} for k, v in r["assignees"].most_common()],
        })
    per_type.sort(key=lambda x: -x["total"])

    return {
        "staff": staff,
        "per_request_type": per_type,
        "total_staff": len(by_assignee),
        "total_request_types": len(by_request_type),
    }


# ---- Request-type usage ranking ---------------------------------------------
def request_type_usage(issues: list[dict]) -> dict:
    """Rank Customer Request Types by volume — most-used and least-used — with
    status split, assignee count, and SLA pass-rates."""
    items = _itsm_issues(issues)
    buckets: dict[str, dict] = {}
    for i in items:
        crt = i["customer_request_type"]
        b = buckets.setdefault(crt, {
            "name": crt, "count": 0, "done": 0, "in_progress": 0, "todo": 0,
            "assignees": set(), "react_met": 0, "react_breach": 0,
            "resol_met": 0, "resol_breach": 0,
        })
        b["count"] += 1
        b[_status_bucket(i)] += 1
        if i.get("assignee"):
            b["assignees"].add(i["assignee"])
        if i.get("sla_reaction_met") is True: b["react_met"] += 1
        elif i.get("sla_reaction_met") is False: b["react_breach"] += 1
        if i.get("sla_resolution_met") is True: b["resol_met"] += 1
        elif i.get("sla_resolution_met") is False: b["resol_breach"] += 1

    def pct(m, bb):
        n = m + bb
        return round(100.0 * m / n, 1) if n else None

    rows = []
    for b in buckets.values():
        rows.append({
            "name": b["name"], "count": b["count"],
            "done": b["done"], "in_progress": b["in_progress"], "todo": b["todo"],
            "assignee_count": len(b["assignees"]),
            "reaction_pass_rate_pct": pct(b["react_met"], b["react_breach"]),
            "resolution_pass_rate_pct": pct(b["resol_met"], b["resol_breach"]),
        })
    rows.sort(key=lambda x: -x["count"])
    total = sum(r["count"] for r in rows) or 1
    for r in rows:
        r["share_pct"] = round(100.0 * r["count"] / total, 1)

    return {
        "all": rows,
        "most_used": rows[:10],
        "least_used": list(reversed(rows[-10:])) if len(rows) > 10 else [],
        "total_types": len(rows),
        "total_tickets": sum(r["count"] for r in rows),
    }


# ---- Date-based: per-assignee closed-ticket calendar ------------------------
def _period_keys(d: dt.datetime):
    iso = d.isocalendar()
    return {
        "day": d.strftime("%Y-%m-%d"),
        "week": f"{iso[0]}-W{iso[1]:02d}",
        "month": d.strftime("%Y-%m"),
        "year": d.strftime("%Y"),
    }


def resource_calendar(issues: list[dict]) -> dict:
    """Per assignee, closed-ticket counts bucketed by day / week / month / year
    (from the resolved date). Empty until a History export supplies dates."""
    items = _itsm_issues(issues)
    cal: dict[str, dict] = {}
    has_dates = False
    for i in items:
        if not _is_done(i):
            continue
        rd = i.get("resolved")
        if not rd:
            continue
        try:
            d = dt.datetime.fromisoformat(rd)
        except Exception:
            continue
        has_dates = True
        a = i.get("assignee") or "Unassigned"
        keys = _period_keys(d)
        entry = cal.setdefault(a, {"day": collections.Counter(), "week": collections.Counter(),
                                   "month": collections.Counter(), "year": collections.Counter()})
        for gran, k in keys.items():
            entry[gran][k] += 1

    out = {}
    for a, e in cal.items():
        out[a] = {g: dict(c) for g, c in e.items()}
    return {"has_dates": has_dates, "by_assignee": out}


# ---- Date-based: request-type intake dynamics over time ---------------------
def request_type_dynamics(issues: list[dict]) -> dict:
    """Per Customer Request Type, ticket-intake counts per period (by created
    date) for day/week/month/year, plus a trend arrow (last period vs previous).
    Empty until a History export supplies dates."""
    items = _itsm_issues(issues)
    has_dates = False
    grans = ("day", "week", "month", "year")
    by_type: dict[str, dict] = {}
    for i in items:
        cd = i.get("created") or i.get("resolved")
        if not cd:
            continue
        try:
            d = dt.datetime.fromisoformat(cd)
        except Exception:
            continue
        has_dates = True
        crt = i["customer_request_type"]
        keys = _period_keys(d)
        t = by_type.setdefault(crt, {g: collections.Counter() for g in grans})
        for g in grans:
            t[g][keys[g]] += 1

    def trend(counter: collections.Counter):
        if len(counter) < 1:
            return {"latest": 0, "prev": 0, "delta": 0, "dir": "flat"}
        ks = sorted(counter.keys())
        latest = counter[ks[-1]]
        prev = counter[ks[-2]] if len(ks) > 1 else 0
        delta = latest - prev
        return {"latest": latest, "prev": prev, "delta": delta,
                "dir": "up" if delta > 0 else ("down" if delta < 0 else "flat"),
                "period": ks[-1]}

    out = []
    for crt, t in by_type.items():
        out.append({
            "name": crt,
            "total": sum(t["month"].values()),
            "series": {g: dict(t[g]) for g in grans},
            "trend": {g: trend(t[g]) for g in grans},
        })
    out.sort(key=lambda x: -x["total"])
    return {"has_dates": has_dates, "request_types": out}


# ---- Smart fuzzy search -----------------------------------------------------
_WORD_RE = re.compile(r"[^\wЀ-ӿ]+", re.UNICODE)


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _tokens(s: str) -> list[str]:
    return [w for w in _WORD_RE.split(_norm(s)) if w]


def _fuzzy_score(query: str, text: str) -> float:
    """Typo-tolerant relevance score in [0, 1] between a query and a candidate.
    Combines exact/substring hits, token overlap, and difflib ratios so a
    slightly-misspelled query still matches the nearest item."""
    q, txt = _norm(query), _norm(text)
    if not q or not txt:
        return 0.0
    if q == txt:
        return 1.0
    if q in txt:
        # substring: longer match relative to the field = stronger
        return 0.9 + 0.1 * (len(q) / len(txt))
    qt, tt = _tokens(q), _tokens(txt)
    qset, tset = set(qt), set(tt)
    overlap = len(qset & tset) / max(1, len(qset))
    # whole-string ratio (catches transpositions/typos across the phrase)
    ratio = difflib.SequenceMatcher(None, q, txt).ratio()
    # best single-token ratio (query vs each word) — handles one-word queries
    best_tok = max((difflib.SequenceMatcher(None, q, w).ratio() for w in tt), default=0.0)
    # any token of the query strongly inside any token of the text
    sub_tok = 0.0
    for w in qt:
        if any(w in tw or tw in w for tw in tt):
            sub_tok = max(sub_tok, 0.8)
    return max(ratio, best_tok * 0.95, overlap * 0.85, sub_tok)


def search(issues: list[dict], query: str, limit: int = 8) -> dict:
    """Fuzzy search across IT services (request types), staff (assignees) and
    issues (key + summary). Returns ranked groups. Tolerant of typos."""
    items = _itsm_issues(issues)
    q = _norm(query)
    if not q:
        return {"query": query, "request_types": [], "staff": [], "issues": []}

    # aggregate distinct request types + staff with counts
    crt_counts: collections.Counter = collections.Counter()
    staff_counts: collections.Counter = collections.Counter()
    for i in items:
        crt_counts[i["customer_request_type"]] += 1
        if i.get("assignee"):
            staff_counts[i["assignee"]] += 1

    THRESH = 0.42

    rt_scored = []
    for name, cnt in crt_counts.items():
        sc = _fuzzy_score(q, name)
        if sc >= THRESH:
            rt_scored.append({"name": name, "count": cnt, "score": round(sc, 3)})
    rt_scored.sort(key=lambda x: (-x["score"], -x["count"]))

    staff_scored = []
    for name, cnt in staff_counts.items():
        sc = _fuzzy_score(q, name)
        if sc >= THRESH:
            staff_scored.append({"name": name, "count": cnt, "score": round(sc, 3)})
    staff_scored.sort(key=lambda x: (-x["score"], -x["count"]))

    issue_scored = []
    for i in items:
        key = i.get("key", "")
        summ = i.get("summary", "")
        sc = max(_fuzzy_score(q, key), _fuzzy_score(q, summ),
                 _fuzzy_score(q, f"{key} {summ}"))
        if sc >= THRESH:
            issue_scored.append({
                "key": key, "summary": summ,
                "customer_request_type": i.get("customer_request_type"),
                "assignee": i.get("assignee"), "status": i.get("status"),
                "project": i.get("project"), "score": round(sc, 3),
            })
    issue_scored.sort(key=lambda x: -x["score"])

    return {
        "query": query,
        "request_types": rt_scored[:limit],
        "staff": staff_scored[:limit],
        "issues": issue_scored[:limit],
        "counts": {
            "request_types": len(rt_scored),
            "staff": len(staff_scored),
            "issues": len(issue_scored),
        },
    }
