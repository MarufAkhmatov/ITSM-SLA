"""Run the full calculation pipeline on the sample export (stdlib only)."""
import sys
import json
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))  # backend/

from app import parser, normalize, aggregate  # noqa: E402

CSV = pathlib.Path(__file__).resolve().parents[2] / "storage" / "temp" / "sample_jira.csv"

rows = parser.parse_file(CSV)
issues = normalize.normalize_rows(rows)
payload = aggregate.build(issues)

print("rows:", len(rows), "| issues:", len(issues),
      "| epics:", payload["kpis"]["total_epics"])
print("\n--- KPIs ---")
print(json.dumps(payload["kpis"], indent=2))
print("\n--- Widget: header metrics ---")
print(json.dumps(payload["widgets"]["header_metrics"], indent=2))
print("\n--- Widget: project_flow ---")
print(json.dumps(payload["widgets"]["project_flow"], indent=2))
print("\n--- Widget: top_projects ---")
print(json.dumps(payload["widgets"]["top_projects"], indent=2))
print("\n--- TTM overall ---")
print(json.dumps(payload["analytics"]["ttm"]["overall"], indent=2))
print("\n--- Lead time ---")
print(json.dumps({k: v for k, v in payload["analytics"]["lead_time"].items() if k != "trend"}, indent=2))
print("\n--- PM leaderboard (top 3) ---")
print(json.dumps(payload["analytics"]["pm_leaderboard"][:3], indent=2))
print("\n--- PM nominations ---")
print(json.dumps(payload["analytics"]["pm_nominations"], indent=2))
print("\n--- Blockers summary ---")
b = payload["analytics"]["blockers"]
print("total_blocked:", b["total_blocked"], "| edges:", len(b["edges"]),
      "| critical_path:", b["critical_path"][:5])
print("\n--- Yearly completed ---")
print(json.dumps(payload["analytics"]["yearly"]["yearly"], indent=2))
