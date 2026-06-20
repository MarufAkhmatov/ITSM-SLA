"""Aggregate all engines into (a) the widget payload that feeds the existing
dashboard widgets 1:1, and (b) the full analytics payload."""
import collections
from .metrics import engines as E
from .metrics import itsm as ITSM


def _last(seq, n):
    return seq[-n:] if len(seq) >= n else seq


def _pct(met, breach):
    n = met + breach
    return round(100.0 * met / n, 1) if n else None


def _avg(total, n):
    return round(total / n, 1) if n else None


def _sla_summary(issues: list[dict]) -> dict:
    """Headline SLA: pass-rate + Plan vs Fakt (minutes) over ITSM tickets."""
    react_met = react_breach = resol_met = resol_breach = 0
    react_running = resol_running = 0
    total_itsm = 0
    # Plan/Fakt accumulators
    rp = rf = sp = sf = 0.0   # reaction plan/fakt, resolution plan/fakt (sum minutes)
    rp_n = rf_n = sp_n = sf_n = 0
    crt_counts: collections.Counter = collections.Counter()
    assignees_set: set[str] = set()
    for i in issues:
        if not i.get("customer_request_type"):
            continue
        total_itsm += 1
        crt_counts[i["customer_request_type"]] += 1
        if i.get("assignee"):
            assignees_set.add(i["assignee"])
        rm = i.get("sla_reaction_met")
        if rm is True:    react_met += 1
        elif rm is False: react_breach += 1
        else:             react_running += 1
        sm = i.get("sla_resolution_met")
        if sm is True:    resol_met += 1
        elif sm is False: resol_breach += 1
        else:             resol_running += 1
        if i.get("sla_reaction_plan_min") is not None:  rp += i["sla_reaction_plan_min"]; rp_n += 1
        if i.get("sla_reaction_spent_min") is not None: rf += i["sla_reaction_spent_min"]; rf_n += 1
        if i.get("sla_resolution_plan_min") is not None:  sp += i["sla_resolution_plan_min"]; sp_n += 1
        if i.get("sla_resolution_spent_min") is not None: sf += i["sla_resolution_spent_min"]; sf_n += 1

    return {
        "total_itsm_issues": total_itsm,
        "distinct_request_types": len(crt_counts),
        "distinct_assignees": len(assignees_set),
        "reaction": {
            "met": react_met, "breached": react_breach, "running": react_running,
            "pass_rate_pct": _pct(react_met, react_breach),
            "plan_avg_min": _avg(rp, rp_n), "fakt_avg_min": _avg(rf, rf_n),
            "plan_sum_min": round(rp, 1), "fakt_sum_min": round(rf, 1),
        },
        "resolution": {
            "met": resol_met, "breached": resol_breach, "running": resol_running,
            "pass_rate_pct": _pct(resol_met, resol_breach),
            "plan_avg_min": _avg(sp, sp_n), "fakt_avg_min": _avg(sf, sf_n),
            "plan_sum_min": round(sp, 1), "fakt_sum_min": round(sf, 1),
        },
        "total": {
            # total = reaction + resolution
            "plan_avg_min": _avg(rp + sp, max(rp_n, sp_n)) if (rp_n or sp_n) else None,
            "fakt_avg_min": _avg(rf + sf, max(rf_n, sf_n)) if (rf_n or sf_n) else None,
            "plan_sum_min": round(rp + sp, 1),
            "fakt_sum_min": round(rf + sf, 1),
        },
        "overall_pass_rate_pct": _pct(react_met + resol_met, react_breach + resol_breach),
        "top_request_types": [
            {"name": k, "count": v} for k, v in crt_counts.most_common(10)
        ],
    }


