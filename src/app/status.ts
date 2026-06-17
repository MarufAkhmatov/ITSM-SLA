// Shared status color mapping. Works for both canonical (DONE, IN PROGRESS …)
// and raw RU/EN statuses (Запущено, В работе, Need Info …) via keyword match.
//
//  green  → done / closed / завершено / запущено
//  red    → declined / отменено
//  blue   → analysis / initiation / in progress / architecture review / approval / testing
//  grey   → validation / backlog
//  lightgrey → need info / suspended / отложено

export type StatusKind = "green" | "blue" | "red" | "grey" | "lightgrey";

const COLORS: Record<StatusKind, string> = {
  green: "#2e9e5f",
  blue: "#3b82c4",
  red: "#e0574f",
  grey: "#7c8a9a",
  lightgrey: "#aab4c0",
};

export function statusKind(status: string): StatusKind {
  const s = (status || "").toLowerCase().trim();
  const has = (...xs: string[]) => xs.some((x) => s.includes(x));

  // green — finished
  if (has("done", "closed", "resolved", "complete", "launch",
          "заверш", "запущ", "готов", "выполн", "сделан")) return "green";
  // red — declined / cancelled
  if (has("declin", "reject", "cancel", "отмен", "отклон")) return "red";
  // light grey — parked / waiting on someone
  if (has("need info", "need-info", "needinfo", "suspend", "on hold", "on-hold",
          "pending", "отлож", "приостанов", "ожидан")) return "lightgrey";
  // blue — actively moving through the pipeline
  if (has("analys", "анализ", "initiat", "иници", "in progress", "in-progress",
          "в работе", "в разраб", "architect", "архитект", "approv", "согласов",
          "test", "тест", "pilot", "пилот", "development", "разраб")) return "blue";
  // grey — not started yet
  if (has("validation", "валидаци", "backlog", "беклог", "to do", "todo",
          "new", "open", "открыт", "отложенн")) return "grey";

  return "grey";
}

export function statusColor(status: string): string {
  return COLORS[statusKind(status)];
}

// For button-like badges: a tinted background + solid text/border in the kind color.
export function statusChip(status: string): {
  color: string; background: string; border: string;
} {
  const c = COLORS[statusKind(status)];
  return { color: c, background: `${c}22`, border: `1px solid ${c}55` };
}
