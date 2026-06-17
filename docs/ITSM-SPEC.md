# ITSM-SLA — Requirements Spec

Captured from the project owner. This drives the data model, ingest path, and
panel design. Update this file as decisions evolve.

## Data scale

- **~3 Service Desk projects** in Jira (each = its own portfolio bucket).
- **~100 IT services** total ("custom requests" — the Jira request-type granularity).
- Services are **grouped** — each group contains several services.
- Daily upload model: **HTML + CSV + History XLSX per Service Desk**, separately
  (so 9 files in a typical day for 3 Service Desks).

## Source-of-truth fields (CRITICAL)

The Russian-language Jira fields are the configured ones. **The English fields
are NOT configured and must be ignored when both are present.**

| Field | Russian name (use this) | English (ignore) |
|---|---|---|
| Reaction SLA (first response) | **Время реакции** | Time to first response |
| Resolution SLA (closure) | **Время решения** | Time to resolution |

Both SLA fields typically carry: target (e.g. `4h`), elapsed, breached/met flag.
The parser must extract all three from the Russian column even if the English
header also exists.

## Resource accounting

- **Resource = unique assignee.** A Service Desk's "resource count" = the
  number of distinct `Assignee` values across its issues in the period.
- Per Service Desk + per custom request type: list assignees by name AND
  total count.

## Required reports (per Service Desk and overall)

1. **Request volume** — request count per IT-service (custom request type),
   split by status: `Done` / `In Progress` / `To Do`. Show as a matrix
   (service-type × status) plus rollups per group.
2. **Reaction SLA performance** — % of issues that met `Время реакции` target,
   per Service Desk, per service-type, per group; trend by Year / Quarter / Month.
3. **Resolution SLA performance** — same shape, against `Время решения`.
4. **SLA breach drill-down** — list of issues that breached either SLA, with
   breach amount (target vs actual), assignee, age.
5. **Resource utilization** — per Service Desk and per custom request type:
   distinct assignee count + named list of assignees.
6. **Total SLA pass-rate** (combined reaction + resolution) — single headline
   number per period, with Y/Q/M filters.

## Upload model

Same per-file detection as ProjectNest (`is_history_file` for XLSX history),
but each upload is tagged with its **Service Desk project key** (e.g. `SD-IT`,
`SD-HR`, …) so the dashboard can split by it. Mode rules:

- First issue file (CSV/HTML) of a Service Desk → `replace` for that key,
  or `merge` if the dashboard is already populated.
- Subsequent issue files → `merge`.
- History XLSX → enriches existing issues for that Service Desk.

The batch-upload UI we just built in ProjectNest carries over: drop 9 files at
once, FE sorts them (issue exports first by project key, then History XLSX
last) and uploads sequentially.

## Out of scope (for now)

- Top Projects panel, Risk Dashboard, Calendar, Best Projects, Healthcare
  Providers, Project Flow donut, Delivery Flow — these are PMD/PMO portfolio
  concepts and don't apply to ITSM. Decision pending: delete vs hide vs repurpose.
- Temur/Aria AI assistant — keep, but reconfigure prompts toward SLA queries.
- Epic Quality Alert — does not apply.

## Open questions

- Are SLA targets uniform per request-type, or per-issue overrides exist?
- "Group" of services — is the grouping stored in a Jira custom field, or
  inferred from the request-type name? (Sample export will answer.)
- Should breached SLA still be counted as "resolved on time" if the resolution
  later met a new target? (i.e. multiple SLA cycles per ticket.)

## Confirmed schema (from 2026-06-17 sample)

### Primary file: Jira Issue Navigator export `.xls` (BIFF / OLE Compound)

**One sheet, 12 columns**, ~4,353 rows in the sample:

