"""All portfolio calculation engines. Pure functions over normalized issues."""
import datetime as dt
from .. import config

# ----------------------------- helpers --------------------------------------
def _d(iso):
    return dt.datetime.fromisoformat(iso) if iso else None


def is_done(i):
    return i["status"] in config.DONE_STATUSES or bool(i.get("resolved"))


def is_declined(i):
    return i["status"] in config.DECLINED_STATUSES


def epics(issues):
    return [i for i in issues if i["is_epic"]]


def works(issues):
    return [i for i in issues if not i["is_epic"]]


def percentile(values, p):
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * (p / 100.0)
    f, c = int(k), min(int(k) + 1, len(s) - 1)
    return round(s[f] + (s[c] - s[f]) * (k - f), 2)


def stats(values):
    values = [v for v in values if v is not None]
    if not values:
        return {"avg": 0, "median": 0, "p75": 0, "p90": 0, "min": 0, "max": 0, "count": 0}
    s = sorted(values)
    return {
        "avg": round(sum(s) / len(s), 2),
        "median": percentile(s, 50),
        "p75": percentile(s, 75),
        "p90": percentile(s, 90),
        "min": round(s[0], 2),
        "max": round(s[-1], 2),
        "count": len(s),
    }


def pct(part, total):
    return round(100.0 * part / total, 1) if total else 0.0


# --------------------------- per-issue TTM ----------------------------------
_ACTIVE_DELIVERY = {"IN PROGRESS", "TESTING", "PILOT IO"}  # "work started" statuses


def _first_delivery_entry(i):
    """When the issue first entered active delivery (development started)."""
    for h in i["history"]:
        if h["status"] in _ACTIVE_DELIVERY:
            d = _d(h["entered"])
            if d:
                return d
    return None


def issue_ttm(i):
    """Discovery vs Delivery as calendar PHASES that partition Created->Done, so
    they nest cleanly: Total = Discovery + Delivery, and Lead Time (IN PROGRESS ->
    TESTING exit) sits INSIDE the Delivery phase (Lead <= Delivery)."""
    created = _d(i.get("created"))
    end = _d(i.get("resolved"))
    if not created or not end or end < created:
        return {"discovery": 0.0, "delivery": 0.0, "total": 0.0}
    total = (end - created).total_seconds() / 86400.0
    fd = _first_delivery_entry(i)
    if fd and created <= fd <= end:
        disc = (fd - created).total_seconds() / 86400.0
        deliv = (end - fd).total_seconds() / 86400.0
    else:
        disc, deliv = total, 0.0   # never entered delivery -> all of it was discovery
    return {"discovery": round(disc, 2), "delivery": round(deliv, 2), "total": round(total, 2)}


def issue_lead_time(i):
    """First entry into IN PROGRESS -> exit from TESTING."""
    start = end = None
    for h in i["history"]:
        if h["status"] == "IN PROGRESS" and start is None:
            start = _d(h["entered"])
        if h["status"] == "TESTING":
            end = _d(h["exited"])
    if start and end and end > start:
        return round((end - start).total_seconds() / 86400.0, 2)
    return None


def issue_flow(i):
    active = sum(h["days"] for h in i["history"]
                 if h["status"] in {"IN PROGRESS", "TESTING", "ANALYSIS", "ARCHITECTURE REVIEW"})
    total = sum(h["days"] for h in i["history"]) or 1.0
    return round(100.0 * active / total, 1)


def _ttm_total_days(i):
    """EXACT total TTM = Created -> Resolved (real Resolution Date)."""
    c, r = _d(i.get("created")), _d(i.get("resolved"))
    if c and r and r >= c:
        return (r - c).days
    return None


def _period_keys(i):
    r = _d(i["resolved"])
    y = r.year
    return str(y), f"{y}-Q{(r.month - 1) // 3 + 1}", f"{y}-{r.month:02d}"


