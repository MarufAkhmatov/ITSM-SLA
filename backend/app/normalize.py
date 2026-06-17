"""Normalize raw Jira rows into a canonical issue model.

Canonical issue keys:
  key, project, type, is_epic, status, status_group, summary,
  pm (assignee), created, resolved, due, epic_key, story_points,
  links: [{type, target}], history: [{status, entered, exited, days}]
"""
import re
import json
import unicodedata
import datetime as dt
from . import config

# Jira "all fields" CSV wraps every custom field as "Пользовательское поле (X)".
# We expose the inner name X so aliases below match it directly.
_CUSTOM_RE = re.compile(r"^пользовательское поле\s*\((.*)\)\s*$")

# ---- flexible column lookup -------------------------------------------------
_ALIASES = {
    "key": ["issue key", "key", "issue id", "id",
            "ключ проблемы", "ключ вопроса", "ключ задачи", "ключ", "код",
            "kalit", "masala kaliti"],
    "type": ["issue type", "type", "issuetype",
             "тип задачи", "тип запроса", "тип", "tur", "masala turi"],
    "status": ["status", "статус", "holat"],
    "summary": ["summary", "title", "тема", "краткое описание", "резюме", "mavzu", "qisqacha"],
    # Full description / project description (used for epic-quality analysis).
    "description": ["описание", "description", "tavsif", "izoh matni",
                    "описание проекта", "project description", "описание проекта/продукта"],
    # PM is graded STRICTLY from the custom "PM" field — never the assignee.
    "pm": ["pm", "project manager", "менеджер проекта", "менеджер", "menejer", "loyiha menejeri"],
    "assignee": ["assignee", "исполнитель", "ответственный", "ijrochi", "mas'ul"],
    "reporter": ["reporter", "creator", "автор", "создатель", "muallif"],
    # NOTE: project/scoring CSV-specific aliases handled below
    "created": ["created", "created date", "creation date",
                "создано", "дата создания", "yaratilgan", "yaratilgan sana"],
    "resolved": ["resolved", "resolution date", "resolutiondate", "done date", "completed",
                 "дата решения", "решено", "дата завершения", "hal qilingan", "yakunlangan sana"],
    "due": ["due date", "duedate", "due", "срок", "срок исполнения", "muddat"],
    "updated": ["updated", "обновлено", "обновленo", "yangilangan", "last updated"],
    "resolution": ["resolution", "решение", "resolution name", "hal"],
    "priority": ["priority", "приоритет", "muhimlik"],
    "project_type": ["project type", "тип проекта", "loyiha turi"],
    "regulator": ["требование регулятора", "regulator requirement", "regulator"],
    "division": ["подразделение заказчика", "customer division", "division", "bo'lim"],
    "scoring": ["скоринг-балл", "скоринг-балл ", "scoring", "score"],
    "quarterly_status": ["квартальный статус", "quarterly status"],
    "project": ["project", "project key", "project name",
                "ключ проекта", "название проекта", "проект", "loyiha"],
    "epic_key": ["epic link", "parent", "parent key", "epic", "parent link",
                 "эпик", "ссылка на эпик", "родитель", "epik"],
    "story_points": ["story points", "story point estimate", "points",
                     "очки истории", "ballar"],
    "history": ["status history", "changelog", "status changes", "history",
                "история статусов", "журнал изменений", "holat tarixi"],
    "url": ["url", "link", "issue url", "ссылка"],
    # ITSM (Jira Service Desk) — Russian fields are the configured ones; the
    # English equivalents (Time to first response / Time to resolution) are NOT
    # configured in this tenant and must be ignored.
    "customer_request_type": ["customer request type", "тип запроса клиента"],
    "sla_reaction_elapsed_min": ["sla время реакции (минуты)", "sla time to first response (minutes)"],
    "sla_resolution_elapsed_min": ["sla время решения (минуты)", "sla time to resolution (minutes)"],
    "sla_overall_text": ["sla общий", "sla overall"],
    "sla_reaction_remaining": ["время реакции", "time to first response"],
    "sla_resolution_remaining": ["время решения", "time to resolution"],
}


