# ProjectNest — Session Handoff / Context

Paste this into a new session to continue instantly. (Conversation language: Uzbek.)

## What this is
**ProjectNest** = a **Portfolio Intelligence Platform** for a Jira **PMD/PMO** portfolio,
built ON TOP of an already-approved "healthcare" dashboard UI.
**RULE #1: the approved dashboard's visual design/layout/colors must not change — only data.**
The user DOES authorize targeted redesigns when explicitly asked (TTM panel, Project Flow,
the Portfolio-Progress panel → now "Delivery Flow", and brand-new pages like Calendar / Risk).
UI is localized **EN / RU / UZ**, light + dark theme.

- Repo: https://github.com/MarufAkhmatov/Dashboard-for-Sigmintation (branch `main`)
- Local: `C:\Users\ASUS\Downloads\DashboardForJiraTasksAndCalendars-main (1)\DashboardForJiraTasksAndCalendars-main`
  (note the OUTER `...main (1)\` folder — the real repo is ONE level inside it.)

## Stack & how to run
- **Frontend**: Vite + React + TS. Built to `dist/` via `npm run build`.
- **Backend**: **Python 3.14 stdlib HTTP server** (`backend/server.py`). Stdlib only + `openpyxl`.
  FastAPI/pydantic do NOT build on 3.14.

### ★ PRODUCTION model (what the user runs day-to-day) — ONE resilient process on :8080
- `backend/server.py` now **serves BOTH** the built SPA (`dist/`) **and** `/api` on a single port.
  Port = env `PN_PORT` (default 8077 for dev; **prod runs PN_PORT=8080**). Same-origin → no proxy needed.
- **Login/session auth** is built into the backend: `/api/login`, `/api/logout`, `/api/me`; all other
  `/api/*` require a valid `pn_session` cookie (HMAC-signed, 30-day). `/api/health` is public; static SPA is public,
  **all DATA is gated**. Creds in `storage/auth.json` (read fresh each login → edit takes effect immediately).
  - **Default login: `admin` / `ProjectNest2026!`**. Secret in `storage/.auth_secret`.
- **Resilience (self-healing)**: `serve-prod.ps1` is a watchdog loop — every 15s, if :8080 is down it
  restarts `python backend/server.py` (PN_PORT=8080), hidden. (Verified: kill → revives in seconds.)
- **Auto-start**: `install-autostart.ps1` (already run once) registered a **Scheduled Task "ProjectNest"**
  (trigger=AtLogOn, RestartCount 999, unlimited time) + a **Desktop icon "ProjectNest"** (runs `open-app.ps1`
  → ensures server up, opens browser) + a Startup-folder shortcut (fallback). Survives crashes & reboots.
- Frontend gate: `src/app/components/AuthGate.tsx` wraps the app (between I18nProvider and PortfolioProvider in
  `src/main.tsx`); checks `/api/me`, shows the login screen until authed.

### Dev model (for coding) — still works
- `npm run dev` → http://localhost:5173 (Vite, HMR), proxies `/api` → :8077 (`vite.config.ts`, honors PN_PORT/PORT env).
- For a dev backend: `python backend/server.py` (defaults to 8077). It also requires login now.

### Access URLs
- PC: **http://localhost:8080** (prod). Dev: http://localhost:5173.
- Phone (same Wi-Fi): **http://<LAN-IP>:8080** (firewall rule "ProjectNest 8080" added, all profiles).
  LAN IP changes (was 192.168.1.10 / .2.156 / .1.12) — check with `Get-NetIPAddress`.
- Phone (anywhere, HTTPS, secure): `start-tunnel.ps1` → cloudflared → `https://<name>.trycloudflare.com`
  (points at :8080; protected by the login — verified `/api/*` returns 401 without session). URL changes each run.

### Docker
- `docker-compose.app.yml` exists but is the OLD approach (no auth, old build) — it was **stopped/removed**
  this session because it occupied :8080. The single-process watchdog model replaces it (and keeps Temur's
  Claude CLI, which Docker could not). Don't restart Docker on 8080.

## Data reality (IMPORTANT)
Daily Jira exports; PMD + PMO kept separate then **merged**. Files:
1. **CSV "all fields"** (per project) — rich (real Resolution Date, PM, comments, links, regulator/division/scoring).
   Person fields are emails → prettified ("m.axmatov@…" → "M. Axmatov"). Key col = `Ключ проблемы`; custom fields wrapped `Пользовательское поле (X)`.
2. **HTML "Printable"** — real display names (planned CSV+HTML name merge).
3. **History (Current fields) XLSX** — the **changelog** (status transitions) → EXACT TTM.
- Daily ingest: PMD CSV (replace) → PMO CSV (merge) → PMD History (enrich) → PMO History (enrich). `is_history_file()` auto-routes.
- Current loaded: **~1410 issues, 137 epics, ~947 resolved w/ changelog**.
- **After parser/normalize change → DELETE `storage/temp/cache/*.json` then re-ingest** (cache by file sha).
- **After ANY backend code change → restart the server** (watchdog auto-restarts only on crash, not on code edit;
  kill the :8080 python and the watchdog relaunches the new code within 15s, OR `Stop/Start-ScheduledTask ProjectNest`).

## Backend layout (`backend/app/`)
- `parser.py` — CSV/XLSX/HTML + `is_history_file()` + `parse_jira_history()` (changelog → per-issue `[{status,entered,exited,days}]`).
- `normalize.py` — aliases EN/RU/UZ, status fix, strips custom-field wrapper, email→name, clean comments. Issue fields:
  `key, project, type, is_epic, status, status_group, summary, pm, assignee, reporter, created, resolved, due,
  epic_key, story_points, priority, project_type, regulator, division, scoring, quarterly_status, comments, links, history`.
  (NO release/fix-version, team, capacity, planned-vs-forecast, or budget fields — see "NEXT".)
- `config.py` — status taxonomy (NEED INFO is its own status). DISCOVERY/DELIVERY/DONE/DECLINED sets. Has ROOT/STORAGE paths.
- `metrics/engines.py` — pure fns. Key ones:
  - `issue_ttm` (phase-based Discovery/Delivery/Total/Lead, exact from changelog, DONE-only, rounded), `ttm_analysis`.
  - `portfolio_kpis`, `epic_status_flow` (Project Flow donut), `completion_series`, `project_health` (0–100 score
    → Excellent/Good/Warning/Critical), `blocker_engine`, `pm_leaderboard(_period)`, `filter_issues` (drill-down).
  - **`calendar_events(issues, mode, start, end, itype, pm)`** — resolved/created events for the Calendar.
  - **`risk_insights(issues)`** — Risk Dashboard feed: rollup KPIs (at_risk/critical/delayed/overdue/blocked/wip,
    OPEN-only so each = its click-through list), health_buckets (green/yellow/red), register, PM×risk heatmap,
    blocked (+is_epic), aging (longest in current status), structured `insights`, and **`cohorts`** (per-KPI issue
    lists each with a `reason` so the KPI cards drill into "why it's here").
  - **`flow_balance(issues, granularity)`** — Created vs Resolved per period + summary {ratio=resolved/created %, backlog_delta}.
- `aggregate.py` — builds the `widgets` payload.
- `aria.py` — **Temur** AI. Provider order **Anthropic API (if ANTHROPIC_API_KEY) → Claude Code CLI → Ollama → grounded**.
  `_claude_cli` runs `claude -p` headless (prompt via STDIN, `--model haiku`, MCP disabled). `ask(q, payload, lang, scope, context)`:
  - **scope="page" + context** → answers ONLY from the on-screen popup data (returns grounded_on="page").
  - else → detect_action (open_ttm/drill/open_issue/open_dq, NL EN/RU/UZ) + teach intent + grounded/LLM answer.
  - summarize_issue, recommend_issue, similar_issues (TF-IDF), recommend_from_description.
- `storage.py` — file-based (`storage/current/dataset.json`); `load_current()` reads fresh each call.

## Key endpoints (proxied via `/api`; require login except health/me/login)
`/api/health`(public) · `/api/me` `/api/login` `/api/logout`(auth) · `/api/dashboard` · `/api/analytics` ·
`/api/ttm` · `/api/issues` (drill) · `/api/issue|issue-summary|issue-recommend` · `/api/pm-leaderboard` ·
`/api/notifications` · `/api/data-quality` · **`/api/calendar?mode=resolved|created`** · **`/api/risk`** ·
**`/api/flow?granularity=month|quarter|year`** · **`/api/epic-quality?project=PMD&days=90`** ·
**`/api/epic-quality-recommend?key=&lang=`** · `/api/analyze`(POST) · `/api/aria`(POST {question,lang,scope,context}).

## Frontend layout (`src/app/`)
- `main.tsx` — providers: Theme → I18n → **AuthGate** → Portfolio → App.
- `App.tsx` — header (logo, lang, theme, upload, celebrations, gear=DQ, bell, avatar) + **top-nav page switch**
  `view = "dashboard" | "calendar" | "risk"` (desktop nav buttons + mobile **hamburger menu** with Dashboard/Calendar/Risk/DQ/Celebrations).
  - Dashboard panels: `WellnessChart` = **Delivery Flow** (Created vs Resolved, ratio headline, Month/Quarter/Year, clickable→drill),
    `TtmComparePanel` (TTM Trend, default Graph + Quarter + all-types/all-years; bars are HORIZONTAL), `PatientFlowChart` (Project Flow spoke-donut + Kanban),
    `BestProjects`, `HealthcareProviders` (PM leaderboard), `AriaPanel` (Temur).
  - **Header KPI metrics** (Total/Completed/Open) use **proportional sparklines**: `filled = round(N·value/total)` bars
    tinted (Total green, Completed green, Open blue), rest grey rgba(255,255,255,0.28); min 1 bar if value>0.
- **`CalendarView.tsx`** — Calendar page: Resolved/Created toggle, Day/Week/Month/Year (default Week), zoom −/+,
  scroll both ways (grids have min-width so they never squish), localized month/weekday names, tickets show a vertical
  "Project/Task" side-label + key + wrapping name, period summary ("this week closed N projects, M tasks", green=resolved/amber=created).
- **`RiskDashboard.tsx`** — Risk page. Portfolio-style header: big white title + subtitle + **6 KPI metrics with
  proportional sparklines** (denominator = 137 total; tint = severity colour). KPI click → **RiskCohortModal** (issues + reason).
  Below: 3-COLUMN flex region that FILLS to the viewport so panel bottoms align (like Portfolio): row1 Register|Aging|Blocked,
  row2 Risk-by-PM | AI-Insights | **Temur**. Each panel has ⓘ (→ RiskMethodologyModal) + ⤢ maximize (→ RiskPanelModal).
  Temur cell floats to a right dock w/ minimize/restore when a popup opens (same as dashboard).
- **Temur scope-choice (global feature)**: when a popup with data is open and you ask Temur, it first asks
  **"This page" vs "Whole portfolio"** (buttons). Page → sends the popup's data as `context` (scope=page). Popups publish
  their data via `setPageContext` in `popup.ts` (DrillDownHost, RiskCohortModal, IssueDetailHost).
- `popup.ts` — global popup state: `usePopupOpen`, `usePopupOpenSignal`, minimize (`useTemurMinimized`/`setTemurMinimized`),
  `useTemurBesidePad` (shifts centered modals left to sit beside the floating Temur dock; returns full `padding` shorthand to
  avoid React shorthand/longhand warning), and `setPageContext`/`usePageContext`.
- Modals all `usePopupOpenSignal` + `...useTemurBesidePad()` on their backdrop so Temur floats on top (z 480; IssueDetail 450).
- `status.ts`, `drill.ts` (openDrill), `issue.ts` (openIssue), `i18n.tsx` (+`tf()` interp), `theme.tsx`, `useBreakpoint.ts`.

## DONE 2026-06-16 session
- **New-epic Quality Alert (Temur)**: header ⚠️ button (badge = flagged count; in hamburger on mobile/tablet)
  opens `EpicQualityModal`. Temur analyzes **newly-created PMD epics** (created within `window_days`, default 90,
  of the latest epic-creation date) and flags ones with unclear/junk titles, missing/placeholder/link-only/short
  descriptions, or unfilled required fields (PM, customer division, due, scoring, project type). Each flag is a
  structured `{field,type,severity}` (high/med/low) → localized on the FE; epic gets a 0–100 quality score + severity.
  "Don't cry wolf": only flagged if any high/med problem OR ≥2 low. Per-epic **Temur recommendation** = ready-to-send,
  problem-specific message the PM forwards to the **author (reporter)** — LLM (Claude CLI/API, cached) → multilingual
  grounded fallback. Copy button. Backend: `engines.epic_quality()`+`epic_problems()`, `aria.recommend_epic_quality()`.
  Endpoints `/api/epic-quality` (fast list) + `/api/epic-quality-recommend?key=&lang=` (lazy, per-epic).
  Added a `description` field to `normalize.py` (alias Описание/Описание проекта) → **needed re-ingest** (done).
- **Mobile/tablet chart fix**: Delivery Flow + TTM Trend were blank on mobile — recharts absolute-inset pattern
  collapses to 0 height with only `min-height`. Gave those cards a **definite `height`** (+flex column) in the
  mobile & tablet layouts in `App.tsx`. Data was always loading; only the height was missing.

## DONE earlier session (high level)
- **Calendar page** (resolved/created events, gran filters, zoom/scroll, vertical Project/Task labels, period summary).
- **Risk Dashboard** (separate page; rollup KPIs, health bar, risk register, PM×risk heatmap, aging, blocked, AI insights;
  methodology modal; KPI→cohort drill with reasons; maximize each panel; Temur on the page + floats on popups).
- **Delivery Flow** panel replaced the useless "Portfolio Progress" (Created vs Resolved, flow ratio, backlog delta).
- **Proportional sparklines** on both dashboards' KPI metrics.
- **Temur context-aware scope choice** (page vs global).
- **Production hardening**: single-process server (SPA+API on :8080), **login auth**, self-healing **watchdog**,
  **Scheduled Task** autostart + desktop icon, firewall for 8080, secure tunnel.
- Mobile: hamburger nav, calendar/risk usable, Temur reachable above popups.

## NEXT (decided earlier, awaiting files/data)
- **Product Teams TTM** — team = Jira project key, separate storage namespace, Classic⇄Product toggle on TTM panel.
- **Release / Resource dashboards** — NOT built (no release/fix-version or capacity data; user confirmed "hozircha yo'q").
- CSV+HTML hybrid name merge; Postgres + RBAC/SSO (enterprise scale) — later.
- Gap-analysis vs enterprise TZ is in `~/.claude/plans/agar-maqsad-ai-agent-structured-octopus.md`.

## Gotchas
- Python 3.14: stdlib only (+openpyxl). No pandas/pydantic/FastAPI.
- After parser/normalize change → clear `storage/temp/cache/*.json` AND re-ingest.
- After backend code change → restart server (kill :8080 python; watchdog relaunches in ≤15s, or restart the task).
- Claude CLI: prompt via STDIN; `--strict-mcp-config --mcp-config '{"mcpServers":{}}'`. Temur needs the user's host login
  → run the server as the user (Scheduled Task AtLogOn, NOT as SYSTEM, NOT in Docker).
- `recharts` inside a flex item: wrap ResponsiveContainer in `position:absolute; inset:0` (else 0 height).
- Preview/screenshot MCP tooling is flaky (0×0 viewport, timeouts, "Promise was collected"); verify via DOM `preview_eval`
  and `preview_network`. The MCP preview server stops often; the watchdog's :8080 server is the persistent one.
- Don't mix CSS `padding` shorthand with `paddingRight` longhand in React (warning) — `useTemurBesidePad` returns full `padding`.
- Login cookie is same-origin; fetches use default credentials (works on localhost, LAN, tunnel). Change creds in `storage/auth.json`.
