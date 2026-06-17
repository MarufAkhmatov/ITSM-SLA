# ITSM-SLA — Jira Service Desk Dashboard

Cloned from ProjectNest (portfolio dashboard) and being adapted into an **IT-Service-Management** dashboard.

## Goal

Track the IT Service Desk projects in Jira and surface:

- **Request volume** per IT-service category and per Service Desk project (Done / In Progress / To Do counts).
- **Reaction SLA** (first-response) and **Resolution SLA** — target vs actual, per request, per category, and overall (pass/fail %).
- **Resource utilization**: how many IT resources each Service Desk project consumes, and per **custom request type** — both as counts and named breakdowns.
- **Time trends**: Year / Quarter / Month rollups of SLA performance and request flow.

Upload model: per Service Desk, separately upload the **HTML**, **CSV** and **History XLSX** exports.

## Stack

Inherited from the ProjectNest base:

- **Frontend**: Vite + React + TS, EN/RU/UZ i18n, light + dark themes.
- **Backend**: Python 3.14 stdlib HTTP server + `openpyxl`. Serves SPA + `/api/*` on a single port.
- **Storage**: file-based JSON; daily ingest with parse cache.

## Running the code

```
npm install
npm run dev                   # vite dev server on http://localhost:5173
python backend/server.py      # API on http://localhost:8077 (default PN_PORT)
```

Production single-process: `PN_PORT=8080 python backend/server.py` (serves built `dist/` + API).

Default login: `admin` / `ProjectNest2026!` (change in `storage/auth.json` after first start).

## Status

Skeleton in place — ITSM-specific metrics engines, ingest paths and panels still to be implemented.
