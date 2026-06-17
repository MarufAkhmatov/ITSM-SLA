"""Aggregate all engines into (a) the widget payload that feeds the existing
dashboard widgets 1:1, and (b) the full analytics payload."""
import collections
from .metrics import engines as E


def _last(seq, n):
    return seq[-n:] if len(seq) >= n else seq


def _sla_summary(issues: list[dict]) -> dict:
    """Boolean pass-rate over issues that actually have an ITSM SLA signal.
    `met` = True passed, False breached, None still running / no signal."""
    react_met = react_breach = resol_met = resol_breach = 0
    react_running = resol_running = 0
    total_itsm = 0
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

    def pct(met, breach):
        n = met + breach
        return round(100.0 * met / n, 1) if n else None

    return {
        "total_itsm_issues": total_itsm,
        "distinct_request_types": len(crt_counts),
        "distinct_assignees": len(assignees_set),
        "reaction": {
            "met": react_met, "breached": react_breach, "running": react_running,
            "pass_rate_pct": pct(react_met, react_breach),
        },
        "resolution": {
            "met": resol_met, "breached": resol_breach, "running": resol_running,
            "pass_rate_pct": pct(resol_met, resol_breach),
        },
        "overall_pass_rate_pct": pct(react_met + resol_met, react_breach + resol_breach),
        "top_request_types": [
            {"name": k, "count": v} for k, v in crt_counts.most_common(10)
        ],
    }


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

    # ITSM SLA summary — surfaces a basic pass/breach KPI on the dashboard.
    # Only counts issues that actually have a Customer Request Type (i.e. ITSM
    # Service Desk tickets); portfolio data passes through with empty stats.
    sla_summary = _sla_summary(issues)

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
        },
        "kpis": kpis,
        "analytics": {
            "yearly": yearly, "ttm": ttm, "lead_time": lead, "flow": flow,
            "project_health": health, "blockers": blockers,
            "pm_leaderboard": board, "pm_nominations": noms, "top_projects": tops,
        },
    }