def _get(row: dict, field: str) -> str:
    # First pass: real column names (these win on any collision).
    low: dict[str, str] = {}
    for k, v in row.items():
        kl = k.lower().strip()
        if kl not in low:
            low[kl] = v
    # Second pass: expose inner names of "Пользовательское поле (X)" custom fields.
    for k, v in row.items():
        m = _CUSTOM_RE.match(k.lower().strip())
        if m:
            inner = m.group(1).strip()
            if inner and inner not in low:
                low[inner] = v
    for a in _ALIASES.get(field, [field]):
        if a in low and str(low[a]).strip():
            return str(low[a]).strip()
    return ""


_UNASSIGNED = {"не назначен", "не назначено", "unassigned", "none", "", "автоматический"}


def _pretty_person(v: str) -> str:
    """CSV person fields export only the email. Turn 'm.axmatov@bank.uz' into
    'M. Axmatov'. Values that are already display names (no '@') pass through
    unchanged — so an HTML merge can later override with the real full name."""
    v = (v or "").strip()
    if not v or "@" not in v:
        return v
    local = v.split("@")[0]
    parts = [p for p in re.split(r"[._]+", local) if p]
    if not parts:
        return v
    out = []
    for p in parts:
        out.append(p.upper() + "." if len(p) == 1 else p[:1].upper() + p[1:])
    return " ".join(out)


def _clean_comment(s: str) -> str:
    """Strip Jira CSV/wiki noise from a comment body."""
    s = s or ""
    # trailing visibility marker: ";public" / ";internal" (+ trailing ';')
    s = re.sub(r";\s*(public|internal|private|restricted)\s*;*\s*$", "", s, flags=re.I)
    s = s.rstrip(";").strip()
    s = re.sub(r"\[\^([^\]]+)\]", r"📎 \1", s)                     # attachment markup
    s = re.sub(r"_\(\s*[\d.,]+\s*[kKmMgG]?[bB]\s*\)_", "", s)      # size annotation
    s = re.sub(r"!([^!|]+)(?:\|[^!]*)?!", r"📎 \1", s)             # image embeds
    s = re.sub(r"\[~[^\]]+\]", "@user", s)                          # user mentions
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _parse_comments(row: dict) -> list:
    # HTML parser path: pre-built JSON list.
    raw = row.get("comments_json") or row.get("comments") or ""
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                return data
        except Exception:
            pass
    # CSV path: one or more "Комментарий"/"Comment" columns, pipe-joined by the
    # parser. Each Jira CSV comment is "date;author;text;visibility;..".
    csvc = ""
    for k, v in row.items():
        if k.lower().strip() in ("комментарий", "comment", "comments", "izoh", "izohlar") and v:
            csvc = v
            break
    if not csvc:
        return []
    out = []
    for piece in csvc.split("|"):
        piece = piece.strip()
        if not piece:
            continue
        parts = piece.split(";")
        if len(parts) >= 3:
            # body may itself contain ';' -> rejoin, then _clean_comment strips
            # the trailing visibility marker.
            date, author, body = parts[0].strip(), parts[1].strip(), ";".join(parts[2:])
        elif len(parts) == 2:
            date, author, body = parts[0].strip(), "", parts[1]
        else:
            date, author, body = "", "", piece
        txt = _clean_comment(body)
        if txt:
            out.append({"author": _pretty_person(author), "date": date, "text": txt[:700]})
    return out[-15:]


def _pm(row: dict) -> str:
    """Strictly the custom 'PM' field. Empty -> 'Unassigned' (no assignee fallback)."""
    v = _get(row, "pm").strip()
    if v.lower() in _UNASSIGNED:
        return "Unassigned"
    return _pretty_person(v)


def _get_links(row: dict) -> list[dict]:
    out = []
    for k, v in row.items():
        kl = k.lower()
        if not v:
            continue
        if "blocks" in kl or "blocked" in kl or "depend" in kl or "link" in kl:
            ltype = "blocks" if "blocks" in kl and "blocked" not in kl else (
                "is blocked by" if "blocked" in kl else "depends on")
            for target in str(v).split("|"):
                target = target.strip()
                if target:
                    out.append({"type": ltype, "target": target})
    return out


# ---- date parsing -----------------------------------------------------------
_DATE_FORMATS = [
    "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d",
    "%d/%b/%y %I:%M %p", "%d/%b/%Y %I:%M %p", "%d/%b/%y", "%d/%b/%Y",
    "%m/%d/%Y %H:%M", "%m/%d/%Y", "%d.%m.%Y %H:%M", "%d.%m.%Y", "%d-%m-%Y",
    "%Y/%m/%d",
]


