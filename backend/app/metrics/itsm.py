"""ITSM Service Desk metrics — resource utilization, request-type usage, and
time-based dynamics. Pure functions over the normalized issue list.

Date-based outputs (resource_calendar, request_type_dynamics) rely on each
issue's `resolved` / `created` date. The Jira Issue-Navigator .xls export has no
date columns, so those populate only after a History export (which carries
Создано + status transitions) is uploaded and enriches the issues.
"""
import collections
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