def ttm_analysis(issues, type_filter="all", period="all", value=None, granularity="year", since=None):
    """Flexible TTM analytics: filter by issue type and by resolution period
    (year / quarter / month). Total TTM is exact (Created->Resolved); the
    Discovery/Delivery split is approximate until a changelog is available."""
    # Only COMPLETED issues (status is Done) with both dates. Open issues that
    # happen to carry a stray resolution date are excluded — they'd corrupt TTM.
    pool = [i for i in issues if i.get("created") and i.get("resolved")
            and i["status"] in config.DONE_STATUSES]

    # "Start" scope: only count issues resolved on/after a cutoff (e.g. 2026-01-01),
    # since earlier Jira data was managed inconsistently and is unreliable.
    if since:
        sd = _d(since)
        if sd:
            pool = [i for i in pool if _d(i["resolved"]) and _d(i["resolved"]) >= sd]

    years = sorted({_period_keys(i)[0] for i in pool})
    quarters = sorted({_period_keys(i)[1] for i in pool})
    months = sorted({_period_keys(i)[2] for i in pool})
    types = sorted({i["type"] for i in pool})

    def in_period(i):
        if not value or period == "all":
            return True
        y, q, m = _period_keys(i)
        return {"year": y, "quarter": q, "month": m}.get(period) == value

    def of_type(i, tf):
        return tf == "all" or not tf or i["type"].lower() == tf.lower()

    def block(items):
        totals = [t for t in (_ttm_total_days(i) for i in items) if t is not None]
        # Lead time over the SAME denominator as delivery (0 when there is no
        # IN PROGRESS->TESTING span) so the averages nest: Lead <= Delivery <= Total.
        leads = [issue_lead_time(i) or 0.0 for i in items]
        return {
            "count": len(items),
            "total": stats(totals),
            "discovery_approx": stats([issue_ttm(i)["discovery"] for i in items]),
            "delivery_approx": stats([issue_ttm(i)["delivery"] for i in items]),
            "lead_time": stats(leads),
        }

    sel = [i for i in pool if of_type(i, type_filter) and in_period(i)]

    # breakdown by type, within the active period (ignores the type filter)
    period_pool = [i for i in pool if in_period(i)]
    bt = {}
    for i in period_pool:
        bt.setdefault(i["type"], []).append(i)
    by_type = [{"type": k, **block(v)} for k, v in
               sorted(bt.items(), key=lambda kv: -len(kv[1]))]

    # yearly trend of exact total TTM for the selected type
    tpool = [i for i in pool if of_type(i, type_filter)]
    by_year = {}
    for i in tpool:
        t = _ttm_total_days(i)
        if t is not None:
            by_year.setdefault(_period_keys(i)[0], []).append(t)
    trend = [{"period": y, "avg": stats(by_year[y])["avg"], "count": len(by_year[y])}
             for y in sorted(by_year)]

    # Period comparison series (Year / Quarter / Month) for the selected type —
    # each period with avg discovery/delivery/total/lead, for trend & YoY charts.
    gi = {"year": 0, "quarter": 1, "month": 2}.get(granularity, 0)
    type_pool = [i for i in pool if of_type(i, type_filter)]
    buckets = {}
    for i in type_pool:
        buckets.setdefault(_period_keys(i)[gi], []).append(i)

    def period_block(items):
        b = block(items)
        return {"count": b["count"], "total": b["total"]["avg"],
                "discovery": b["discovery_approx"]["avg"], "delivery": b["delivery_approx"]["avg"],
                "lead": b["lead_time"]["avg"]}

    # Exclude the CURRENT, still-running period (month/quarter) — its average is
    # based on a partial month and would distort the comparison.
    now = dt.datetime.now()
    cur_key = {0: str(now.year), 1: f"{now.year}-Q{(now.month - 1) // 3 + 1}",
               2: f"{now.year}-{now.month:02d}"}[gi]
    drop_current = granularity in ("month", "quarter")
    series = [{"period": k, **period_block(v)} for k, v in sorted(buckets.items())
              if not (drop_current and k == cur_key)]

    has_changelog = any(len(i.get("history") or []) > 2 for i in issues)
    return {
        "filters": {"years": years, "quarters": quarters, "months": months, "types": types},
        "applied": {"type": type_filter or "all", "period": period or "all",
                    "value": value or "", "granularity": granularity},
        "summary": block(sel),
        "by_type": by_type,
        "trend": trend,
        "series": series,
        "has_changelog": has_changelog,
    }


# ----------------------------- KPIs -----------------------------------------
def portfolio_kpis(issues):
    eps = epics(issues)
    total = len(eps)
    completed = sum(1 for e in eps if is_done(e))
    declined = sum(1 for e in eps if is_declined(e))
    open_ = total - completed - declined

    def by_status(st):
        return sum(1 for e in eps if e["status"] == st)

    return {
        "total_portfolio_projects": total,
        "total_epics": total,
        "total_work_items": len(works(issues)),
        "completed_projects": completed,
        "declined_projects": declined,
        "open_projects": open_,
        "completion_pct": pct(completed, total),
        "declined_pct": pct(declined, total),
        "active_pct": pct(open_, total),
        "in_progress": by_status("IN PROGRESS"),
        "in_testing": by_status("TESTING"),
        "in_pilot": by_status("PILOT IO"),
        "waiting_validation": by_status("VALIDATION"),
        "waiting_analysis": by_status("ANALYSIS"),
        "waiting_architecture_review": by_status("ARCHITECTURE REVIEW"),
        "waiting_initiation": by_status("INITIATION"),
    }


# ----------------------- epic status breakdown (Project Flow) ---------------
# label, member statuses, donut colour, completion state
_FLOW_ORDER = [
    ("Validation", ["VALIDATION"], "#7c8a9a", "open"),
    ("Backlog", ["BACKLOG"], "#94a1b2", "open"),
    ("Need Info", ["NEED INFO"], "#aab4c0", "open"),
    ("Analysis", ["ANALYSIS", "INITIATION"], "#3b82c4", "open"),
    ("Architecture Review", ["ARCHITECTURE REVIEW"], "#5a8fc4", "open"),
    ("In Progress", ["IN PROGRESS"], "#4EB6A6", "open"),
    ("Testing", ["TESTING"], "#d4a84b", "open"),
    ("Pilot IO", ["PILOT IO"], "#9b59b6", "open"),
    ("Done", list(config.DONE_STATUSES), "#2e9e5f", "completed"),
    ("Declined", list(config.DECLINED_STATUSES), "#e0574f", "declined"),
]


def epic_status_flow(issues):
    """Detailed status breakdown of portfolio epics for the Project Flow donut —
    every open stage (Validation, Backlog, Need Info, Analysis, In Progress,
    Testing, Pilot IO …) plus Done and Declined, with drill-down statuses."""
    eps = epics(issues)
    used = set()
    out = []
    for label, statuses, color, state in _FLOW_ORDER:
        sset = set(statuses)
        used |= sset
        cnt = sum(1 for e in eps if e["status"] in sset)
        out.append({"label": label, "statuses": statuses, "count": cnt,
                    "color": color, "state": state})
    # any unmapped statuses -> their own buckets
    from collections import Counter as _C
    leftover = _C(e["status"] for e in eps if e["status"] not in used)
    for st, c in leftover.most_common():
        out.append({"label": st.title(), "statuses": [st], "count": c,
                    "color": "#b8c0cc", "state": "open"})
    return [b for b in out if b["count"] > 0]