def parse_date(s: str):
    if not s:
        return None
    s = str(s).strip()
    s = s.replace("Z", "").split("+")[0].strip()
    for fmt in _DATE_FORMATS:
        try:
            return dt.datetime.strptime(s, fmt)
        except ValueError:
            continue
    try:
        return dt.datetime.fromisoformat(s)
    except Exception:
        return None


def _iso(d):
    return d.isoformat() if isinstance(d, dt.datetime) else None


# ---- status normalization ---------------------------------------------------
# Jira lets people CREATE custom statuses, and humans routinely type them with
# mixed Cyrillic+Latin letters (visually identical). For example:
#   "KOPЗИHA ИДEЙ"  (K-O-P-H-E are LATIN; ЗИ-И-Д are CYRILLIC) actually means
#   "КОРЗИНА ИДЕЙ"  ("Idea Bin" → BACKLOG).
# We attempt BOTH directions so either kind of contamination resolves.
_CYR_TO_LAT = str.maketrans({
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O",
    "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y",
    "а": "a", "е": "e", "о": "o", "с": "c", "р": "p", "х": "x", "у": "y",
    "к": "k", "м": "m", "т": "t",
})
_LAT_TO_CYR = str.maketrans({
    "A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К",
    "M": "М", "O": "О", "P": "Р", "T": "Т", "X": "Х", "Y": "У",
})

_unknown_statuses: set[str] = set()

# Status audit: every distinct raw value seen during the current ingest, with
# its canonical mapping + counts + flags. Reset by reset_status_audit() before
# each ingest, snapshotted into the dataset meta after. Lets the user verify
# every upload that mixed-script statuses were caught + dead steps were dropped.
# Gated by _audit_active so dashboard-render canon_status() calls don't pollute.
_status_audit: dict[str, dict] = {}
_dead_type_audit: dict[str, int] = {}   # raw type → count of issues dropped
_audit_active: bool = False


def _script_kinds(s: str) -> set[str]:
    out: set[str] = set()
    for ch in s:
        n = unicodedata.name(ch, "")
        if "CYRILLIC" in n:
            out.add("C")
        elif "LATIN" in n:
            out.add("L")
    return out


def reset_status_audit() -> None:
    global _audit_active
    _status_audit.clear()
    _dead_type_audit.clear()
    _audit_active = True


def stop_status_audit() -> None:
    global _audit_active
    _audit_active = False


def _record_dead_type(raw: str) -> None:
    if not _audit_active:
        return
    k = (raw or "").strip()
    if not k:
        return
    _dead_type_audit[k] = _dead_type_audit.get(k, 0) + 1


def get_status_audit() -> dict:
    """Snapshot of the current ingest's status audit.

    {
      generated_at, total_distinct, total_events,
      mixed_normalized: [{raw, canonical, count}, ...],
      dead_dropped:     [{raw, canonical:"", count}, ...],
      unknown:          [{raw, count}, ...],
      dead_issue_types: [{raw, count}, ...],   # whole issues dropped (e.g. "Статус проекта")
      by_canonical:     {CANONICAL: [{raw, count}, ...]},
    }
    """
    mixed: list[dict] = []
    dead: list[dict] = []
    unknown: list[dict] = []
    by_canonical: dict[str, list[dict]] = {}
    total_events = 0
    for rec in _status_audit.values():
        total_events += rec["count"]
        row = {"raw": rec["raw"], "canonical": rec["canonical"], "count": rec["count"]}
        if rec["dead"]:
            dead.append(row)
        elif rec["unknown"]:
            unknown.append({"raw": rec["raw"], "count": rec["count"]})
        else:
            by_canonical.setdefault(rec["canonical"], []).append({"raw": rec["raw"], "count": rec["count"]})
            if rec["mixed_script"]:
                mixed.append(row)
    mixed.sort(key=lambda r: -r["count"])
    dead.sort(key=lambda r: -r["count"])
    unknown.sort(key=lambda r: -r["count"])
    dead_types = sorted(
        [{"raw": k, "count": v} for k, v in _dead_type_audit.items()],
        key=lambda r: -r["count"],
    )
    return {
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "total_distinct": len(_status_audit),
        "total_events": total_events,
        "mixed_normalized": mixed,
        "dead_dropped": dead,
        "unknown": unknown,
        "dead_issue_types": dead_types,
        "by_canonical": by_canonical,
    }


