# Portfolio Intelligence Platform

Transforms the approved CareNest dashboard UI into a **Jira Portfolio Intelligence Platform**
for projects **PMD** & **PMO**. The frontend visual design is unchanged — only the data
shown in each widget is now **calculated from uploaded Jira exports**.

## Architecture

```
Browser (Vite/React, unchanged UI)
        │  fetch /api/dashboard, POST /api/upload, POST /api/aria
        ▼
Backend  (backend/server.py  — stdlib, runnable now)
         (backend/app/main.py — FastAPI, production entrypoint)
  parser → normalize → engines → aggregate → storage(current/archive)
        ▼
Storage  /storage/current  (active dataset)   /storage/archive (previous versions)
Database /database/schema.sql (PostgreSQL production target)
AI       ARIA — local (Ollama) + RAG (ChromaDB), rule-based fallback
```

## Run locally (no dependencies needed for CSV)

```bash
# 1) backend
cd backend
python scripts/generate_sample.py     # optional: synthetic Jira export
python server.py                      # http://localhost:8077  (auto-seeds sample)

# 2) frontend (existing Vite app)
npm install
npm run dev                           # http://localhost:5173
```

Open http://localhost:5173 → the dashboard loads real portfolio metrics.
Click the **upload** button (top-right, green dot) to upload a Jira **CSV / XLSX / HTML**
export — it is parsed, normalized, the previous dataset is archived, and the dashboard
refreshes automatically to the latest upload.

### Production stack (Docker)
```bash
docker compose up        # postgres + chromadb + ollama + FastAPI backend + frontend
```

## Widget → metric mapping (design unchanged)
| Widget (position kept) | Portfolio metric |
|---|---|
| Header KPI 1/2/3 | Total Projects / Completed / Blocked-Critical |
| Portfolio Progress | Completion % + monthly completed trend |
| TTM Trend | Average Total TTM trend + YoY growth |
| Throughput | Quarterly completed + QoQ growth |
| Flow Efficiency | Portfolio flow efficiency % |
| Project Flow (donut) | Completed / Open / Declined of all epics |
| Top Projects | Top epics by Project Health Score |
| PM Leaderboard (was Healthcare Providers) | PM ranking, score, completed, avg TTM |
| ARIA | Local portfolio AI (Q&A grounded on active dataset) |

## Engines (backend/app/metrics/engines.py)
Portfolio KPIs · Yearly/Quarterly/Monthly analytics (by **Resolution Date**) · YoY/QoQ ·
TTM (Discovery/Delivery/Total; Epic/Task/New Feature; avg/median/p75/p90/min/max; by year/PM/project) ·
Lead Time (first IN PROGRESS → exit TESTING) · Flow Efficiency (active/total) ·
Project Health Score (0–100, Excellent/Good/Warning/Critical) ·
Blocker Detection (dependency graph, critical path, blocked lists, risk) ·
PM Leaderboard + 9 Nominations · Top Projects (10s).

## Implementation status (honest)
**Done & verified now**
- Multi-format ingestion (CSV/XLSX/HTML), normalize, status-history TTM/lead/flow
- All calculation engines (verified on a 149-row synthetic export → 28 epics)
- File storage with auto-archive of previous version; latest = active
- REST API (`/api/upload`, `/api/dashboard`, `/api/analytics`, `/api/aria`, `/api/uploads`)
- Frontend widgets wired to real data (design untouched), 3-language labels, upload button
- ARIA local agent (rule-based grounded answers; Ollama used automatically if running)
- PostgreSQL schema, Docker Compose, GitHub-sync service, config

**Scaffolded / roadmap (Phase 2)**
- Swap file storage → PostgreSQL repository (schema already provided)
- Full enterprise RAG over the 8 knowledge sources via ChromaDB embeddings
- RBAC enforcement (roles defined) + audit-log writes on every mutation
- Migrate FastAPI server as default once Python ≤3.13 / pinned deps are used
  (the stdlib `server.py` is the always-runnable equivalent today)

## Notes
- `backend/server.py` is dependency-free (CSV path) so it runs on this machine's
  Python 3.14 immediately. `backend/app/main.py` is the FastAPI production entrypoint.
- Resolution Date drives all yearly analytics (creation date ignored), per spec.