def _sla_by_request_type(issues: list[dict]) -> list[dict]:
    """Per Customer Request Type: count, status split, Plan vs Fakt (avg minutes)
    for reaction / resolution / total, and SLA pass-rates."""
    buckets: dict[str, dict] = {}
    for i in issues:
        crt = i.get("customer_request_type")
        if not crt:
            continue
        b = buckets.setdefault(crt, {
            "name": crt, "count": 0,
            "done": 0, "in_progress": 0, "todo": 0,
            "rp": 0.0, "rp_n": 0, "rf": 0.0, "rf_n": 0,
            "sp": 0.0, "sp_n": 0, "sf": 0.0, "sf_n": 0,
            "rf_max": 0.0, "sf_max": 0.0,   # maximum spent (Fakt) seen
            "react_met": 0, "react_breach": 0, "resol_met": 0, "resol_breach": 0,
            "assignees": set(),
        })
        b["count"] += 1
        if i.get("assignee"):
            b["assignees"].add(i["assignee"])
        # status split (ITSM groups)
        sg = i.get("status_group")
        st = i.get("status")
        if st in ("DONE",) or sg == "done":
            b["done"] += 1
        elif st in ("IN PROGRESS", "TESTING", "ANALYSIS", "NEED INFO") or sg in ("delivery",):
            b["in_progress"] += 1
        else:
            b["todo"] += 1
        if i.get("sla_reaction_plan_min") is not None:  b["rp"] += i["sla_reaction_plan_min"]; b["rp_n"] += 1
        if i.get("sla_reaction_spent_min") is not None:
            b["rf"] += i["sla_reaction_spent_min"]; b["rf_n"] += 1
            b["rf_max"] = max(b["rf_max"], i["sla_reaction_spent_min"])
        if i.get("sla_resolution_plan_min") is not None:  b["sp"] += i["sla_resolution_plan_min"]; b["sp_n"] += 1
        if i.get("sla_resolution_spent_min") is not None:
            b["sf"] += i["sla_resolution_spent_min"]; b["sf_n"] += 1
            b["sf_max"] = max(b["sf_max"], i["sla_resolution_spent_min"])
        rm = i.get("sla_reaction_met")
        if rm is True: b["react_met"] += 1
        elif rm is False: b["react_breach"] += 1
        sm = i.get("sla_resolution_met")
        if sm is True: b["resol_met"] += 1
        elif sm is False: b["resol_breach"] += 1

    out = []
    for b in buckets.values():
        plan_react, fakt_react = _avg(b["rp"], b["rp_n"]), _avg(b["rf"], b["rf_n"])
        plan_resol, fakt_resol = _avg(b["sp"], b["sp_n"]), _avg(b["sf"], b["sf_n"])
        max_react = round(b["rf_max"], 1) if b["rf_n"] else None
        max_resol = round(b["sf_max"], 1) if b["sf_n"] else None
        out.append({
            "name": b["name"], "count": b["count"],
            "assignees": len(b["assignees"]),
            "done": b["done"], "in_progress": b["in_progress"], "todo": b["todo"],
            "plan": {
                "reaction_min": plan_react, "resolution_min": plan_resol,
                "total_min": round((plan_react or 0) + (plan_resol or 0), 1),
            },
            "fakt": {
                "reaction_min": fakt_react, "resolution_min": fakt_resol,
                "total_min": round((fakt_react or 0) + (fakt_resol or 0), 1),
            },
            # maximum (worst-case) Fakt seen — for the avg/max toggle
            "fakt_max": {
                "reaction_min": max_react, "resolution_min": max_resol,
                "total_min": round((max_react or 0) + (max_resol or 0), 1),
            },
            "reaction_pass_rate_pct": _pct(b["react_met"], b["react_breach"]),
            "resolution_pass_rate_pct": _pct(b["resol_met"], b["resol_breach"]),
        })
    out.sort(key=lambda x: -x["count"])
    return out