def _record_audit(raw_input: str, canonical: str, *, unknown: bool) -> None:
    """Record one canon_status() call. Keyed by the ORIGINAL-case raw value
    so 'Done' (133) and 'Dоne' (238, mixed) appear as separate rows in the audit."""
    if not _audit_active:
        return
    raw = (raw_input or "").strip()
    if not raw:
        return
    rec = _status_audit.get(raw)
    if rec is None:
        kinds = _script_kinds(raw)
        rec = {
            "raw": raw,
            "canonical": canonical,
            "count": 0,
            "mixed_script": kinds == {"C", "L"},
            "dead": canonical == "",
            "unknown": unknown,
        }
        _status_audit[raw] = rec
    rec["count"] += 1


def _log_unknown(raw: str) -> None:
    if not raw or raw in _unknown_statuses:
        return
    _unknown_statuses.add(raw)
    try:
        log = config.LOGS / "unknown_statuses.log"
        with log.open("a", encoding="utf-8") as f:
            f.write(f"{dt.datetime.now().isoformat(timespec='seconds')}\t{raw}\n")
    except Exception:
        pass


def _is_canonical(s: str) -> bool:
    return (s in config.DISCOVERY_STATUSES or s in config.DELIVERY_STATUSES
            or s in config.DONE_STATUSES or s in config.DECLINED_STATUSES
            or s == "NEED INFO")


def canon_status(s: str) -> str:
    """Canonicalize a raw status string.

    Returns "" for DEAD statuses (obsolete workflow steps that should never enter
    TTM/lead-time math). The history parser drops these segments outright.
    Every call is recorded into the per-ingest status audit so the user can see
    which mixed-script forms were normalized and which dead steps were dropped.
    """
    raw_input = s or ""
    raw = raw_input.strip().upper()
    if not raw:
        return ""

    def done(canonical: str, *, unknown: bool = False) -> str:
        _record_audit(raw_input, canonical, unknown=unknown)
        return canonical

    # Dead-status check (also catches Latin-look-alike contamination like
    # "KOPЗИHA ИДEЙ" → "КОРЗИНА ИДЕЙ").
    if raw in config.DEAD_STATUSES:
        return done("")
    cyr_form = raw.translate(_LAT_TO_CYR)
    if cyr_form in config.DEAD_STATUSES:
        return done("")
    # 1) direct match (synonym or already canonical)
    if raw in config.STATUS_SYNONYMS:
        return done(config.STATUS_SYNONYMS[raw])
    if _is_canonical(raw):
        return done(raw)
    # 2) Cyrillic look-alikes → Latin (e.g. "Dоne" / "Tеsting" / "In Prоgress")
    lat = raw.translate(_CYR_TO_LAT)
    if lat != raw:
        if lat in config.STATUS_SYNONYMS:
            return done(config.STATUS_SYNONYMS[lat])
        if _is_canonical(lat):
            return done(lat)
    # 3) Latin look-alikes → Cyrillic (catches mixed-script RU synonyms)
    if cyr_form != raw and cyr_form in config.STATUS_SYNONYMS:
        return done(config.STATUS_SYNONYMS[cyr_form])
    # 4) unknown — log once so future drift is visible, return the cleaner form
    _log_unknown(raw)
    return done(lat if _is_canonical(lat) else raw, unknown=True)


_TYPE = {
    "epic": "Epic",
    "task": "Task", "задача": "Task", "масала": "Task",
    "new feature": "New Feature", "новая функциональность": "New Feature", "yangi funksiya": "New Feature",
    "story": "Story", "история": "Story",
    "sub-task": "Sub-task", "subtask": "Sub-task", "подзадача": "Sub-task",
    "bug": "Bug", "ошибка": "Bug",
}


def canon_type(s: str) -> str:
    return _TYPE.get((s or "").strip().lower(), (s or "Task").strip())


