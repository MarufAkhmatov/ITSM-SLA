# SLANEST (ITSM-SLA) — Session Handoff / Context

Paste into a new session to continue instantly. (Conversation language: Uzbek/Russian.)

## What this is
**SLANEST** = an **IT-Service-Management / SLA dashboard** for Jira **Service Desk**
projects, cloned from the ProjectNest portfolio dashboard and reworked. Tracks
request volume, **reaction & resolution SLA (Plan vs Actual)**, and resource
(assignee) load across multiple Service Desks.

- Repo: https://github.com/MarufAkhmatov/ITSM-SLA (branch `main`) — pushed.
- Local: `C:\Users\ASUS\Downloads\ITSM`
- Login: **`Admin` / `Admin 2026`** (plaintext in `storage/auth.json`, read fresh each login).

## Stack & run
- **Frontend**: Vite + React + TS, EN/RU/UZ i18n, light/dark. Build → `dist/`.
- **Backend**: Python 3.14 **stdlib** HTTP server (`backend/server.py`) + `openpyxl` + **`xlrd`** (for .xls).
  Serves the built SPA **and** `/api` on ONE port. `PN_PORT` env (prod = **8090**).
- **PRODUCTION = Docker** now (was a Python watchdog):
  - `Dockerfile` (multi-stage: build SPA → serve from python:3.12-slim on 8090),
    `docker-compose.slanest.yml` (volume `./storage`, `restart: unless-stopped`).
  - **Desktop icon `SLANEST.lnk`** → `open-app-docker.ps1` (starts Docker Desktop if
    down → `docker compose up -d` → opens http://localhost:8090).
  - Scheduled task **`SLANEST-Docker`** (AtLogOn) runs the launcher. Old Python-watchdog
    task **`SLANEST`** is **Disabled** (no :8090 contention). `serve-prod.ps1` still works as a fallback.
- **Mobile (same Wi-Fi)**: server binds `0.0.0.0:8090`; firewall rule "SLANEST 8090".
  Phone → `http://<LAN-IP>:8090` (LAN IP changes — `Get-NetIPAddress -AddressFamily IPv4 | ? PrefixOrigin -eq Dhcp`).
- Dev: `npm run dev` (Vite, proxies /api → :8077); `PN_PORT=8077 python backend/server.py`.
- CI: `.github/workflows/ci.yml` (build SPA, py_compile, boot + /api/health).

## Data reality (IMPORTANT)
Daily Jira Service-Desk **Issue Navigator `.xls`** exports, one per Service Desk
(e.g. ITSM, AP). Current data: **ITSM (4373) + AP (12220) = 16,593 issues**, dated 2025–2026.

Key `.xls` columns (RU is the configured one — ignore the English SLA fields):
`Приоритет, Код, Customer Request Type, Тема, Исполнитель, Статус, Создано,
Дата решения, Время реакции (remaining), Время решения (remaining),
SLA Время реакции (минуты), SLA Время решения (минуты), SLA общий`.

- **`Создано` / `Дата решения`** are Excel **DATE serial cells** → `parser._parse_xls`
  converts them with `xlrd.xldate_as_datetime`. (Bug earlier: read as plain numbers and
  dropped — fixed. This powers all date features: period filter, SLA trend, calendars.)
- **SLA semantics**: `SLA Время X (минуты)` + `SLA общий` text give **elapsed (Fakt)** and
  **left/remaining**. **Plan = elapsed + left**. `SLA общий` carries ✅/❌ → met/breached.
  (`Время реакции/решения` columns = REMAINING, not spent.)
- After parser/normalize change → clear `storage/temp/cache/*.json`, re-ingest, restart container.
- Only **Epic / Task / New Feature / Service Request / Change / Problem** types count
  (`config.ALLOWED_ISSUE_TYPES` whitelist); others dropped (audited in DQ modal).

## Backend layout (`backend/app/`)
- `parser.py` — CSV/XLSX/**XLS**/HTML. `_parse_xls` (date-cell aware), `parse_jira_history`.
- `normalize.py` — RU/EN/UZ aliases incl. ITSM fields + `parse_sla_overall()` (Plan/Fakt/met).
  Homoglyph (Кир↔Lat) status fix, `DEAD_STATUSES`, status audit.
- `config.py` — status taxonomy + ITSM RU statuses, `ALLOWED_ISSUE_TYPES`, `DEAD_*`.
- `metrics/itsm.py` — ITSM engines: `resource_utilization`, `request_type_usage`,
  `resource_calendar`, `request_type_dynamics`, **`sla_trend`** (Plan/Avg/Max per period),
  **`search`** (fuzzy, difflib). `_period_keys` = day/week/month/quarter/year.
- `aggregate.py` — builds `widgets`: sla_summary, sla_by_request_type (+`fakt_max`),
  resource_utilization, request_type_usage, resource_calendar, request_type_dynamics, sla_trend.
- `server.py` — `_payload_for(project, period, value)` filters by service-desk **and** time
  period (cached); `_available_periods`.

## Key endpoints (login except health/me/login)
`/api/health` `/api/me` `/api/login` `/api/logout` · `/api/projects` (desks + periods) ·
`/api/dashboard?project=&period=&value=` · `/api/search?q=&project=` ·
`/api/status-audit` `/api/data-quality` `/api/issue` · `/api/aria`(POST, Amir).

## Frontend layout (`src/app/`)
- `main.tsx` — Theme → I18n → AuthGate → Portfolio → App.
- `portfolio.tsx` — global state: `project/projects/setProject`, `period/periodValue/periods/setPeriod`,
  `search`. `data.widgets` holds everything.
- `App.tsx` — header (SLANEST logo, lang, theme, upload, gear=DQ, bell, avatar, **GlobalSearch**),
  top-nav **Dashboard / IT services / Dynamics**. Shared header per view: **[title | ProjectDropdown]**
  / **[subtitle | TimeFilter]**. Desktop = **one-page, no scroll** (`overflowY hidden`, panels flex +
  internal scroll); mobile scrolls.
  - **Dashboard**: 4 SLA KPI cards (Plan→Fakt) → row1 `[SLA-by-request-type table | SlaChart]`,
    row2 `[Resource Utilization | ResourceChart | Amir docked]`.
  - **Maximize ⤢** on SLA + Resource → `PanelMaximizeModal` (minimize button in its own top bar,
    never overlaps the panel search). avg/max toggle on SLA table.
  - **IT services** (`RequestTypeUsage`): KPIs + Most/Least/All tables each with a chart, one-page
    (internal scroll), ⓘ methodology, clickable rows → detail modal, ⤢ maximize.
  - **Dynamics** (`RequestTypeDynamics`): request-type tiles + trend arrows; uses ONLY the global
    Period filter (its own toggle was removed). Tiles scroll internally.
- `components/PanelCharts.tsx` — **SlaChart** = TTM-Trend-style gradient **AreaChart**: with dates,
  x-axis = periods (Year/Quarter/Month toggle) from `sla_trend`, 3 areas Plan/Avg/Max; else per-IT-service.
- `TimeFilter.tsx` (period bar, hint above buttons), `ProjectDropdown.tsx` (collapsible desk selector),
  `GlobalSearch.tsx` (debounced fuzzy dropdown).
- **Amir** (was Temur) = `AriaPanel`: docked bottom-right on desktop dashboard, floating button
  elsewhere/mobile/over popups. Wake word "Amir"/"Амир". Backend `aria.ASSISTANT_NAME="Amir"`.

## Done this project (high level)
.xls parser (+dates) → SLA Plan/Fakt/Max → SLA-by-request-type + drill → removed portfolio panels →
Resource Utilization (+staff calendar popup) → request-type usage (most/least/all) → Dynamics tiles →
**service-desk filter** (All/ITSM/AP) → SLANEST + "IT услуги" rename → **global time filter** →
**chart panels** beside every panel → maximize popups + methodology + clickable → **avg/max** toggle →
**Amir** (rename, all pages, voice) → **fuzzy search** → **SLA time-trend area chart** (sla_trend) →
one-page layouts → **Docker deploy** + desktop icon + autostart.

## Gotchas
- Python 3.14: stdlib only (+openpyxl, +xlrd). No pandas/FastAPI.
- `.xls` dates are serial cells — use `xlrd.xldate_as_datetime` (handled in `_parse_xls`).
- After backend change → rebuild payload (`aggregate.build`) or re-ingest; Docker rebuild:
  `docker compose -f docker-compose.slanest.yml up -d --build`. Restart container to clear cache.
- Preview MCP runs the OLD ProjectNest folder's dev server; verify ITSM by cross-origin nav to
  `http://localhost:8090` (flaky — screenshots time out; use `preview_eval` DOM checks).
- Two scheduled tasks: `SLANEST` (Python watchdog, **Disabled**), `SLANEST-Docker` (active).

## NEXT / open
- AP vs ITSM SLA targets may differ — confirm per-request-type SLA config if needed.
- Amir voice/self-learning is best-effort (not "100%"); could deepen action intents.
- True multi-desk comparison views; per-period drilldowns; SLA breach register page.