def build(issues: list[dict]) -> dict:
    kpis = E.portfolio_kpis(issues)
    yearly = E.yearly_analytics(issues)
    ttm = E.ttm_engine(issues)
    lead = E.lead_time_engine(issues)
    flow = E.flow_engine(issues)
    health = E.project_health(issues)
    blockers = E.blocker_engine(issues)
    board = E.pm_leaderboard(issues)
    noms = E.pm_nominations(board)
    tops = E.top_projects(issues)

    # ---- widget: header metrics (3) ----
    header_metrics = [
        {"value": kpis["total_portfolio_projects"], "label_key": "kpi_total_projects", "up": True},
        {"value": kpis["completed_projects"], "label_key": "kpi_completed", "up": True},
        {"value": kpis["open_projects"], "label_key": "kpi_open", "up": True},
    ]

    # ---- widget: Wellness (progress lollipops) -> Portfolio completion + monthly trend ----
    monthly = yearly["monthly"]
    m_vals = [m["completed"] for m in _last(monthly, 7)]
    m_labels = [m["period"][-2:] for m in _last(monthly, 7)]  # MM
    mx = max(m_vals) if m_vals else 1
    wellness = {
        "completion_pct": kpis["completion_pct"],
        "bars": [round(100 * v / mx) if mx else 0 for v in m_vals],
        "labels": m_labels,
        "series": E.completion_series(issues),
    }

    # ---- widget: Stress/Recovery line -> TTM trend ----
    ttm_trend = ttm["trend"]
    t_vals = [t["avg_ttm"] for t in _last(ttm_trend, 7)] or [0]
    yoy = yearly["yoy_growth"][-1]["growth_pct"] if yearly["yoy_growth"] else 0
    ttm_line = {
        "delta": f"{'+' if yoy >= 0 else ''}{yoy}%",
        "points": [{"period": t["period"][-4:], "value": t["avg_ttm"]} for t in _last(ttm_trend, 7)],
        "value": ttm["overall"]["avg"],
    }

    # ---- widget: HRV bars -> quarterly throughput ----
    quarterly = yearly["quarterly"]
    q_last = _last(quarterly, 3)
    qoq = yearly["qoq_growth"][-1]["growth_pct"] if yearly["qoq_growth"] else 0
    throughput = {
        "delta": f"{'+' if qoq >= 0 else ''}{qoq}%",
        "bars": [{"period": q["period"].split("-")[-1], "value": q["completed"]} for q in q_last],
    }

    # ---- widget: Glucose gauge -> flow efficiency ----
    flow_widget = {"value": round(flow["portfolio_average"]), "delta": flow["portfolio_average"]}

    # ---- widget: Patient Flow donut -> project flow ----
    project_flow = {
        "total": kpis["total_portfolio_projects"],
        "completed": kpis["completed_projects"],
        "open": kpis["open_projects"],
        "declined": kpis["declined_projects"],
        "completion_pct": kpis["completion_pct"],
        "by_status": E.epic_status_flow(issues),   # detailed per-status breakdown
    }

    # ---- widget: Best Projects -> top 3 by health (key + epic summary) ----
    palette = ["#2d7a5f", "#9b59b6", "#d4a84b"]
    top3 = [{"key": h["key"], "url": h.get("url") or "", "summary": h.get("summary") or "",
             "name": f"{h['key']} ({h['project']})", "pct": round(h["score"]),
             "duration_days": h.get("duration_days"),
             "color": palette[i % 3]} for i, h in enumerate(health[:3])]

    # ---- widget: Healthcare Providers table -> PM leaderboard ----
    pm_widget = [{
        "pm": b["pm"], "rank": b["rank"], "score": b["pm_score"],
        "projects_completed": b["projects_completed"], "tasks_completed": b["tasks_completed"],
        "avg_ttm": b["avg_ttm"], "avg_lead_time": b["avg_lead_time"],
        "flow_efficiency": b["flow_efficiency"], "success_rate": b["success_rate"],
        "available": b["success_rate"] >= 50,
    } for b in board[:6]]

    # ITSM SLA — Plan vs Fakt. Only over issues that have a Customer Request
    # Type (ITSM Service Desk tickets); portfolio data passes through empty.
    sla_summary = _sla_summary(issues)
    sla_by_request_type = _sla_by_request_type(issues)
    resource_utilization = ITSM.resource_utilization(issues)
    request_type_usage = ITSM.request_type_usage(issues)
    resource_calendar = ITSM.resource_calendar(issues)
    request_type_dynamics = ITSM.request_type_dynamics(issues)
    sla_trend = ITSM.sla_trend(issues)

    return {
        "widgets": {
            "header_metrics": header_metrics,
            "wellness": wellness,
            "ttm_trend": ttm_line,
            "throughput": throughput,
            "flow": flow_widget,
            "project_flow": project_flow,
            "top_projects": top3,
            "pm_leaderboard": pm_widget,
            "sla_summary": sla_summary,
            "sla_by_request_type": sla_by_request_type,
            "resource_utilization": resource_utilization,
            "request_type_usage": request_type_usage,
            "resource_calendar": resource_calendar,
            "request_type_dynamics": request_type_dynamics,
            "sla_trend": sla_trend,
        },
        "kpis": kpis,
        "analytics": {
            "yearly": yearly, "ttm": ttm, "lead_time": lead, "flow": flow,
            "project_health": health, "blockers": blockers,
            "pm_leaderboard": board, "pm_nominations": noms, "top_projects": tops,
        },
    }