def status_group(s: str) -> str:
    s = canon_status(s)
    if s in config.DISCOVERY_STATUSES:
        return "discovery"
    if s in config.DELIVERY_STATUSES:
        return "delivery"
    if s in config.DECLINED_STATUSES:
        return "declined"
    return "other"


# ---- status history ---------------------------------------------------------
def _parse_history(raw: str, created, resolved, current_status):
    """Return [{status, entered, exited, days}] sorted by entered.

    Accepts a JSON list in the 'Status History' column:
      [{"status": "...", "entered": "ISO", "exited": "ISO"}]
    Falls back to a minimal 2-point history from created/resolved.
    """
    events = []
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                for e in data:
                    st = canon_status(e.get("status", ""))
                    ent = parse_date(e.get("entered") or e.get("from") or e.get("date"))
                    ext = parse_date(e.get("exited") or e.get("to"))
                    if st and ent:
                        events.append([st, ent, ext])
        except Exception:
            events = []

    if not events:
        # Minimal fallback: assume created in first discovery status, ended at resolution.
        if created:
            first = "BACKLOG"
            events.append([first, created, resolved])
        if resolved and current_status:
            events.append([canon_status(current_status), resolved, resolved])

    events.sort(key=lambda x: x[1])
    out = []
    for i, (st, ent, ext) in enumerate(events):
        if not st:
            # Dead status — by user request these are not real process phases
            # and must not enter TTM/lead-time math.
            continue
        end = ext
        if end is None:
            end = events[i + 1][1] if i + 1 < len(events) else (resolved or dt.datetime.now())
        days = max(0.0, (end - ent).total_seconds() / 86400.0)
        out.append({"status": st, "entered": _iso(ent), "exited": _iso(end), "days": round(days, 3)})
    return out


# ---- main -------------------------------------------------------------------
def normalize_rows(rows: list[dict], default_project: str = "") -> list[dict]:
    issues = []
    for row in rows:
        key = _get(row, "key")
        if not key:
            continue
        raw_type = _get(row, "type") or "Task"
        itype = canon_type(raw_type)
        # Whitelist: only Epic / Task / New Feature count. Everything else
        # (Sub-task, Blocker, "Подпроект", "Карточка по проекту", "Статус
        # проекта", Story, Bug, future unknowns) is dropped at ingest. Per user
        # directive — no report (TTM, throughput, leaderboards, DQ totals)
        # should include any other type without explicit permission.
        if itype not in config.ALLOWED_ISSUE_TYPES:
            _record_dead_type(raw_type)
            continue
        status_c = canon_status(_get(row, "status") or "BACKLOG")
        # If the issue's current status is a DEAD step (rare — usually current
        # status is clean), fall back to BACKLOG so the issue still appears in
        # the dashboard rather than vanishing.
        if not status_c:
            status_c = "BACKLOG"
        created = parse_date(_get(row, "created"))
        updated = parse_date(_get(row, "updated"))
        resolved = parse_date(_get(row, "resolved"))
        due = parse_date(_get(row, "due"))
        sp = _get(row, "story_points")
        try:
            sp_val = float(sp) if sp else None
        except ValueError:
            sp_val = None

        # Completion / decline from resolution + status
        rl = _get(row, "resolution").strip().lower()
        declined = (status_c in config.DECLINED_STATUSES) or (rl in config.RESOLUTION_DECLINED)
        done = (status_c in config.DONE_STATUSES) or (rl in config.RESOLUTION_DONE)
        if declined:
            status_c = "DECLINED"
            resolved = None
        elif done and not resolved:
            # exports often omit a Resolution Date column -> use Updated as proxy
            resolved = updated or created

        is_epic = itype.strip().lower() in config.EPIC_TYPES
        project = _get(row, "project") or default_project or key.split("-")[0]
        history = _parse_history(_get(row, "history"), created, resolved, status_c)
        # ITSM-specific fields. parse_sla_overall() returns met/breached/running
        # per SLA from the "SLA общий" free-text column. Absent on portfolio data
        # (PMD/PMO) — fields are None then.
        sla = parse_sla_overall(_get(row, "sla_overall_text"))
        crt = _get(row, "customer_request_type")
        try:
            sla_reaction_elapsed = float(_get(row, "sla_reaction_elapsed_min") or 0) or None
        except ValueError:
            sla_reaction_elapsed = None
        try:
            sla_resolution_elapsed = float(_get(row, "sla_resolution_elapsed_min") or 0) or None
        except ValueError:
            sla_resolution_elapsed = None
        issues.append({
            "key": key,
            "url": _get(row, "url"),
            "project": project,
            "type": itype,
            "is_epic": is_epic,
            "status": status_c,
            "status_group": status_group(status_c),
            "summary": _get(row, "summary"),
            "description": _get(row, "description"),
            "pm": _pm(row),
            "assignee": _pretty_person(_get(row, "assignee")),
            "reporter": _pretty_person(_get(row, "reporter")),
            "created": _iso(created),
            "resolved": _iso(resolved),
            "due": _iso(due),
            "epic_key": _get(row, "epic_key"),
            "story_points": sp_val,
            "priority": _get(row, "priority"),
            "project_type": _get(row, "project_type"),
            "regulator": _get(row, "regulator"),
            "division": _get(row, "division"),
            "scoring": _get(row, "scoring"),
            "quarterly_status": _get(row, "quarterly_status"),
            "comments": _parse_comments(row),
            "links": _get_links(row),
            "history": history,
            # ITSM
            "customer_request_type": crt,
            "sla_reaction_elapsed_min": sla_reaction_elapsed,
            "sla_resolution_elapsed_min": sla_resolution_elapsed,
            "sla_reaction_met": sla["reaction_met"],
            "sla_resolution_met": sla["resolution_met"],
            "sla_reaction_state": sla["reaction_state"],
            "sla_resolution_state": sla["resolution_state"],
        })
    return issues


