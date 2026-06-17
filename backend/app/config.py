"""Central configuration for the Portfolio Intelligence Platform backend."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORAGE = ROOT / "storage"
UPLOADS = STORAGE / "uploads"
CURRENT = STORAGE / "current"
ARCHIVE = STORAGE / "archive"
TEMP = STORAGE / "temp"
EXPORTS = STORAGE / "exports"
LOGS = ROOT / "logs"

for d in (UPLOADS, CURRENT, ARCHIVE, TEMP, EXPORTS, LOGS):
    d.mkdir(parents=True, exist_ok=True)

# Portfolio = Epic; work items = Task / New Feature
EPIC_TYPES = {"epic"}
WORK_TYPES = {"task", "new feature", "story", "bug", "sub-task"}

# Status taxonomy (normalized, upper-cased)
DISCOVERY_STATUSES = {"VALIDATION", "BACKLOG", "ANALYSIS", "ARCHITECTURE REVIEW", "INITIATION"}
DELIVERY_STATUSES = {"IN PROGRESS", "TESTING", "PILOT IO", "DONE"}
DONE_STATUSES = {"DONE", "CLOSED", "RESOLVED", "COMPLETED"}
DECLINED_STATUSES = {"DECLINED", "REJECTED", "CANCELLED", "CANCELED", "WONT DO", "WON'T DO"}

# Synonym map -> canonical status (matched against UPPERCASED original first,
# then against a homoglyph-normalized form). Covers EN + RU + UZ workflows.
STATUS_SYNONYMS = {
    # English
    "TO DO": "BACKLOG", "TODO": "BACKLOG", "OPEN": "BACKLOG", "NEW": "BACKLOG",
    # NOTE: "NEED INFO" is kept as its own status (not folded into BACKLOG) so the
    # Project Flow breakdown can count it separately.
    "NEEDINFO": "NEED INFO", "WAITING FOR INFO": "NEED INFO", "WAITING FOR APPROVAL": "VALIDATION",
    "IN ANALYSIS": "ANALYSIS", "WAITING FOR ANALYSIS": "ANALYSIS",
    "WAITING FOR VALIDATION": "VALIDATION", "IN VALIDATION": "VALIDATION",
    "ARCH REVIEW": "ARCHITECTURE REVIEW", "WAITING FOR ARCHITECTURE REVIEW": "ARCHITECTURE REVIEW",
    "WAITING FOR INITIATION": "INITIATION", "INITIATED": "INITIATION",
    "IN DEVELOPMENT": "IN PROGRESS", "DEVELOPMENT": "IN PROGRESS", "DEV": "IN PROGRESS",
    "IN TESTING": "TESTING", "QA": "TESTING", "TEST": "TESTING",
    "PILOT": "PILOT IO", "PILOT I/O": "PILOT IO", "PILOT-IO": "PILOT IO",
    "RESOLVED": "DONE", "CLOSED": "DONE", "COMPLETED": "DONE", "LAUNCHED": "DONE",
    # Russian (uppercased)
    "В РАБОТЕ": "IN PROGRESS", "В РАЗРАБОТКЕ": "IN PROGRESS", "В РАЗРАБОТКE": "IN PROGRESS",
    "ЗАПУЩЕНО": "DONE", "ГОТОВО": "DONE", "ВЫПОЛНЕНО": "DONE", "СДЕЛАНО": "DONE",
    "БЕКЛОГ": "BACKLOG", "ОТЛОЖЕННЫЕ": "BACKLOG", "ОТКРЫТ": "BACKLOG",
    "ТЕСТИРУЕТСЯ": "TESTING", "ТЕСТИРОВАНИЕ": "TESTING",
    "АНАЛИЗ": "ANALYSIS", "ВАЛИДАЦИЯ": "VALIDATION", "ИНИЦИАЦИЯ": "INITIATION",
    "ОТМЕНЁННЫЕ": "DECLINED", "ОТМЕНЕННЫЕ": "DECLINED", "ОТКЛОНЕНО": "DECLINED", "ОТМЕНА": "DECLINED",
    # Truncation Jira sometimes emits in its History export ("Resolv" instead of
    # "Resolved"). Keep as DONE — this is a real completion state, not a workflow step.
    "RESOLV": "DONE",
}

# WHITELIST. Only these issue types are counted in any report. Everything else
# (Sub-task, Blocker, "Подпроект", "Карточка по проекту", "Статус проекта",
# Story, Bug, future unknowns…) is dropped at ingest by normalize_rows() and
# reported in the status-audit "dead_issue_types" bucket so the user can see
# exactly what was excluded. Per user directive: TTM, throughput, leaderboards
# must reflect ONLY Epic / Task / New Feature work.
ALLOWED_ISSUE_TYPES = {"Epic", "Task", "New Feature"}

# Dead / obsolete Jira statuses that exist in the workflow registry but are NOT
# real process steps for this portfolio. The PMO export still contains daily
# events with these values (e.g. someone clicked through "Корзина Идей" on the
# way to "In Progress"). They WERE polluting TTM phase math. canon_status()
# returns "" for these, and the history parser drops the segments entirely so
# they never reach Discovery/Delivery/Total/Lead calculations.
DEAD_STATUSES = {
    "КОРЗИНА ИДЕЙ", "КОРЗИНА",
    "РЕАЛИЗАЦИЯ",
    "ПРИЁМКА", "ПРИЕМКА",
    "МОНИТОРИНГ, ПОДДЕРЖКА, СБОР ОС",
    "МОНИТОРИНГ, ПОДДЕРЖКА, СБОР OC",  # OC (Latin) vs ОС (Cyr) variant
    "ОТЛОЖЕННЫЕ ПРОЕКТЫ",
    "IN SUPPORT", "IDEA", "KANBAN BACKLOG",
}

# Resolutions that mean the work is finished (completed) vs declined.
RESOLUTION_DONE = {"готово", "resolved", "done", "выполнено", "сделано", "fixed", "complete"}
RESOLUTION_DECLINED = {"declined", "отменённые", "отменённый", "отклонено", "won't do",
                       "wont do", "rejected", "cancelled", "canceled", "отменено", "duplicate"}
RESOLUTION_NONE = {"нет решения", "unresolved", "", "none"}

# AI / ARIA
ARIA_PROVIDER = "ollama"        # ollama | llama | qwen | deepseek
ARIA_MODEL = "llama3.1"
OLLAMA_URL = "http://localhost:11434"