| # | Column (RU)                     | Notes |
|---|---|---|
| 0 | Приоритет                       | Priority |
| 1 | Тип                             | Issue type — `Service Request`, `Change`, `Задача`, `Problem`, `Epic` |
| 2 | Код                             | Issue key (e.g. `ITSM-4433`) |
| 3 | **Customer Request Type**       | The 84-value request-type catalogue (the "IT-service" granularity) |
| 4 | Тема                            | Summary |
| 5 | **Исполнитель**                 | Assignee — the RESOURCE field |
| 6 | Статус                          | Status — `Закрыт` (closed), `Решенные`, `Need Info`, `Открытый`, `В разработкe`, `Переоткрыт`, `Приемка.`, `В работе`, `Rejected` |
| 7 | SLA Время реакции (минуты)      | Elapsed reaction time in MINUTES (integer) |
| 8 | SLA Время решения (минуты)      | Elapsed resolution time in MINUTES (integer) |
| 9 | **SLA общий**                   | Free-text rollup: `"Время реакции: 39s (left 2h 59m 20s) ✅ runningВремя решения: 25m 33s (left 1h 34m 26s) ✅ ..."` — contains emoji-flagged status (`✅` met / `❌` breached) AND the SLA target via the "left" remainder |
| 10 | Время реакции                  | REMAINING reaction time, RU-formatted ("2ч 59м") |
| 11 | Время решения                  | REMAINING resolution time, RU-formatted ("1ч 34м") |

**Distinct in sample:** 84 customer-request types, 39 assignees, 9 statuses,
5 issue types.

> Backend impact: this is `.xls` (BIFF, magic `D0CF11E0…`) — NOT `.xlsx`. The
> ProjectNest parser only supports `.csv .xlsx .xlsm .html .htm`. Add `xlrd`
> (>=2.0, .xls-only) and a new `_parse_xls` path in `backend/app/parser.py`.

### Secondary file: status history `.xlsx` (Jira Excel CSV all-fields with changelog)

19,619 transition rows in the sample. Columns: `Код`, `Статус`, `Создано`,
`Обновленo`, `Parent key`, `Comments`, `Transitions`. Same shape as the
ProjectNest history XLSX path (`parse_jira_history`). Optional — enriches TTM /
time-in-status but is NOT required for SLA pass-rate reporting.

## SLA parsing strategy

The truthy SLA pass/fail lives in **column 9 (`SLA общий`)** as RU text + emoji.
Plan:

```
"Время реакции: <elapsed> (left <remaining>) <flag> <state>"
"Время решения: <elapsed> (left <remaining>) <flag> <state>"
```

Where `<flag>` ∈ {`✅`, `❌`} and `<state>` ∈ {`running`, `met`, `breached`, …}.

Parse rule:
- Reaction **met**   = `Время реакции:` segment contains `✅` AND state is `met` / `paused` / closed.
- Reaction **breached** = the segment contains `❌` OR `breached`.
- Same for Resolution from the `Время решения:` segment.
- For OPEN tickets where the SLA is still `running` and shows `✅`, we report
  as `on-track` (not yet pass/fail) — surface separately so closed-only stats
  are clean.

Closed tickets where col 9 is absent fall back to the integer elapsed (col 7/8)
vs. a target derived from the request-type's typical target (median across that
request-type's other tickets where we know the target). Surface as "estimated".

## Resource (assignee) accounting

- Per Service Desk: distinct count of `Исполнитель` over the period.
- Per Customer Request Type: distinct assignees + named list (top 10 by ticket count).
- Workload per assignee = ticket count split by SLA met / breached.

## Status taxonomy (ITSM-specific)

| Canonical | Source RU values |
|---|---|
| OPEN          | Открытый, Переоткрыт |
| IN PROGRESS   | В работе, В разработкe |
| NEED INFO     | Need Info |
| ACCEPTANCE    | Приемка. |
| RESOLVED      | Решенные |
| CLOSED        | Закрыт |
| REJECTED      | Rejected |

Status group for ITSM:
- **active**: OPEN, IN PROGRESS, NEED INFO, ACCEPTANCE
- **done**:   RESOLVED, CLOSED
- **dropped**: REJECTED

## Next implementation steps

1. `backend/requirements.txt` → add `xlrd>=2.0,<3`.
2. `backend/app/parser.py` → add `_parse_xls` for BIFF + route `.xls` files to it.
3. `backend/app/normalize.py` → ITSM field aliases (`Код`, `Customer Request Type`,
   `Исполнитель`, `SLA Время реакции (минуты)`, `SLA Время решения (минуты)`,
   `SLA общий`, `Время реакции`, `Время решения`), new canonical statuses.
4. `backend/app/metrics/sla.py` → request-volume matrix, SLA pass-rate engine,
   resource-utilization engine.
5. `backend/app/aggregate.py` → build new widgets payload (request_volume,
   sla_summary, sla_by_period, resource_utilization).
6. Frontend → strip portfolio panels (TTM/Risk/Calendar/etc.), add ITSM panels:
   `RequestVolume`, `SLAPerformance`, `ResourceUtilization`, `SLABreaches`.