# --------------------------- yearly analytics -------------------------------
def yearly_analytics(issues):
    eps = epics(issues)
    yearly, quarterly, monthly = {}, {}, {}
    for e in eps:
        if not is_done(e) or not e.get("resolved"):
            continue
        r = _d(e["resolved"])  # Resolution Date only
        y = r.year
        q = f"{y}-Q{(r.month - 1) // 3 + 1}"
        m = f"{y}-{r.month:02d}"
        yearly[y] = yearly.get(y, 0) + 1
        quarterly[q] = quarterly.get(q, 0) + 1
        monthly[m] = monthly.get(m, 0) + 1

    years = sorted(yearly)
    yoy = {}
    for i, y in enumerate(years):
        if i > 0 and yearly[years[i - 1]]:
            yoy[y] = pct(yearly[y] - yearly[years[i - 1]], yearly[years[i - 1]])
    quarters = sorted(quarterly)
    qoq = {}
    for i, q in enumerate(quarters):
        if i > 0 and quarterly[quarters[i - 1]]:
            qoq[q] = pct(quarterly[q] - quarterly[quarters[i - 1]], quarterly[quarters[i - 1]])

    return {
        "yearly": [{"period": str(y), "completed": yearly[y]} for y in years],
        "quarterly": [{"period": q, "completed": quarterly[q]} for q in quarters],
        "monthly": [{"period": m, "completed": monthly[m]} for m in sorted(monthly)],
        "yoy_growth": [{"period": str(y), "growth_pct": g} for y, g in yoy.items()],
        "qoq_growth": [{"period": q, "growth_pct": g} for q, g in qoq.items()],
        "throughput": sum(yearly.values()),
    }


def completion_series(issues):
    """Completed-epics throughput at multiple granularities (best-practice
    delivery-throughput view). Feeds the Portfolio Progress tabs."""
    eps = [e for e in epics(issues) if is_done(e) and e.get("resolved")]
    daily, weekly, monthly, yearly = {}, {}, {}, {}
    for e in eps:
        r = _d(e["resolved"])
        iso = r.isocalendar()
        daily[r.strftime("%Y-%m-%d")] = daily.get(r.strftime("%Y-%m-%d"), 0) + 1
        wk = f"{iso[0]}-W{iso[1]:02d}"
        weekly[wk] = weekly.get(wk, 0) + 1
        mk = f"{r.year}-{r.month:02d}"
        monthly[mk] = monthly.get(mk, 0) + 1
        yearly[str(r.year)] = yearly.get(str(r.year), 0) + 1

    def ser(dct, n, lab):
        keys = sorted(dct)[-n:]
        return [{"period": k, "label": lab(k), "completed": dct[k]} for k in keys]

    return {
        "daily": ser(daily, 14, lambda k: k[-2:]),
        "weekly": ser(weekly, 8, lambda k: "W" + k.split("W")[-1]),
        "monthly": ser(monthly, 7, lambda k: k[-2:]),
        "yearly": ser(yearly, 6, lambda k: k),
    }


# ------------------------------ TTM engine ----------------------------------
def ttm_engine(issues):
    def block(items):
        disc = stats([issue_ttm(i)["discovery"] for i in items])
        deliv = stats([issue_ttm(i)["delivery"] for i in items])
        total = stats([issue_ttm(i)["total"] for i in items])
        return {"discovery": disc, "delivery": deliv, "total": total}

    eps = epics(issues)
    tasks = [i for i in issues if i["type"].lower() == "task"]
    feats = [i for i in issues if i["type"].lower() == "new feature"]

    # trend by resolution year (total TTM)
    by_year = {}
    for i in eps:
        if i.get("resolved"):
            y = _d(i["resolved"]).year
            by_year.setdefault(y, []).append(issue_ttm(i)["total"])
    trend = [{"period": str(y), "avg_ttm": stats(by_year[y])["avg"]} for y in sorted(by_year)]

    by_pm = {}
    for i in eps:
        by_pm.setdefault(i["pm"], []).append(issue_ttm(i)["total"])
    by_pm_out = [{"pm": k, **stats(v)} for k, v in sorted(by_pm.items())]

    by_project = {}
    for i in eps:
        by_project.setdefault(i["project"], []).append(issue_ttm(i)["total"])
    by_project_out = [{"project": k, **stats(v)} for k, v in sorted(by_project.items())]

    return {
        "epic": block(eps),
        "task": block(tasks),
        "new_feature": block(feats),
        "overall": stats([issue_ttm(i)["total"] for i in eps]),
        "trend": trend,
        "by_pm": by_pm_out,
        "by_project": by_project_out,
    }


# ---------------------------- Lead time engine ------------------------------
def lead_time_engine(issues):
    eps = epics(issues)
    lt = [issue_lead_time(i) for i in eps]
    lt = [x for x in lt if x is not None]
    by_year = {}
    for i in eps:
        x = issue_lead_time(i)
        if x is not None and i.get("resolved"):
            by_year.setdefault(_d(i["resolved"]).year, []).append(x)
    trend = [{"period": str(y), "avg_lead": stats(by_year[y])["avg"]} for y in sorted(by_year)]
    return {**stats(lt), "trend": trend}


# --------------------------- Flow efficiency --------------------------------
def flow_engine(issues):
    eps = epics(issues)
    per_project, per_pm, all_vals = {}, {}, []
    for i in eps:
        f = issue_flow(i)
        all_vals.append(f)
        per_project.setdefault(i["project"], []).append(f)
        per_pm.setdefault(i["pm"], []).append(f)
    return {
        "portfolio_average": round(sum(all_vals) / len(all_vals), 1) if all_vals else 0,
        "per_project": [{"project": k, "flow_efficiency": round(sum(v) / len(v), 1)} for k, v in per_project.items()],
        "per_pm": [{"pm": k, "flow_efficiency": round(sum(v) / len(v), 1)} for k, v in per_pm.items()],
    }


# --------------------------- Project health ---------------------------------
def _children(epic, issues):
    return [i for i in issues if i.get("epic_key") == epic["key"]]


