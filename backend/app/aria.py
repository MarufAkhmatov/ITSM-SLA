"""TEMUR — local Portfolio AI agent.

Grounds answers in the computed portfolio analytics (the active dataset).
Provider order: Claude Code CLI (`claude -p`, no API key — uses the user's
existing Claude Code auth) -> Anthropic Claude API (if ANTHROPIC_API_KEY is set)
-> Ollama (if running) -> deterministic grounded fallback. So Temur is "powered
by Claude" with zero setup, and always works offline via the grounded fallback.
LLM outputs for issue summaries/recommendations are cached on disk (ai_cache).
Set TEMUR_MODEL to override the CLI model (default "haiku").
"""
import os
import re
import math
import json
import shutil
import hashlib
import tempfile
import subprocess
import datetime as dt
import urllib.request
from collections import Counter
from . import config

ASSISTANT_NAME = "Amir"

# ---- local memory / self-learning (persisted, grounded) --------------------
_MEM = config.TEMP / "temur_memory.jsonl"
_FACTS = config.TEMP / "temur_facts.json"


def _load_facts() -> list:
    try:
        return json.loads(_FACTS.read_text(encoding="utf-8"))
    except Exception:
        return []


def remember_fact(text: str) -> list:
    facts = _load_facts()
    facts.append({"ts": dt.datetime.now().isoformat(timespec="seconds"), "text": text})
    facts = facts[-200:]
    try:
        _FACTS.write_text(json.dumps(facts, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass
    return facts


def _log_interaction(q: str, a: str):
    try:
        with open(_MEM, "a", encoding="utf-8") as f:
            f.write(json.dumps({"ts": dt.datetime.now().isoformat(timespec="seconds"),
                                "q": q, "a": (a or "")[:500]}, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _teach_match(q: str):
    m = re.match(r"\s*(?:remember|запомни|запиши|note that|eslab qol|yodda tut|esla)\b[:,]?\s+(.*)",
                 (q or "").strip(), re.I | re.S)
    if not m or not m.group(1).strip():
        return None
    fact = re.sub(r"^(that|что|ki)\s+", "", m.group(1).strip(), flags=re.I)
    return fact.strip() or None

# Path to the local Claude Code CLI (resolved once).
_CLAUDE_EXE = shutil.which("claude")
# Disk cache for LLM outputs so a given issue is only generated once.
_AICACHE = config.TEMP / "ai_cache"


def _claude_cli(prompt: str) -> str | None:
    """Use the local Claude Code CLI (headless) as the LLM — NO API key needed.

    Runs `claude -p` in a neutral directory with project/MCP config disabled, so
    it is a fast single-shot text completion that reuses the user's existing
    Claude Code authentication (subscription). This makes Temur "powered by
    Claude" with zero setup — no ANTHROPIC_API_KEY and no Ollama.
    """
    exe = _CLAUDE_EXE or shutil.which("claude")
    if not exe:
        return None
    model = os.environ.get("TEMUR_MODEL", "haiku")
    try:
        # Pass the prompt via STDIN, not argv: the npm `claude.CMD` wrapper goes
        # through cmd.exe on Windows, which mangles newlines in a multi-line
        # argument. Piping the prompt on stdin preserves it exactly.
        proc = subprocess.run(
            [exe, "-p", "--model", model,
             "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'],
            input=prompt, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=120, cwd=tempfile.gettempdir(),
        )
        out = (proc.stdout or "").strip()
        return out or None
    except Exception:
        return None


def _cache_key(prompt: str) -> str:
    seed = os.environ.get("TEMUR_MODEL", "haiku") + "|" + prompt
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def _cache_get(key: str):
    f = _AICACHE / (key + ".json")
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def _cache_put(key: str, val: dict):
    try:
        _AICACHE.mkdir(parents=True, exist_ok=True)
        (_AICACHE / (key + ".json")).write_text(
            json.dumps(val, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def _strip_md(s: str) -> str:
    """Remove Markdown so chat text is clean and TTS doesn't read '**'."""
    if not s:
        return s
    s = re.sub(r"\*\*(.*?)\*\*", r"\1", s, flags=re.S)          # **bold**
    s = re.sub(r"__(.*?)__", r"\1", s, flags=re.S)              # __bold__
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"\1", s)  # *italic*
    s = re.sub(r"`{1,3}([^`]*)`{1,3}", r"\1", s)                # `code`
    s = re.sub(r"^\s{0,3}#{1,6}\s*", "", s, flags=re.M)         # # headings
    s = re.sub(r"^\s{0,3}>\s?", "", s, flags=re.M)              # > quotes
    s = re.sub(r"^\s{0,3}[-*+]\s+", "• ", s, flags=re.M)        # - bullets -> •
    return s.strip()


def _llm(prompt: str, cache: bool = False):
    """Provider chain: Anthropic API (fast, if ANTHROPIC_API_KEY) -> Claude Code
    CLI -> Ollama. Output is stripped of Markdown. Returns (text, source).
    cache=True memoises the result on disk keyed by the exact prompt + model.
    """
    key = _cache_key(prompt) if cache else None
    if key:
        hit = _cache_get(key)
        if hit and hit.get("text"):
            return hit["text"], hit.get("source", "cache")
    out, src = _claude(prompt), "claude"            # Anthropic API first (fast path)
    if not out:
        out, src = _claude_cli(prompt), "claude-cli"
    if not out:
        out, src = _ollama(prompt), "ollama"
    if out:
        out = _strip_md(out)
        if key:
            _cache_put(key, {"text": out, "source": src})
    return out, src


def _claude(prompt: str) -> str | None:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    try:
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps({
                "model": os.environ.get("CLAUDE_MODEL", "claude-3-5-haiku-latest"),
                "max_tokens": 600,
                "messages": [{"role": "user", "content": prompt}],
            }).encode(),
            headers={"Content-Type": "application/json", "x-api-key": key,
                     "anthropic-version": "2023-06-01"},
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
            return "".join(b.get("text", "") for b in data.get("content", [])).strip()
    except Exception:
        return None


def _ollama(prompt: str) -> str | None:
    try:
        req = urllib.request.Request(
            f"{config.OLLAMA_URL}/api/generate",
            data=json.dumps({"model": config.ARIA_MODEL, "prompt": prompt, "stream": False}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read()).get("response", "").strip()
    except Exception:
        return None


def _context(analytics: dict, kpis: dict) -> str:
    board = analytics["pm_leaderboard"]
    health = analytics["project_health"]
    blockers = analytics["blockers"]
    ttm = analytics["ttm"]["overall"]
    lines = [
        f"Total projects: {kpis['total_portfolio_projects']}, completed: {kpis['completed_projects']}, "
        f"open: {kpis['open_projects']}, declined: {kpis['declined_projects']} "
        f"(completion {kpis['completion_pct']}%).",
        f"Average total TTM: {ttm['avg']} days (median {ttm['median']}, p90 {ttm['p90']}).",
        f"Average lead time: {analytics['lead_time']['avg']} days.",
        f"Portfolio flow efficiency: {analytics['flow']['portfolio_average']}%.",
        f"Blocked items: {blockers['total_blocked']}.",
    ]
    if board:
        lines.append("Top PM: " + ", ".join(
            f"{b['pm']} (score {b['pm_score']}, {b['projects_completed']} done)" for b in board[:3]))
    if health:
        worst = sorted(health, key=lambda h: h["score"])[:3]
        lines.append("Highest-risk projects: " + ", ".join(
            f"{h['key']} ({h['category']} {h['score']})" for h in worst))
    return "\n".join(lines)


def _rule_based(q: str, analytics: dict, kpis: dict) -> str:
    ql = q.lower()
    board = analytics["pm_leaderboard"]
    health = analytics["project_health"]
    blockers = analytics["blockers"]
    noms = analytics["pm_nominations"]

    if "risk" in ql or "highest risk" in ql:
        worst = sorted(health, key=lambda h: h["score"])[:3]
        if worst:
            return "Highest-risk projects: " + "; ".join(
                f"{h['key']} — {h['summary'] or ''} ({h['category']}, score {h['score']}, "
                f"{h['blocked']} blockers, {h['overdue_children']} overdue)" for h in worst)
    if "best" in ql and ("pm" in ql or "manager" in ql or "perform" in ql):
        if board:
            b = board[0]
            return (f"Best performing PM: {b['pm']} (score {b['pm_score']}, "
                    f"{b['projects_completed']} projects completed, success {b['success_rate']}%, "
                    f"avg TTM {b['avg_ttm']}d).")
    if "ttm" in ql and ("increas" in ql or "why" in ql or "rising" in ql):
        tr = analytics["ttm"]["trend"]
        if len(tr) >= 2:
            return (f"TTM trend: {tr[-2]['period']}={tr[-2]['avg_ttm']}d -> "
                    f"{tr[-1]['period']}={tr[-1]['avg_ttm']}d. Main drivers are time spent in "
                    f"Discovery statuses and blocked dependencies "
                    f"({blockers['total_blocked']} blocked items).")
    if "block" in ql:
        bp = blockers["blocked_projects"][:5]
        if bp:
            return "Blocked projects: " + "; ".join(
                f"{p['key']} (blocked by {', '.join(p['blocked_by'])}, risk {p['risk']})" for p in bp)
        return "No blocked projects detected in the active dataset."
    if "focus" in ql or "management" in ql or "quarter" in ql:
        worst = sorted(health, key=lambda h: h["score"])[:3]
        return ("Management focus this quarter: clear blockers on "
                + ", ".join(h["key"] for h in worst)
                + f"; completion is {kpis['completion_pct']}% with {kpis['open_projects']} open projects.")
    if "fastest" in ql or "lead time" in ql:
        return f"Fastest delivery manager: {noms.get('fastest_delivery_manager', 'n/a')}. Portfolio avg lead time {analytics['lead_time']['avg']}d."
    # default summary
    return (f"Portfolio has {kpis['total_portfolio_projects']} projects, "
            f"{kpis['completion_pct']}% completed, avg TTM {analytics['ttm']['overall']['avg']}d, "
            f"flow efficiency {analytics['flow']['portfolio_average']}%, "
            f"{blockers['total_blocked']} blocked items.")


def _extractive(text: str, n: int = 4) -> str:
    import re
    sents = re.split(r"(?<=[.!?。])\s+|\n+", text)
    sents = [s.strip(" -•\t") for s in sents if len(s.strip()) > 18]
    return " ".join(sents[:n])


def summarize_issue(issue: dict) -> dict:
    """AI summary of an issue from its Quarterly status field + comments."""
    qs = (issue.get("quarterly_status") or "").strip()
    comments = issue.get("comments") or []
    ctext = "\n".join(f"[{c.get('date','')}] {c.get('author','')}: {c.get('text','')}"
                      for c in comments).strip()
    combined = (qs + "\n\n" + ctext).strip()
    if not combined:
        return {"summary": "", "source": "none", "comments_count": 0}

    prompt = (
        f"You are {ASSISTANT_NAME}, a senior PMO analyst. Below is a Jira portfolio "
        "issue's QUARTERLY STATUS report and its COMMENTS. Do NOT copy or paraphrase "
        "sentences verbatim — ANALYZE them. Produce a tight executive summary (3-4 "
        "sentences max) that explicitly covers, in this order: (1) current progress / "
        "where the work really stands, (2) the key blocker or risk, (3) the most "
        "important next step to close it. Be specific and factual; if the source is "
        "thin, say what is unknown rather than inventing detail. Answer in the same "
        "language as the source. Output plain prose only — NO Markdown, no headings, "
        "no '#' or '*' or bold.\n\n"
        f"QUARTERLY STATUS:\n{qs[:4000]}\n\nCOMMENTS:\n{ctext[:4000]}\n\nSUMMARY:"
    )
    out, source = _llm(prompt, cache=True)
    if not out:
        out, source = _extractive(qs or ctext), "extractive"
    return {"summary": out, "source": source, "comments_count": len(comments)}


# --------------------------- issue recommendation ---------------------------
def _issue_facts(issue: dict):
    """Derive the grounded signals used to advise on an open issue."""
    from .metrics import engines as E
    status = issue.get("status", "")
    group = issue.get("status_group", "")
    age = None
    c = E._d(issue.get("created"))
    if c:
        age = (dt.datetime.now() - c).days
    overdue_days = None
    due = E._d(issue.get("due"))
    if due:
        delta = (dt.datetime.now() - due).days
        overdue_days = delta if delta > 0 else None
    blockers = [l for l in (issue.get("links") or [])
                if "block" in (l.get("type") or "").lower()]
    comments = issue.get("comments") or []
    return status, group, age, overdue_days, blockers, comments


def _rule_recommend(status, group, age, overdue_days, blockers, comments, qs) -> str:
    """Deterministic, grounded recommendations when no LLM is available."""
    recs = []
    stage_step = {
        "discovery": (f"Move it out of '{status}': lock scope and acceptance criteria, "
                      "then schedule the analysis/validation sign-off this week so it can "
                      "enter delivery."),
        "delivery": (f"Drive '{status}' to Done: confirm the remaining work is estimated, "
                     "assign a single clear owner, and set a committed completion date."),
        "other": (f"Re-triage it out of '{status}': decide whether it belongs in an active "
                  "discovery or delivery stage, or should be declined."),
    }
    recs.append(stage_step.get(group, stage_step["other"]))

    if blockers:
        recs.append("Clear blocking dependencies first ("
                    + ", ".join(b.get("target", "?") for b in blockers)
                    + ") — raise them at the next stand-up and get owners committed.")
    else:
        recs.append("No formal blockers are recorded — if work is stalled, capture the real "
                    "impediment as a linked blocker so it gets management visibility.")

    if overdue_days:
        recs.append(f"It is {overdue_days} days past its due date — escalate to the PM/"
                    "sponsor and agree a realistic revised date now.")
    elif age is not None and age > 90:
        recs.append(f"It has been open {age} days without resolution — review whether to "
                    "split, de-scope, or decline it to stop aging WIP.")

    if not comments:
        recs.append("There is no discussion on record — request a written status update from "
                    "the assignee so progress is auditable.")
    else:
        recs.append("Follow up on the latest comment thread and convert any open questions "
                    "into action items with named owners and dates.")

    if not (qs or "").strip():
        recs.append("Quarterly status is empty — fill it in so leadership can see progress, "
                    "risks and the path to close.")

    return "\n".join(f"• {r}" for r in recs)


def recommend_issue(issue: dict) -> dict:
    """Concrete recommendations on how to successfully CLOSE an open issue.

    Grounds on current status/stage, age, overdue, blockers, comments and the
    quarterly status. Claude -> Ollama -> deterministic grounded fallback.
    """
    status, group, age, overdue_days, blockers, comments = _issue_facts(issue)
    qs = (issue.get("quarterly_status") or "").strip()
    ctext = "\n".join(f"[{c.get('date', '')}] {c.get('author', '')}: {c.get('text', '')}"
                      for c in comments[-8:]).strip()

    facts = [
        f"Key: {issue.get('key')}",
        f"Summary: {issue.get('summary', '')}",
        f"Type: {issue.get('type')}",
        f"Current status: {status} (stage: {group or 'unknown'})",
        f"PM: {issue.get('pm')}; Assignee: {issue.get('assignee') or 'unassigned'}",
        f"Priority: {issue.get('priority') or 'n/a'}",
        f"Age since created: {age if age is not None else 'unknown'} days",
    ]
    if overdue_days:
        facts.append(f"OVERDUE by {overdue_days} days (past the due date)")
    if blockers:
        facts.append("Blocking dependencies: "
                     + ", ".join(f"{b.get('type')} {b.get('target')}" for b in blockers))
    facts.append(f"Comments on record: {len(comments)}")
    factstr = "\n".join(facts)

    prompt = (
        f"You are {ASSISTANT_NAME}, a senior PMO delivery advisor. The Jira issue below "
        "is still OPEN. Using the facts, the quarterly status and the latest comments, "
        "give the PM 3-5 SPECIFIC, actionable recommendations to move it to successful "
        "completion. Cover: the immediate next step for its current stage, how to clear "
        "blockers/dependencies, the main risk to watch, and who should act. Answer in "
        "the same language as the source. Output 3-5 plain-text bullet lines, each "
        "starting with '- ' (a hyphen and a space) — NO Markdown, no headings, no '#', "
        "no '*', no bold. No preamble and do not restate the raw data.\n\n"
        f"ISSUE FACTS:\n{factstr}\n\nQUARTERLY STATUS:\n{qs[:3000]}\n\n"
        f"LATEST COMMENTS:\n{ctext[:3000]}\n\nRECOMMENDATIONS:"
    )
    out, source = _llm(prompt, cache=True)
    if not out:
        out = _rule_recommend(status, group, age, overdue_days, blockers, comments, qs)
        source = "grounded"
    return {"recommendation": out, "source": source, "status": status,
            "age_days": age, "blockers": len(blockers)}


# --------------------- epic-quality recommendation --------------------------
# Plain-language description of each problem type, per language. Used both to
# build the LLM brief and as the deterministic grounded fallback.
_PROBLEM_TEXT = {
    "summary_missing":      {"en": "the title is empty",
                              "ru": "не заполнено название",
                              "uz": "sarlavha bo'sh"},
    "summary_placeholder":  {"en": "the title is a placeholder/test value, not a real project name",
                              "ru": "название — заглушка/тестовое значение, а не реальное имя проекта",
                              "uz": "sarlavha haqiqiy loyiha nomi emas, balki test/qoralama qiymat"},
    "summary_short":        {"en": "the title is too short to be meaningful",
                              "ru": "название слишком короткое и неинформативное",
                              "uz": "sarlavha juda qisqa va ma'nosiz"},
    "description_missing":  {"en": "there is no description at all",
                              "ru": "полностью отсутствует описание",
                              "uz": "tavsif umuman yo'q"},
    "description_placeholder": {"en": "the description is a placeholder/test text",
                              "ru": "описание — заглушка/тестовый текст",
                              "uz": "tavsif test/qoralama matn"},
    "description_link_only": {"en": "the description is only a link, with no explanatory text",
                              "ru": "описание содержит только ссылку без пояснительного текста",
                              "uz": "tavsifda faqat havola bor, izohlovchi matn yo'q"},
    "description_short":    {"en": "the description is too short to explain the goal and scope",
                              "ru": "описание слишком короткое, не раскрывает цель и объём работ",
                              "uz": "tavsif juda qisqa, maqsad va ko'lamni ochib bermaydi"},
    "missing_pm":           {"en": "no Project Manager (PM) is assigned",
                              "ru": "не назначен менеджер проекта (PM)",
                              "uz": "loyiha menejeri (PM) tayinlanmagan"},
    "missing_due":          {"en": "no due date is set",
                              "ru": "не указан срок (due date)",
                              "uz": "muddat (due date) ko'rsatilmagan"},
    "missing_division":     {"en": "the customer division is not filled",
                              "ru": "не заполнено подразделение заказчика",
                              "uz": "buyurtmachi bo'limi to'ldirilmagan"},
    "missing_scoring":      {"en": "the scoring is not done (empty or 0)",
                              "ru": "не проставлен скоринг-балл (пусто или 0)",
                              "uz": "skoring-ball qo'yilmagan (bo'sh yoki 0)"},
    "missing_project_type": {"en": "the project type is not set",
                              "ru": "не указан тип проекта",
                              "uz": "loyiha turi ko'rsatilmagan"},
}

_EQ_FIX = {
    "ru": {
        "summary_missing": "задайте чёткое название проекта (что и для кого делается)",
        "summary_placeholder": "замените тестовое название на реальное название проекта",
        "summary_short": "расширьте название, чтобы из него была понятна суть проекта",
        "description_missing": "добавьте описание на 3–5 предложений: цель, объём работ и ожидаемый результат",
        "description_placeholder": "замените заглушку реальным описанием: цель, объём, ожидаемый результат",
        "description_link_only": "добавьте текстовое описание помимо ссылки: цель, объём, результат",
        "description_short": "дополните описание: цель, объём работ, критерии готовности",
        "missing_pm": "назначьте менеджера проекта (PM)",
        "missing_due": "укажите срок выполнения (due date)",
        "missing_division": "укажите подразделение заказчика",
        "missing_scoring": "проставьте скоринг-балл",
        "missing_project_type": "укажите тип проекта",
    },
    "en": {
        "summary_missing": "set a clear project title (what is built and for whom)",
        "summary_placeholder": "replace the test title with the real project name",
        "summary_short": "expand the title so the project's purpose is clear",
        "description_missing": "add a 3–5 sentence description: goal, scope and expected outcome",
        "description_placeholder": "replace the placeholder with a real description: goal, scope, outcome",
        "description_link_only": "add explanatory text besides the link: goal, scope, outcome",
        "description_short": "expand the description: goal, scope of work, definition of done",
        "missing_pm": "assign a Project Manager (PM)",
        "missing_due": "set a due date",
        "missing_division": "fill in the customer division",
        "missing_scoring": "complete the scoring",
        "missing_project_type": "set the project type",
    },
    "uz": {
        "summary_missing": "aniq loyiha nomini qo'ying (nima va kim uchun qilinmoqda)",
        "summary_placeholder": "test nomni haqiqiy loyiha nomi bilan almashtiring",
        "summary_short": "nomni kengaytiring, loyiha mohiyati tushunarli bo'lsin",
        "description_missing": "3–5 gaplik tavsif qo'shing: maqsad, ish ko'lami va kutilgan natija",
        "description_placeholder": "qoralamani haqiqiy tavsif bilan almashtiring: maqsad, ko'lam, natija",
        "description_link_only": "havoladan tashqari izoh matnini qo'shing: maqsad, ko'lam, natija",
        "description_short": "tavsifni to'ldiring: maqsad, ish ko'lami, tayyorlik mezonlari",
        "missing_pm": "loyiha menejerini (PM) tayinlang",
        "missing_due": "bajarilish muddatini (due date) ko'rsating",
        "missing_division": "buyurtmachi bo'limini ko'rsating",
        "missing_scoring": "skoring-ballni qo'ying",
        "missing_project_type": "loyiha turini ko'rsating",
    },
}

_EQ_TMPL = {
    "ru": {"greet": "Здравствуйте, {who}!",
           "intro": "По недавно созданному эпику {key} «{title}» есть замечания по оформлению — просьба доработать:",
           "outro": "Пожалуйста, дополните карточку, чтобы эпик можно было корректно взять в работу. Спасибо!"},
    "en": {"greet": "Hello, {who}!",
           "intro": "The recently created epic {key} \"{title}\" needs some cleanup — please update the following:",
           "outro": "Please complete the card so the epic can be picked up correctly. Thank you!"},
    "uz": {"greet": "Assalomu alaykum, {who}!",
           "intro": "Yaqinda yaratilgan {key} «{title}» epigida rasmiylashtirish bo'yicha kamchiliklar bor — to'ldirishingizni so'raymiz:",
           "outro": "Iltimos, kartochkani to'ldiring, shunda epikni to'g'ri ishga olish mumkin bo'ladi. Rahmat!"},
}


def _eq_grounded(epic, problems, L):
    fix = _EQ_FIX.get(L, _EQ_FIX["ru"])
    tmpl = _EQ_TMPL.get(L, _EQ_TMPL["ru"])
    who = (epic.get("reporter") or "").strip() or {"ru": "коллега", "en": "colleague", "uz": "hamkasb"}[L]
    title = (epic.get("summary") or "").strip() or {"ru": "(без названия)", "en": "(untitled)", "uz": "(nomsiz)"}[L]
    # de-dup fix lines, keep order, high-severity first
    seen, lines = set(), []
    for sev in ("high", "med", "low"):
        for p in problems:
            if p["severity"] != sev:
                continue
            f = fix.get(p["type"])
            if f and f not in seen:
                seen.add(f)
                lines.append(f"- {f[0].upper()}{f[1:]}.")
    body = "\n".join(lines)
    return (f"{tmpl['greet'].format(who=who)}\n\n"
            f"{tmpl['intro'].format(key=epic.get('key',''), title=title)}\n\n"
            f"{body}\n\n{tmpl['outro']}")


def recommend_epic_quality(epic, problems, lang="ru") -> dict:
    """Draft the message a PM can forward to the epic's author to get the card
    fixed. Specific to the detected problems, professional and constructive.
    LLM (cached) -> deterministic grounded fallback. PM's reputation depends on
    this being concrete and correct, so the brief is fully grounded."""
    L = lang if lang in ("en", "ru", "uz") else "ru"
    if not problems:
        msg = {"ru": "Замечаний по оформлению нет — эпик заполнен корректно.",
               "en": "No quality issues — the epic is filled in correctly.",
               "uz": "Kamchilik yo'q — epik to'g'ri to'ldirilgan."}[L]
        return {"recommendation": msg, "source": "grounded", "problems": []}

    who = (epic.get("reporter") or "").strip()
    prob_lines = []
    for p in problems:
        txt = _PROBLEM_TEXT.get(p["type"], {}).get(L) or p["type"]
        prob_lines.append(f"- {txt}")
    probs_str = "\n".join(prob_lines)

    desc = (epic.get("description") or "").strip()
    prompt = (
        f"You are {ASSISTANT_NAME}, a senior PMO project manager. A newly created Jira EPIC has "
        "quality problems in how it was filled in by its author. Write a SHORT, professional and "
        "constructive message that the PM will forward to the author asking them to fix the card. "
        "Address the author by name if given. Be SPECIFIC to the listed problems and tell them "
        "exactly what to add for each (e.g. what a good description must cover: goal, scope, expected "
        "outcome). Do NOT invent facts about the project that are not given. Keep a respectful, "
        "collegial tone — never condescending. Use short bullet lines starting with '- '. "
        f"Write entirely in {_LANG_NAME[L]}. Plain text only — no Markdown, no '#', no '*'.\n\n"
        f"EPIC: {epic.get('key','')} — \"{epic.get('summary','')}\"\n"
        f"AUTHOR: {who or 'unknown'}\n"
        f"CURRENT DESCRIPTION: {desc[:1200] or '(empty)'}\n\n"
        f"PROBLEMS TO ADDRESS:\n{probs_str}\n\nMESSAGE:"
    )
    out, source = _llm(prompt, cache=True)
    if not out:
        out, source = _eq_grounded(epic, problems, L), "grounded"
    return {"recommendation": out, "source": source, "problems": problems}


_STOP = set("the a an of to in on for and or is are was with by from at as this that "
            "и в на по для с от до за из не что как это или а но бы же то так уже еще "
            "va uchun bilan bu ushbu yoki ham emas".split())


def _tokens(s: str) -> list:
    toks = re.findall(r"[0-9a-zA-ZЀ-ӿ]{3,}", (s or "").lower())
    return [w for w in toks if w not in _STOP]


def _issue_text(i: dict) -> str:
    parts = [i.get("summary", ""), i.get("quarterly_status", "")]
    for c in (i.get("comments") or [])[:5]:
        parts.append(c.get("text", ""))
    return " ".join(parts)


def similar_issues(text: str, issues: list, top: int = 6):
    """TF-IDF cosine similarity between a free-text description and the portfolio
    issues (summary + quarterly status + comments). Pure stdlib."""
    docs = [(i, _tokens(_issue_text(i))) for i in issues]
    docs = [(i, tk) for i, tk in docs if tk]
    if not docs:
        return []
    df = Counter()
    for _, tk in docs:
        for w in set(tk):
            df[w] += 1
    N = len(docs)

    def vec(tk):
        tf = Counter(tk)
        n = len(tk)
        return {w: (c / n) * math.log((N + 1) / (df.get(w, 0) + 1) + 1) for w, c in tf.items()}

    q = vec(_tokens(text))
    if not q:
        return []
    qn = math.sqrt(sum(v * v for v in q.values())) or 1.0
    scored = []
    for i, tk in docs:
        d = vec(tk)
        dot = sum(w_v * d.get(w, 0.0) for w, w_v in q.items())
        if dot <= 0:
            continue
        dn = math.sqrt(sum(v * v for v in d.values())) or 1.0
        scored.append((dot / (qn * dn), i))
    scored.sort(key=lambda x: -x[0])
    return [(round(s, 3), i) for s, i in scored[:top]]


def recommend_from_description(text: str, issues: list) -> dict:
    """Analyze a new task/report description, find similar past projects and how
    they were handled, and recommend an approach (LLM -> grounded fallback)."""
    from .metrics import engines as E
    sims = similar_issues(text, issues, top=6)
    similar, ctx_lines = [], []
    for score, i in sims:
        dur = None
        c, r = E._d(i.get("created")), E._d(i.get("resolved"))
        if c and r and r >= c:
            dur = (r - c).days
        done = E.is_done(i)
        qs = (i.get("quarterly_status") or "").strip()
        similar.append({"key": i["key"], "summary": i.get("summary", ""), "status": i["status"],
                        "is_done": done, "duration_days": dur, "pm": i.get("pm"), "score": score})
        ctx_lines.append(
            f"- {i['key']} [{'DONE' if done else i['status']}]"
            f"{' in ' + str(dur) + 'd' if dur is not None else ''}: {i.get('summary', '')}"
            + (f" | note: {qs[:200]}" if qs else ""))
    ctx = "\n".join(ctx_lines) if ctx_lines else "(no similar issues found)"

    prompt = (
        f"You are {ASSISTANT_NAME}, a PMO delivery advisor. A NEW task/report is described below. "
        "Using the SIMILAR PAST PROJECTS from this portfolio (with their outcome, duration and status "
        "notes), advise concisely: (1) which past projects are most relevant and what to reuse from how "
        "they were handled, (2) a realistic effort/duration estimate based on them, (3) the main risks, "
        "(4) concrete next steps. Reference the issue keys. Plain text, no Markdown, answer in the same "
        f"language as the input.\n\nNEW TASK:\n{text[:3000]}\n\nSIMILAR PAST PROJECTS:\n{ctx}\n\nADVICE:")
    out, source = _llm(prompt)
    if not out:
        done = [s for s in similar if s["is_done"] and s["duration_days"] is not None]
        if done:
            avg = round(sum(s["duration_days"] for s in done) / len(done))
            out = ("Most similar completed projects: "
                   + "; ".join(f"{s['key']} ({s['duration_days']}d)" for s in done[:4])
                   + f". Reuse their delivery approach; expected duration ≈ {avg} days. "
                   "Confirm scope, assign an owner and set milestones.")
        else:
            out = ("No closely matching completed projects found — treat this as a new initiative: "
                   "define scope and acceptance criteria, assign a PM, and set clear milestones.")
        source = "grounded"
    return {"recommendation": out, "source": source, "similar": similar}


_MONTHS = {
    "january": 1, "jan": 1, "январ": 1, "yanvar": 1,
    "february": 2, "feb": 2, "феврал": 2, "fevral": 2,
    "march": 3, "mar": 3, "март": 3, "mart": 3,
    "april": 4, "apr": 4, "апрел": 4, "aprel": 4,
    "may": 5, "май": 5, "may": 5,
    "june": 6, "jun": 6, "июн": 6, "iyun": 6,
    "july": 7, "jul": 7, "июл": 7, "iyul": 7,
    "august": 8, "aug": 8, "август": 8, "avgust": 8,
    "september": 9, "sep": 9, "сентябр": 9, "sentabr": 9,
    "october": 10, "oct": 10, "октябр": 10, "oktabr": 10,
    "november": 11, "nov": 11, "ноябр": 11, "noyabr": 11,
    "december": 12, "dec": 12, "декабр": 12, "dekabr": 12,
}


def detect_action(question: str):
    """Map a natural-language request to a dashboard UI action. Deterministic,
    multilingual (EN/RU/UZ). Returns an action dict or None. This is what lets
    Temur 'drive' the dashboard: open the TTM analysis, a drill-down list, an
    issue, or the data-quality panel — optionally pre-filtered by year/quarter/month."""
    import re
    ql = " " + (question or "").lower() + " "

    ym = re.search(r"\b(20\d{2})\b", ql)
    year = ym.group(1) if ym else None
    quarter = None
    qm = re.search(r"q\s*([1-4])|([1-4])\s*(?:кв|quarter|chorak|квартал)", ql)
    if qm and year:
        quarter = f"{year}-Q{qm.group(1) or qm.group(2)}"
    month = None
    mm = re.search(r"(20\d{2})[-/.](\d{1,2})\b", ql)
    if mm:
        month = f"{mm.group(1)}-{int(mm.group(2)):02d}"
    elif year:
        for name, num in _MONTHS.items():
            if name in ql:
                month = f"{year}-{num:02d}"
                break

    def has(*xs):
        return any(x in ql for x in xs)

    type_f = "all"
    if has("epic", "эпик", "эпиков", "epik"):
        type_f = "Epic"
    elif has("new feature", "feature", "фич", "новая функц", "yangi funksiya"):
        type_f = "New Feature"

    # issue detail: a Jira key explicitly referenced
    km = re.search(r"\b([a-z]{2,}-\d+)\b", ql)
    if km:
        return {"type": "open_issue", "params": {"key": km.group(1).upper()}}

    # TTM analysis
    if has("ttm", "time to market", "ттм", "lead time", "лид тайм", "цикл", "длительност", "davomiylik"):
        if month:
            period, value = "month", month
        elif quarter:
            period, value = "quarter", quarter
        elif year:
            period, value = "year", year
        else:
            period, value = "all", ""
        return {"type": "open_ttm", "params": {"type": type_f, "period": period, "value": value}}

    # data quality
    if has("data qual", "sifat", "качеств", "field coverage", "покрыти", "qamrov"):
        return {"type": "open_dq"}

    # drill-down lists by completion state
    if has("declin", "отклон", "отмен", "rad et"):
        return {"type": "drill", "state": "declined", "scope": "epics"}
    if has("completed", "complete", "заверш", "выполн", "yakunlang", "tugat", "tamomlang"):
        return {"type": "drill", "state": "completed", "scope": "epics"}
    if has("open project", "открыт", "ochiq", "в работе", "unfinished", "не заверш"):
        return {"type": "drill", "state": "open", "scope": "epics"}
    return None


_STATE_L = {
    "open": {"en": "open", "ru": "открытые", "uz": "ochiq"},
    "completed": {"en": "completed", "ru": "завершённые", "uz": "yakunlangan"},
    "declined": {"en": "declined", "ru": "отклонённые", "uz": "rad etilgan"},
}


def _action_message(a: dict, lang: str = "en") -> str:
    L = lang if lang in ("en", "ru", "uz") else "en"
    t = a.get("type")
    if t == "open_ttm":
        p = a["params"]
        allw = {"en": "all types", "ru": "все типы", "uz": "barcha turlar"}[L]
        scope = p["type"] if p["type"] != "all" else allw
        per = f" · {p['value']}" if p.get("value") else ""
        return {"en": f"Opening TTM analysis ({scope}{per}).",
                "ru": f"Открываю анализ TTM ({scope}{per}).",
                "uz": f"TTM tahlilini ochyapman ({scope}{per})."}[L]
    if t == "drill":
        st = _STATE_L.get(a.get("state", ""), {}).get(L, a.get("state", ""))
        return {"en": f"Showing {st} portfolio projects.",
                "ru": f"Показываю {st} проекты портфеля.",
                "uz": f"{st} portfel loyihalarini ko‘rsatyapman."}[L]
    if t == "open_issue":
        k = a["params"]["key"]
        return {"en": f"Opening issue {k}.", "ru": f"Открываю задачу {k}.",
                "uz": f"{k} masalasini ochyapman."}[L]
    if t == "open_dq":
        return {"en": "Opening the data-quality panel.",
                "ru": "Открываю панель качества данных.",
                "uz": "Ma’lumot sifati panelini ochyapman."}[L]
    return {"en": "Done.", "ru": "Готово.", "uz": "Tayyor."}[L]


_LANG_NAME = {"en": "English", "ru": "Russian", "uz": "Uzbek"}


def ask(question: str, payload: dict, lang: str = "en", scope: str = None, context: str = None) -> dict:
    L = lang if lang in ("en", "ru", "uz") else "en"

    # Teach intent: persist a fact locally so Temur "learns" across sessions.
    fact = _teach_match(question)
    if fact:
        remember_fact(fact)
        msg = {"en": f"Got it — I’ll remember: {fact}",
               "ru": f"Понял — запомню: {fact}",
               "uz": f"Tushundim — eslab qolaman: {fact}"}[L]
        _log_interaction(question, msg)
        return {"answer": msg, "source": "memory", "action": None,
                "assistant": ASSISTANT_NAME, "grounded_on": "memory"}

    # PAGE scope: answer using ONLY the on-screen popup data the user is looking at.
    if scope == "page" and context:
        ctx = context[:6000]
        prompt = (
            f"You are {ASSISTANT_NAME}, a sharp portfolio analyst. The user is looking at a specific "
            "view (a popup) and wants an answer based ONLY on the on-screen data below — do not use "
            "outside knowledge or other parts of the portfolio. Be concise (2-4 sentences), specific "
            "with the items/numbers shown. Plain text only — no Markdown, asterisks or bullets. "
            f"Reply in {_LANG_NAME[L]} (or the language of the question).\n\n"
            f"ON-SCREEN DATA (\"{(context.splitlines() or [''])[0][:80]}\"):\n{ctx}\n\n"
            f"QUESTION: {question}\n\nANSWER:"
        )
        answer, source = _llm(prompt)
        if not answer:
            answer = _extractive(ctx, 4) or {"en": "I couldn't read this view's data.",
                                             "ru": "Не удалось прочитать данные этого экрана.",
                                             "uz": "Bu sahifa ma'lumotini o'qiy olmadim."}[L]
            source = "grounded"
        _log_interaction(question, answer)
        return {"answer": answer, "source": source, "action": None,
                "assistant": ASSISTANT_NAME, "grounded_on": "page"}

    # Dashboard-control intent: act immediately (no LLM wait) so the UI responds
    # instantly — Temur drives the dashboard like an assistant.
    action = detect_action(question)
    if action:
        msg = _action_message(action, L)
        _log_interaction(question, msg)
        return {"answer": msg, "source": "action", "action": action,
                "assistant": ASSISTANT_NAME, "grounded_on": "active_dataset"}

    analytics = payload["analytics"]
    kpis = payload["kpis"]
    ctx = _context(analytics, kpis)
    facts = _load_facts()
    facts_ctx = ("\n\nKNOWN FACTS (taught by the user, treat as authoritative):\n"
                 + "\n".join("- " + f["text"] for f in facts[-15:])) if facts else ""
    prompt = (
        f"You are {ASSISTANT_NAME}, a sharp, friendly portfolio analyst for a Jira PMD/PMO "
        "portfolio. Reply like a helpful human colleague: natural, warm, concise (2-4 sentences), "
        "and specific with numbers. Use the portfolio facts and the user-taught facts. "
        "Write PLAIN TEXT only — never use Markdown, asterisks, '#' or bullet characters. "
        f"Reply in {_LANG_NAME[L]} (or the language of the question if it differs).\n\n"
        f"PORTFOLIO FACTS:\n{ctx}{facts_ctx}\n\nQUESTION: {question}\n\nANSWER:"
    )
    answer, source = _llm(prompt)
    if not answer:
        answer, source = _rule_based(question, analytics, kpis), "grounded"
    _log_interaction(question, answer)
    return {"answer": answer, "source": source, "action": None,
            "assistant": ASSISTANT_NAME, "grounded_on": "active_dataset"}
