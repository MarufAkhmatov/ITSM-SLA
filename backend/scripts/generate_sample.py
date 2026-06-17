"""Generate a realistic synthetic Jira portfolio export (CSV) for testing.

Includes Epics (portfolio projects) + Tasks/New Features across projects PMD & PMO,
with PMs, resolution dates spanning 2022-2026, full status history (JSON column) and
blocker links so every engine (TTM / Lead Time / Flow / Blockers / PM) is exercised.
"""
import csv
import json
import random
import datetime as dt
from pathlib import Path

random.seed(7)
OUT = Path(__file__).resolve().parents[2] / "storage" / "temp" / "sample_jira.csv"
OUT.parent.mkdir(parents=True, exist_ok=True)

PMS = ["Aziz Karimov", "Dilnoza Yusupova", "Bobur Aliyev", "Kamola Saidova",
       "Jasur Tursunov", "Nigora Rashidova"]
PROJECTS = ["PMD", "PMO"]
DISCOVERY = ["INITIATION", "ANALYSIS", "ARCHITECTURE REVIEW", "VALIDATION"]
DELIVERY = ["IN PROGRESS", "TESTING", "PILOT IO", "DONE"]
OPEN_END = ["VALIDATION", "ANALYSIS", "IN PROGRESS", "TESTING", "PILOT IO",
            "ARCHITECTURE REVIEW", "INITIATION"]


def history(start: dt.datetime, complete: bool):
    seq = DISCOVERY + DELIVERY if complete else \
        DISCOVERY[:random.randint(1, 4)] + (DELIVERY[:random.randint(0, 3)])
    if not seq:
        seq = ["INITIATION"]
    evts, t = [], start
    for st in seq:
        dur = random.randint(2, 45)
        ent = t
        ext = t + dt.timedelta(days=dur)
        evts.append({"status": st, "entered": ent.isoformat(), "exited": ext.isoformat()})
        t = ext
    resolved = None
    if complete:
        resolved = evts[-1]["entered"]  # entry into DONE
        evts[-1]["exited"] = None
    return evts, seq[-1], resolved


def main():
    rows = []
    n_epic = 28
    for p in range(n_epic):
        proj = random.choice(PROJECTS)
        pm = random.choice(PMS)
        complete = random.random() < 0.6
        declined = (not complete) and random.random() < 0.15
        start = dt.datetime(random.randint(2022, 2025), random.randint(1, 12), random.randint(1, 28))
        evts, status, resolved = history(start, complete)
        if declined:
            status = "DECLINED"
        key = f"{proj}-{100 + p}"
        rows.append({
            "Issue key": key, "Issue Type": "Epic", "Status": status,
            "Summary": f"Portfolio Project {key}", "Assignee": pm, "PM": pm, "Reporter": "PMO Office",
            "Created": start.isoformat(), "Resolved": resolved or "",
            "Due Date": (start + dt.timedelta(days=random.randint(120, 400))).isoformat(),
            "Project": proj, "Epic Link": "", "Story Points": random.choice([8, 13, 21, 34]),
            "Status History": json.dumps(evts), "Blocks": "",
        })
        # children
        for c in range(random.randint(2, 6)):
            ctype = random.choice(["Task", "New Feature"])
            ccomplete = complete or random.random() < 0.5
            cstart = start + dt.timedelta(days=random.randint(0, 30))
            cev, cstatus, cres = history(cstart, ccomplete)
            ckey = f"{proj}-{500 + p * 10 + c}"
            blocks = ""
            if random.random() < 0.18:
                blocks = f"{proj}-{500 + p * 10 + (c + 1)}"
            rows.append({
                "Issue key": ckey, "Issue Type": ctype, "Status": cstatus,
                "Summary": f"{ctype} for {key}", "Assignee": pm, "PM": pm, "Reporter": pm,
                "Created": cstart.isoformat(), "Resolved": cres or "",
                "Due Date": (cstart + dt.timedelta(days=random.randint(20, 120))).isoformat(),
                "Project": proj, "Epic Link": key, "Story Points": random.choice([1, 2, 3, 5, 8]),
                "Status History": json.dumps(cev), "Blocks": blocks,
            })

    cols = list(rows[0].keys())
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows -> {OUT}")


if __name__ == "__main__":
    main()