def project_health(issues):
    eps = epics(issues)
    now = dt.datetime.now()
    scored = []
    for e in eps:
        ch = _children(e, issues)
        ttm = issue_ttm(e)["total"]
        lead = issue_lead_time(e) or 0
        blocked_links = sum(1 for l in e["links"] if l["type"] == "is blocked by")
        dep_count = len(e["links"])
        overdue = sum(1 for c in ch if c.get("due") and not is_done(c) and _d(c["due"]) < now)
        # status aging: days since last status change
        aging = 0.0
        if e["history"]:
            last = _d(e["history"][-1]["entered"])
            if last and not is_done(e):
                aging = (now - last).total_seconds() / 86400.0
        delivered = sum(1 for c in ch if is_done(c))
        delivery_perf = pct(delivered, len(ch)) if ch else (100 if is_done(e) else 50)

        score = 100.0
        score -= min(25, ttm / 30.0)          # slower TTM lowers score
        score -= min(15, lead / 20.0)
        score -= min(15, blocked_links * 7)
        score -= min(10, overdue * 3)
        score -= min(10, dep_count * 2)
        score -= min(15, aging / 14.0)
        score = max(0.0, min(100.0, score)) * 0.6 + delivery_perf * 0.4
        score = round(max(0.0, min(100.0, score)), 1)
        cat = ("Excellent" if score >= 85 else "Good" if score >= 70
               else "Warning" if score >= 50 else "Critical")
        dur = None
        if e.get("created") and e.get("resolved"):
            dur = max(0, (_d(e["resolved"]) - _d(e["created"])).days)
        scored.append({
            "key": e["key"], "url": e.get("url", ""), "project": e["project"], "summary": e["summary"],
            "pm": e["pm"], "status": e["status"], "score": score, "category": cat,
            "ttm": ttm, "lead_time": lead, "blocked": blocked_links,
            "dependencies": dep_count, "overdue_children": overdue,
            "children": len(ch), "completed": is_done(e), "duration_days": dur,
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


# --------------------------- Blocker engine ---------------------------------
def blocker_engine(issues):
    by_key = {i["key"]: i for i in issues}
    edges, blocked_tasks, blocked_projects = [], [], []
    for i in issues:
        for l in i["links"]:
            if l["type"] == "blocks":
                src, dst = i["key"], l["target"]
            elif l["type"] == "is blocked by":
                src, dst = l["target"], i["key"]
            else:
                continue
            s, d = by_key.get(src), by_key.get(dst)
            kind = f"{'Epic' if s and s['is_epic'] else 'Task'} blocks {'Epic' if d and d['is_epic'] else 'Task'}"
            edges.append({"source": src, "target": dst, "kind": kind})

    # An issue is "blocked" if it is the target of a blocks-edge OR has an
    # explicit "is blocked by" link.
    blocked_by_map: dict[str, list[str]] = {}
    for e in edges:
        blocked_by_map.setdefault(e["target"], []).append(e["source"])
    for i in issues:
        blockers = blocked_by_map.get(i["key"], [])
        if blockers and not is_done(i):
            entry = {"key": i["key"], "summary": i["summary"], "pm": i["pm"],
                     "blocked_by": sorted(set(blockers)),
                     "blocked_days": round(issue_ttm(i)["total"], 1),
                     "risk": "High" if len(set(blockers)) > 1 else "Medium"}
            (blocked_projects if i["is_epic"] else blocked_tasks).append(entry)

    # simplified critical path = longest dependency chain
    adj = {}
    for e in edges:
        adj.setdefault(e["source"], []).append(e["target"])
    best = []
    seen = set()

    def dfs(n, path):
        nonlocal best
        if len(path) > len(best):
            best = list(path)
        for nxt in adj.get(n, []):
            if nxt not in path:
                dfs(nxt, path + [nxt])

    for n in adj:
        if n not in seen:
            dfs(n, [n])
    return {
        "edges": edges,
        "blocked_projects": blocked_projects,
        "blocked_tasks": blocked_tasks,
        "critical_path": best,
        "total_blocked": len(blocked_projects) + len(blocked_tasks),
    }


# --------------------------- PM leaderboard ---------------------------------
def pm_leaderboard(issues):
    eps = epics(issues)
    pms = {}
    for e in eps:
        pms.setdefault(e["pm"], []).append(e)
    health = {h["key"]: h["score"] for h in project_health(issues)}

    board = []
    for pm, projs in pms.items():
        completed = sum(1 for p in projs if is_done(p))
        tasks_done = sum(1 for i in works(issues) if i["pm"] == pm and is_done(i))
        ttm_vals = [issue_ttm(p)["total"] for p in projs if is_done(p)]
        lead_vals = [x for x in (issue_lead_time(p) for p in projs) if x is not None]
        flow_vals = [issue_flow(p) for p in projs]
        avg_ttm = round(sum(ttm_vals) / len(ttm_vals), 1) if ttm_vals else 0
        avg_lead = round(sum(lead_vals) / len(lead_vals), 1) if lead_vals else 0
        flow = round(sum(flow_vals) / len(flow_vals), 1) if flow_vals else 0
        success = pct(completed, len(projs))
        avg_health = round(sum(health.get(p["key"], 0) for p in projs) / len(projs), 1)
        # PM score: blend of success, health, flow and speed
        speed = max(0.0, 100 - min(100, avg_ttm / 3.0))
        score = round(success * 0.3 + avg_health * 0.3 + flow * 0.2 + speed * 0.2, 1)
        board.append({
            "pm": pm, "projects_total": len(projs), "projects_completed": completed,
            "tasks_completed": tasks_done, "avg_ttm": avg_ttm, "avg_lead_time": avg_lead,
            "flow_efficiency": flow, "success_rate": success, "pm_score": score,
        })
    board.sort(key=lambda x: x["pm_score"], reverse=True)
    for idx, b in enumerate(board, 1):
        b["rank"] = idx
    return board


def filter_issues(issues, scope="all", state="all", pm=None, project=None,
                  status=None, period=None, value=None, itype=None, limit=600):
    """Return the underlying issue list behind a dashboard number (drill-down)."""
    out = []
    for i in issues:
        if scope == "epics" and not i["is_epic"]:
            continue
        if scope == "tasks" and i["is_epic"]:
            continue
        if itype and i["type"] != itype:
            continue
        if pm and i["pm"] != pm:
            continue
        if project and i["project"] != project:
            continue
        if status and i["status"] not in {s.strip() for s in status.split(",")}:
            continue
        done, decl = is_done(i), is_declined(i)
        if state == "completed" and not done:
            continue
        if state == "open" and (done or decl):
            continue
        if state == "declined" and not decl:
            continue
        # period window on resolution date (for throughput drill-downs)
        if period and value and i.get("resolved"):
            r = _d(i["resolved"])
            tag = {"year": str(r.year), "quarter": f"{r.year}-Q{(r.month-1)//3+1}",
                   "month": f"{r.year}-{r.month:02d}"}.get(period)
            if tag != value:
                continue
        dur = None
        if i.get("created") and i.get("resolved"):
            dur = max(0, (_d(i["resolved"]) - _d(i["created"])).days)
        out.append({
            "key": i["key"], "url": i.get("url", ""), "summary": i.get("summary", ""),
            "type": i["type"], "status": i["status"], "pm": i["pm"],
            "project": i["project"], "resolved": (i["resolved"] or "")[:10] if i.get("resolved") else "",
            "duration_days": dur,
        })
    out.sort(key=lambda x: (x["resolved"] or ""), reverse=True)
    return {"count": len(out), "issues": out[:limit]}


def calendar_events(issues, mode="resolved", start=None, end=None, itype=None, pm=None):
    """Calendar feed: one event per issue placed on its DATE.

    mode="resolved" → only completed issues, dated by Resolution Date (when it
    was closed). mode="created" → all issues, dated by Created date (when it was
    opened). Each event carries key/summary/pm/status/type so the UI can render
    and link it. Optional [start,end] (YYYY-MM-DD inclusive) and type/pm filters.
    """
    field = "resolved" if mode == "resolved" else "created"
    out = []
    for i in issues:
        if mode == "resolved" and not is_done(i):
            continue
        d = _d(i.get(field))
        if not d:
            continue
        day = d.date().isoformat()
        if start and day < start:
            continue
        if end and day > end:
            continue
        if itype and i["type"] != itype:
            continue
        if pm and i["pm"] != pm:
            continue
        out.append({
            "key": i["key"], "url": i.get("url", ""), "summary": i.get("summary", ""),
            "type": i["type"], "status": i["status"], "pm": i["pm"],
            "project": i["project"], "date": day, "is_epic": i["is_epic"],
        })
    out.sort(key=lambda x: x["date"])
    types = sorted({e["type"] for e in out if e["type"]})
    return {"count": len(out), "mode": mode, "events": out, "types": types}


def flow_balance(issues, granularity="month", periods=8):
    """Created vs Resolved per period — the classic portfolio FLOW health report
    (are we closing work faster than it arrives?). Returns per-period created /
    resolved / net counts plus a window summary: flow ratio (resolved/created %)
    and backlog delta (created - resolved). Pure function over existing fields."""
    def pkey(d, g):
        if g == "year":
            return str(d.year)
        if g == "quarter":
            return f"{d.year}-Q{(d.month - 1) // 3 + 1}"
        return f"{d.year}-{d.month:02d}"

    created, resolved = {}, {}
    for i in issues:
        c = _d(i.get("created"))
        if c:
            k = pkey(c, granularity)
            created[k] = created.get(k, 0) + 1
        if is_done(i) and i.get("resolved"):
            r = _d(i["resolved"])
            if r:
                k = pkey(r, granularity)
                resolved[k] = resolved.get(k, 0) + 1

    keys = sorted(set(created) | set(resolved))[-periods:]
    series = [{"period": k, "created": created.get(k, 0), "resolved": resolved.get(k, 0),
               "net": created.get(k, 0) - resolved.get(k, 0)} for k in keys]
    tot_c = sum(s["created"] for s in series)
    tot_r = sum(s["resolved"] for s in series)
    return {
        "granularity": granularity, "series": series,
        "summary": {"created": tot_c, "resolved": tot_r,
                    "ratio": round(100 * tot_r / tot_c) if tot_c else 0,
                    "backlog_delta": tot_c - tot_r},
    }


def risk_insights(issues):
    """Risk & delivery-health feed for the standalone Risk Dashboard. Pure
    aggregation over EXISTING engines (project_health, blocker_engine,
    portfolio_kpis, yearly_analytics) — no new data required.

    Returns rollup KPIs, health buckets (green/yellow/red), a risk register
    (worst open projects first), a PM × risk heatmap, blocked items + critical
    path, aging open items (longest in current status), and structured insight
    objects (localized on the frontend)."""
    health = project_health(issues)
    blockers = blocker_engine(issues)
    kpis = portfolio_kpis(issues)
    yearly = yearly_analytics(issues)
    now = dt.datetime.now()

    def bucket(score):
        return "green" if score >= 70 else "yellow" if score >= 50 else "red"

    buckets = {"green": 0, "yellow": 0, "red": 0}
    for h in health:
        buckets[bucket(h["score"])] += 1

    # rollup KPIs count OPEN items only, so each number equals its click-through list
    critical = sum(1 for h in health if h["category"] == "Critical" and not h["completed"])
    at_risk = sum(1 for h in health if h["category"] in ("Critical", "Warning") and not h["completed"])
    delayed = sum(1 for h in health if not h["completed"] and h.get("overdue_children", 0) > 0)

    overdue_tasks = 0
    for i in issues:
        if i.get("due") and not is_done(i) and not is_declined(i):
            d = _d(i["due"])
            if d and d < now:
                overdue_tasks += 1

    # risk register: worst OPEN Critical/Warning projects first
    KEEP = ("key", "url", "project", "summary", "pm", "status", "score", "category",
            "ttm", "lead_time", "blocked", "dependencies", "overdue_children", "children")
    register = [{**{k: h[k] for k in KEEP}, "is_epic": True} for h in health
                if h["category"] in ("Critical", "Warning") and not h["completed"]]
    register.sort(key=lambda x: x["score"])
    register = register[:40]

    # heatmap: PM × risk bucket (open projects only)
    pm_map = {}
    for h in health:
        if h["completed"]:
            continue
        pm = h["pm"] or "—"
        row = pm_map.setdefault(pm, {"pm": pm, "green": 0, "yellow": 0, "red": 0, "total": 0})
        row[bucket(h["score"])] += 1
        row["total"] += 1
    heatmap = sorted(pm_map.values(), key=lambda r: (r["red"], r["yellow"], r["total"]), reverse=True)[:12]

    # aging: open items longest in their current status (from changelog)
    aging = []
    for i in issues:
        if is_done(i) or is_declined(i) or not i.get("history"):
            continue
        last = _d(i["history"][-1]["entered"])
        if last:
            aging.append({"key": i["key"], "url": i.get("url", ""), "summary": i.get("summary", ""),
                          "pm": i["pm"], "status": i["status"], "is_epic": i["is_epic"],
                          "days": round((now - last).total_seconds() / 86400.0, 1)})
    aging.sort(key=lambda x: x["days"], reverse=True)
    aging = aging[:15]

    wip = kpis["in_progress"] + kpis["in_testing"] + kpis.get("in_pilot", 0)

    # ---- cohorts: the actual issues behind each rollup KPI, each with a REASON ----
    WIP_ST = {"IN PROGRESS", "TESTING", "PILOT IO"}
    at_risk_c, critical_c, delayed_c, wip_c = [], [], [], []
    for h in health:
        if h["completed"]:
            continue
        base = {"key": h["key"], "url": h.get("url", ""), "summary": h.get("summary", ""),
                "pm": h["pm"], "status": h["status"], "is_epic": True}
        rh = {"type": "health", "score": round(h["score"]), "category": h["category"]}
        if h["category"] in ("Critical", "Warning"):
            at_risk_c.append({**base, "reason": rh})
        if h["category"] == "Critical":
            critical_c.append({**base, "reason": rh})
        if h.get("overdue_children", 0) > 0:
            delayed_c.append({**base, "reason": {"type": "overdue_children", "count": h["overdue_children"]}})
        if h["status"] in WIP_ST:
            wip_c.append({**base, "reason": {"type": "wip"}})
    overdue_c = []
    for i in issues:
        if i.get("due") and not is_done(i) and not is_declined(i):
            d = _d(i["due"])
            if d and d < now:
                overdue_c.append({"key": i["key"], "url": i.get("url", ""), "summary": i.get("summary", ""),
                                  "pm": i["pm"], "status": i["status"], "is_epic": i["is_epic"],
                                  "reason": {"type": "overdue", "days": (now - d).days}})
    blocked_c = [{"key": b["key"], "url": b.get("url", ""), "summary": b.get("summary", ""),
                  "pm": b["pm"], "status": "", "is_epic": is_ep,
                  "reason": {"type": "blocked", "by": b.get("blocked_by", [])}}
                 for is_ep, lst in ((True, blockers["blocked_projects"]), (False, blockers["blocked_tasks"]))
                 for b in lst]
    cohorts = {
        "at_risk": at_risk_c[:60], "critical": critical_c[:60], "delayed": delayed_c[:60],
        "overdue": overdue_c[:60], "blocked": blocked_c[:60], "wip": wip_c[:60],
    }

    # structured insights (frontend localizes from type + fields)
    insights = []
    for h in register[:3]:
        insights.append({"type": "slow_project", "severity": "high" if h["category"] == "Critical" else "med",
                         "key": h["key"], "summary": h.get("summary", ""), "is_epic": True,
                         "project": h["project"], "pm": h["pm"], "score": h["score"], "ttm": h["ttm"]})
    qoq = yearly.get("qoq_growth", [])
    if qoq and qoq[-1]["growth_pct"] < 0:
        insights.append({"type": "throughput_drop", "severity": "med",
                         "value": qoq[-1]["growth_pct"], "period": qoq[-1]["period"]})
    for b in (blockers.get("blocked_projects") or [])[:3]:
        insights.append({"type": "long_blocked", "severity": "high", "is_epic": True,
                         "key": b["key"], "summary": b.get("summary", ""),
                         "days": b.get("blocked_days"), "by": b.get("blocked_by", [])})
    for a in aging[:2]:
        if a["days"] >= 30:
            insights.append({"type": "aging", "severity": "med", "is_epic": a.get("is_epic", False),
                             "key": a["key"], "summary": a.get("summary", ""),
                             "status": a["status"], "days": a["days"]})

    return {
        "rollup": {
            "at_risk": at_risk, "critical": critical, "delayed": delayed,
            "overdue_tasks": overdue_tasks, "blocked": blockers["total_blocked"],
            "wip": wip, "total_open": kpis["open_projects"],
        },
        "health_buckets": buckets,
        "register": register,
        "heatmap": heatmap,
        "blocked": {
            "projects": [{**b, "is_epic": True} for b in blockers["blocked_projects"][:20]],
            "tasks": [{**b, "is_epic": False} for b in blockers["blocked_tasks"][:20]],
            "critical_path": blockers["critical_path"],
            "total": blockers["total_blocked"],
        },
        "aging": aging,
        "insights": insights,
        "cohorts": cohorts,
    }


# ----------------------- Epic quality (new-epic QA) -------------------------
import re as _re

# Placeholder / junk titles & descriptions an author might leave behind. Matched
# against the whole trimmed lower-cased value (conservative — only obvious junk).
_PLACEHOLDER = {
    "test", "testtest", "testing", "tests", "tba", "tbd", "todo", "to do", "na", "n/a",
    "none", "null", "xxx", "asdf", "qwerty", "temp", "tmp", "demo", "sample", "example",
    "epic", "new epic", "untitled", "no description", "описание",
    "тест", "тестовая", "тестовый", "тестовое", "проверка", "заглушка", "новый эпик",
    "без названия", "нет описания", "sinov", "synov", "yangi epik", "tavsif yo'q",
}
# Markers that betray a test/clone artifact left in a real-looking title.
_TEST_MARKERS = ("test clone", "тест клон", "clone for", "для теста", "for test",
                 "тестовый прогон", "do not use", "не использовать", "проверка воркфлов",
                 "workflow test", "воркфлов")


def _norm_txt(s):
    return _re.sub(r"\s+", " ", (s or "").strip()).strip()


def _strip_markup(s):
    """Remove Jira/wiki links & markup so we can tell prose from a bare link."""
    s = s or ""
    s = _re.sub(r"\[([^\]|]*)\|[^\]]*\]", r"\1", s)   # [text|url] -> text
    s = _re.sub(r"https?://\S+", "", s)               # bare urls
    s = _re.sub(r"\{[^}]*\}", "", s)                  # {code}/{color} macros
    s = _re.sub(r"[!\[\]\|\*#>_~`-]", " ", s)         # markup chars
    return _re.sub(r"\s+", " ", s).strip()


def _is_placeholder(s):
    n = _norm_txt(s).lower()
    if not n:
        return False
    core = _re.sub(r"[^\w\s/]", "", n).strip()
    if n in _PLACEHOLDER or core in _PLACEHOLDER:
        return True
    # a single token of one repeated character: "ddddd", "аааа", "...."
    if _re.fullmatch(r"(.)\1{3,}", n.replace(" ", "")):
        return True
    return False


def _has_test_marker(s):
    n = _norm_txt(s).lower()
    return any(m in n for m in _TEST_MARKERS)


def _field_empty(v):
    return str(v or "").strip().lower() in {"", "unassigned", "не назначен", "none", "-", "n/a"}


def epic_problems(epic):
    """Structured quality problems for ONE epic. Each problem is
    {field, type, severity}; the frontend localizes from `type`. Conservative —
    only flags clear issues so a PM can trust the alert."""
    p = []
    summary = _norm_txt(epic.get("summary"))
    desc_raw = epic.get("description") or ""
    desc_prose = _strip_markup(desc_raw)

    # --- title / summary ---
    if not summary:
        p.append({"field": "summary", "type": "summary_missing", "severity": "high"})
    elif _is_placeholder(summary) or _has_test_marker(summary):
        p.append({"field": "summary", "type": "summary_placeholder", "severity": "high"})
    elif len(summary) < 12:
        p.append({"field": "summary", "type": "summary_short", "severity": "med"})

    # --- description ---
    if not desc_raw.strip():
        p.append({"field": "description", "type": "description_missing", "severity": "high"})
    elif _is_placeholder(desc_prose or desc_raw) or _has_test_marker(desc_raw):
        p.append({"field": "description", "type": "description_placeholder", "severity": "high"})
    elif len(desc_prose) < 10 and (desc_raw.strip()):
        # there was content but it was only a link / markup, no real prose
        p.append({"field": "description", "type": "description_link_only", "severity": "med"})
    elif len(desc_prose) < 40:
        p.append({"field": "description", "type": "description_short", "severity": "med"})

    # --- required fields ---
    if _field_empty(epic.get("pm")):
        p.append({"field": "pm", "type": "missing_pm", "severity": "high"})
    if _field_empty(epic.get("division")):
        p.append({"field": "division", "type": "missing_division", "severity": "med"})
    if _field_empty(epic.get("due")):
        p.append({"field": "due", "type": "missing_due", "severity": "low"})
    sc = str(epic.get("scoring") or "").strip()
    if sc == "" or sc in {"0", "0.0"}:
        p.append({"field": "scoring", "type": "missing_scoring", "severity": "low"})
    if _field_empty(epic.get("project_type")):
        p.append({"field": "project_type", "type": "missing_project_type", "severity": "low"})
    return p


_QW = {"high": 30, "med": 15, "low": 7}


def epic_quality(issues, project="PMD", window_days=90):
    """QA feed for NEWLY-CREATED epics: find epics created within `window_days`
    of the most recent epic-creation date (in `project`, default PMD) whose
    title/description is unclear or whose required fields are unfilled, so a PM
    can be alerted and Temur can draft author feedback. Declined epics skipped."""
    eps = [e for e in epics(issues) if (not project or e.get("project") == project)
           and not is_declined(e)]
    dated = [(e, _d(e.get("created"))) for e in eps if e.get("created")]
    dated = [(e, d) for e, d in dated if d]
    if not dated:
        return {"count": 0, "total_recent": 0, "window_days": window_days,
                "project": project, "ref": None, "flagged": []}
    ref = max(d for _, d in dated)
    cutoff = ref - dt.timedelta(days=window_days)
    recent = [e for e, d in dated if d >= cutoff]

    flagged = []
    for e in recent:
        probs = epic_problems(e)
        # Don't cry wolf: only alert when there is a real clarity/ownership issue
        # (any high/med problem) or several missing fields (2+ low). A single
        # trivial gap (e.g. only scoring=0) is not worth a PM alert.
        highmed = [x for x in probs if x["severity"] in ("high", "med")]
        lows = [x for x in probs if x["severity"] == "low"]
        if not highmed and len(lows) < 2:
            continue
        score = max(0, 100 - sum(_QW.get(x["severity"], 7) for x in probs))
        sev = ("high" if any(x["severity"] == "high" for x in probs)
               else "med" if any(x["severity"] == "med" for x in probs) else "low")
        flagged.append({
            "key": e["key"], "url": e.get("url", ""), "project": e["project"],
            "summary": e.get("summary", ""), "pm": e.get("pm", ""),
            "reporter": e.get("reporter", ""), "status": e["status"], "is_epic": True,
            "created": (e.get("created") or "")[:10],
            "problems": probs, "problem_count": len(probs),
            "score": score, "severity": sev,
        })
    sev_rank = {"high": 0, "med": 1, "low": 2}
    flagged.sort(key=lambda x: (sev_rank[x["severity"]], x["score"], -len(x["problems"])))
    return {
        "count": len(flagged), "total_recent": len(recent), "window_days": window_days,
        "project": project, "ref": ref.isoformat(),
        "high": sum(1 for f in flagged if f["severity"] == "high"),
        "flagged": flagged,
    }


def data_quality(issues):
    """Field coverage of the active dataset (how many issues have each field filled)."""
    n = len(issues) or 1
    EMPTY = {"", "unassigned", "не задана", "нет", "none", "не заполнено",
             "не определено", "не назначен", "-", "0"}
    defs = [
        ("Issue key", "key"), ("Type", "type"), ("Status", "status"), ("Project", "project"),
        ("PM (custom)", "pm"), ("Assignee", "assignee"), ("Reporter", "reporter"),
        ("Priority", "priority"), ("Resolved date", "resolved"), ("Created", "created"),
        ("Due date", "due"), ("Epic link", "epic_key"), ("Project type", "project_type"),
        ("Regulator req.", "regulator"), ("Customer division", "division"), ("Scoring", "scoring"),
    ]
    rows = []
    for label, k in defs:
        filled = sum(1 for i in issues if str(i.get(k) or "").strip().lower() not in EMPTY)
        rows.append({"field": label, "filled": filled, "total": len(issues),
                     "pct": round(100 * filled / n, 1)})
    has_history = any(len(i.get("history", [])) > 2 for i in issues)
    return {"total": len(issues), "fields": rows, "has_status_history": has_history,
            "epics": sum(1 for i in issues if i["is_epic"])}


def recent_closures(issues, days=14, limit=30):
    """Items resolved within `days` of the most recent resolution date.

    Used for bell notifications and 'recently closed' celebrations.
    """
    done = [i for i in issues if is_done(i) and i.get("resolved")]
    if not done:
        return {"epics": [], "tasks": [], "ref": None}
    ref = max(_d(i["resolved"]) for i in done)
    cutoff = ref - dt.timedelta(days=days)
    recent = [i for i in done if _d(i["resolved"]) >= cutoff]
    recent.sort(key=lambda i: _d(i["resolved"]), reverse=True)

    def fmt(i):
        return {
            "key": i["key"], "url": i.get("url", ""), "type": i["type"], "pm": i["pm"],
            "summary": i.get("summary", ""), "project": i.get("project", ""),
            "resolved": i["resolved"][:10] if i.get("resolved") else "",
            "duration_days": (max(0, (_d(i["resolved"]) - _d(i["created"])).days)
                              if i.get("created") and i.get("resolved") else None),
        }

    epics_r = [fmt(i) for i in recent if i["is_epic"]][:limit]
    tasks_r = [fmt(i) for i in recent if not i["is_epic"]][:limit]
    return {"epics": epics_r, "tasks": tasks_r, "ref": ref.isoformat(),
            "window_days": days, "total": len(epics_r) + len(tasks_r)}


def pm_leaderboard_period(issues, period="all", ref=None):
    """PM leaderboard filtered to a time window by resolution date.

    period: all | year | quarter | month | week. Counts completed projects (epics)
    and tasks per PM, plus total time spent (sum of TTM days). Ranked by output.
    """
    eps = epics(issues)
    completed = [e for e in eps if is_done(e) and e.get("resolved")]
    if ref is None:
        dates = [_d(e["resolved"]) for e in completed]
        ref = max(dates) if dates else dt.datetime.now()

    def in_win(iso):
        if period == "all":
            return True
        if not iso:
            return False
        d = _d(iso)
        if period == "year":
            return d.year == ref.year
        if period == "quarter":
            return d.year == ref.year and (d.month - 1) // 3 == (ref.month - 1) // 3
        if period == "month":
            return d.year == ref.year and d.month == ref.month
        if period == "week":
            return d.isocalendar()[:2] == ref.isocalendar()[:2]
        return True

    agg: dict[str, dict] = {}
    for e in eps:
        if is_done(e) and in_win(e.get("resolved")):
            a = agg.setdefault(e["pm"], {"projects": 0, "tasks": 0, "time": 0.0})
            a["projects"] += 1
            a["time"] += issue_ttm(e)["total"]
    for w in works(issues):
        if is_done(w) and in_win(w.get("resolved")):
            a = agg.setdefault(w["pm"], {"projects": 0, "tasks": 0, "time": 0.0})
            a["tasks"] += 1
            a["time"] += issue_ttm(w)["total"]

    board = []
    for pm, s in agg.items():
        if pm == "Unassigned":
            continue
        board.append({"pm": pm, "projects_completed": s["projects"],
                      "tasks_completed": s["tasks"], "time_spent": round(s["time"], 1)})
    board.sort(key=lambda b: (b["projects_completed"], b["tasks_completed"], b["time_spent"]), reverse=True)
    for i, b in enumerate(board, 1):
        b["rank"] = i
    return {"period": period, "ref": ref.isoformat() if hasattr(ref, "isoformat") else str(ref),
            "rows": board}


def pm_nominations(board):
    if not board:
        return {}
    def top(key, reverse=True):
        return max(board, key=lambda b: b[key]) if reverse else min(board, key=lambda b: b[key])
    completed = [b for b in board if b["projects_completed"] > 0] or board
    return {
        "best_project_manager": board[0]["pm"],
        "fastest_delivery_manager": min(completed, key=lambda b: b["avg_lead_time"] or 1e9)["pm"],
        "best_quality_manager": top("flow_efficiency")["pm"],
        "highest_throughput_manager": top("projects_completed")["pm"],
        "best_ttm_manager": min(completed, key=lambda b: b["avg_ttm"] or 1e9)["pm"],
        "best_lead_time_manager": min(completed, key=lambda b: b["avg_lead_time"] or 1e9)["pm"],
        "best_portfolio_contributor": top("projects_total")["pm"],
        "most_consistent_pm": top("success_rate")["pm"],
        "top_performer": board[0]["pm"],
    }


# ----------------------------- Top projects ---------------------------------
def top_projects(issues):
    health = project_health(issues)
    done = [h for h in health if h["completed"]]
    return {
        "top_10": health[:10],
        "fastest": sorted([h for h in done if h["ttm"] > 0], key=lambda h: h["ttm"])[:10],
        "highest_quality": sorted(health, key=lambda h: h["score"], reverse=True)[:10],
        "most_complex": sorted(health, key=lambda h: (h["dependencies"], h["children"]), reverse=True)[:10],
        "most_delayed": sorted(health, key=lambda h: (h["overdue_children"], h["ttm"]), reverse=True)[:10],
    }