# ---- SLA parsing (ITSM) -----------------------------------------------------
# The "SLA общий" column carries the truthy SLA pass/fail as RU text with emoji:
#   "Время реакции: 39s (left 2h 59m 20s) ✅ runningВремя решения: 25m 33s (left 1h 34m 26s) ✅ ..."
# We split on the two RU labels, then look for ✅ / ❌ + state keyword in each
# segment. The English equivalents (Time to first response / Time to resolution)
# are NOT configured for this Jira tenant and must not be parsed.
_SLA_REACTION_LABEL = "Время реакции"
_SLA_RESOLUTION_LABEL = "Время решения"


def _slice_sla_segment(text: str, label: str) -> str:
    i = text.find(label)
    if i < 0:
        return ""
    # The next segment starts at the next label occurrence (or end of string).
    rest = text[i + len(label):]
    next_i_a = rest.find(_SLA_REACTION_LABEL)
    next_i_b = rest.find(_SLA_RESOLUTION_LABEL)
    cuts = [c for c in (next_i_a, next_i_b) if c >= 0]
    end = min(cuts) if cuts else len(rest)
    return rest[:end]


def _interpret_sla(segment: str) -> tuple[bool | None, str]:
    """Return (met, state) for a single SLA segment.

    The truth is in the emoji: ✅ = met / on track, ❌ = breached.
    The trailing word ("running" / "paused" / "met") is just timer state and
    doesn't override the emoji — Jira keeps a closed ticket's SLA emoji
    correct even though the textual state may still read "running".
    """
    if not segment:
        return None, ""
    s = segment.lower()
    state = ""
    if "running" in s: state = "running"
    elif "paused" in s: state = "paused"
    elif "met" in s: state = "met"
    elif "breached" in s or "exceeded" in s: state = "breached"
    if "❌" in segment or state == "breached":
        return False, state or "breached"
    if "✅" in segment:
        return True, state or "met"
    return None, state


def parse_sla_overall(text: str) -> dict:
    """Parse "SLA общий" into per-SLA met/state dicts.

    Returns {reaction_met, resolution_met, reaction_state, resolution_state}.
    Met is True/False (closed SLA) or None (still running / no signal).
    """
    if not text:
        return {"reaction_met": None, "resolution_met": None,
                "reaction_state": "", "resolution_state": ""}
    rseg = _slice_sla_segment(text, _SLA_REACTION_LABEL)
    sseg = _slice_sla_segment(text, _SLA_RESOLUTION_LABEL)
    rm, rs = _interpret_sla(rseg)
    sm, ss = _interpret_sla(sseg)
    return {"reaction_met": rm, "resolution_met": sm,
            "reaction_state": rs, "resolution_state": ss}
