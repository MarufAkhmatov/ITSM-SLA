import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, PlusCircle, ZoomIn, ZoomOut } from "lucide-react";
import { useI18n, type Lang } from "../i18n";
import { usePortfolio } from "../portfolio";
import { openIssue } from "../issue";
import { statusColor } from "../status";
import { useBreakpoint } from "../useBreakpoint";

type Gran = "day" | "week" | "month" | "year";
type Mode = "resolved" | "created";

const ACCENT = "#0c5563";
const MIN_GRID = 840;   // natural width of the 7-column grid → scroll instead of squish

/* ---------- localized names (Monday-first; not browser-ICU dependent) ---------- */
const MONTHS: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"],
};
const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
};

/* ---------- localized summary phrasing (with RU plural forms) ---------- */
const ruPl = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
const PHRASE: Record<Lang, any> = {
  en: { day: "On this day", week: "This week", month: "This month", year: "This year",
        resolved: "closed", created: "created",
        p: (n: number) => (n === 1 ? "project" : "projects"), t: (n: number) => (n === 1 ? "task" : "tasks") },
  ru: { day: "За этот день", week: "На этой неделе", month: "В этом месяце", year: "В этом году",
        resolved: "закрыто", created: "создано",
        p: (n: number) => ruPl(n, "проект", "проекта", "проектов"), t: (n: number) => ruPl(n, "задача", "задачи", "задач") },
  uz: { day: "Shu kuni", week: "Shu hafta", month: "Shu oy", year: "Shu yil",
        resolved: "yopildi", created: "yaratildi",
        p: () => "loyiha", t: () => "vazifa" },
};

/* ---------------- date helpers ---------------- */
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0, 0, 0, 0); return x; };
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const wIdx = (d: Date) => (d.getDay() + 6) % 7;   // Monday=0

const pill = (active: boolean): React.CSSProperties => ({
  padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.72rem",
  fontWeight: active ? 600 : 400, background: active ? ACCENT : "var(--surface2)",
  color: active ? "#fff" : "var(--soft)", fontFamily: "var(--font-sans)", transition: "all 0.15s",
});
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: "1px solid var(--divider)", cursor: "pointer", background: "var(--surface2)",
  color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};

export function CalendarView() {
  const { t, lang } = useI18n();
  const { calendar } = usePortfolio();
  const bp = useBreakpoint();
  const [mode, setMode] = useState<Mode>("resolved");
  const [gran, setGran] = useState<Gran>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [zoom, setZoom] = useState(1);   // pinch-like zoom for the calendar grid
  const [cache, setCache] = useState<Record<Mode, any[]>>({ resolved: [], created: [] });
  const [loaded, setLoaded] = useState<Record<Mode, boolean>>({ resolved: false, created: false });

  // Fetch each mode's events once, then cache (filtering happens client-side).
  useEffect(() => {
    if (loaded[mode]) return;
    calendar({ mode }).then((r) => {
      setCache((c) => ({ ...c, [mode]: r.events || [] }));
      setLoaded((l) => ({ ...l, [mode]: true }));
    });
  }, [mode, loaded, calendar]);

  const events = cache[mode];
  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of events) { const a = m.get(e.date) || m.set(e.date, []).get(e.date)!; a.push(e); }
    return m;
  }, [events]);

  const wd = WEEKDAYS[lang] || WEEKDAYS.en;
  const mo = MONTHS[lang] || MONTHS.en;

  // Date range covered by the current view (for the top summary).
  const range = useMemo<[string, string]>(() => {
    if (gran === "day") return [iso(anchor), iso(anchor)];
    if (gran === "week") { const s = startOfWeek(anchor); return [iso(s), iso(addDays(s, 6))]; }
    if (gran === "month") return [iso(startOfMonth(anchor)), iso(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))];
    return [`${anchor.getFullYear()}-01-01`, `${anchor.getFullYear()}-12-31`];
  }, [gran, anchor]);

  // How many projects (epics) vs tasks are in the visible period.
  const stat = useMemo(() => {
    const [s, e] = range;
    let proj = 0, task = 0;
    for (const ev of events) if (ev.date >= s && ev.date <= e) (ev.is_epic ? proj++ : task++);
    return { proj, task };
  }, [events, range]);

  const summary = useMemo(() => {
    const ph = PHRASE[lang] || PHRASE.en;
    const pw = `${stat.proj} ${ph.p(stat.proj)}`;
    const tw = `${stat.task} ${ph.t(stat.task)}`;
    const verb = mode === "resolved" ? ph.resolved : ph.created;
    return lang === "uz" ? `${ph[gran]} ${pw}, ${tw} ${verb}` : `${ph[gran]} ${verb}: ${pw}, ${tw}`;
  }, [lang, gran, mode, stat]);

  const step = (dir: number) => {
    const d = new Date(anchor);
    if (gran === "day") d.setDate(d.getDate() + dir);
    else if (gran === "week") d.setDate(d.getDate() + dir * 7);
    else if (gran === "month") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setAnchor(d);
  };

  const periodLabel = () => {
    if (gran === "day") return `${wd[wIdx(anchor)]}, ${anchor.getDate()} ${mo[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (gran === "week") {
      const s = startOfWeek(anchor), e = addDays(s, 6);
      return s.getMonth() === e.getMonth()
        ? `${s.getDate()}–${e.getDate()} ${mo[s.getMonth()]} ${s.getFullYear()}`
        : `${s.getDate()} ${mo[s.getMonth()]} – ${e.getDate()} ${mo[e.getMonth()]} ${e.getFullYear()}`;
    }
    if (gran === "month") return `${mo[anchor.getMonth()]} ${anchor.getFullYear()}`;
    return String(anchor.getFullYear());
  };

  const today = new Date();
  const dayEvents = (d: Date) => byDay.get(iso(d)) || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: bp === "desktop" ? 0 : "calc(100dvh - 150px)", background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", overflow: "hidden" }}>
      {/* ---------- toolbar ---------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "16px 18px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CalendarDays size={18} color={ACCENT} />
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: 300, color: "var(--text)" }}>{t("cal_title")}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Resolved / Created toggle */}
        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: "var(--surface2)" }}>
          <button onClick={() => setMode("resolved")} style={{ ...pill(mode === "resolved"), display: "flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={13} /> {t("cal_resolved")}
          </button>
          <button onClick={() => setMode("created")} style={{ ...pill(mode === "created"), display: "flex", alignItems: "center", gap: 5 }}>
            <PlusCircle size={13} /> {t("cal_created")}
          </button>
        </div>

        {/* Granularity */}
        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: "var(--surface2)" }}>
          {(["day", "week", "month", "year"] as Gran[]).map((g) => (
            <button key={g} onClick={() => setGran(g)} style={pill(gran === g)}>{t("cal_" + g)}</button>
          ))}
        </div>
      </div>

      {/* ---------- period nav ---------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px 12px", flexWrap: "wrap" }}>
        <button onClick={() => step(-1)} style={iconBtn} title="‹"><ChevronLeft size={16} /></button>
        <button onClick={() => step(1)} style={iconBtn} title="›"><ChevronRight size={16} /></button>
        <button onClick={() => setAnchor(new Date())} style={{ ...pill(false), padding: "6px 14px" }}>{t("cal_today")}</button>
        {/* zoom out / in */}
        <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))} style={iconBtn} title="−"><ZoomOut size={15} /></button>
        <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))} style={iconBtn} title="+"><ZoomIn size={15} /></button>
        <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{periodLabel()}</span>
        <div style={{ flex: 1 }} />
        {/* period summary: how many projects vs tasks — green when resolved, amber when created */}
        {(() => {
          const sc = mode === "resolved" ? "#2d7a5f" : "#d4a84b";
          return (
            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: sc, background: `${sc}14`, border: `1px solid ${sc}44`, padding: "5px 12px", borderRadius: 999 }}>
              {summary}
            </span>
          );
        })()}
      </div>

      {/* ---------- body — scrolls both ways; zoom scales the whole grid ---------- */}
      <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 18px 18px", borderTop: "1px solid var(--divider)" }}>
        <div style={{ zoom, height: "100%" } as React.CSSProperties}>
          {gran === "day" && <DayView events={dayEvents(anchor)} t={t} />}
          {gran === "week" && <WeekView start={startOfWeek(anchor)} wd={wd} today={today} dayEvents={dayEvents} />}
          {gran === "month" && (
            <MonthView anchor={anchor} wd={wd} today={today} dayEvents={dayEvents}
              onDay={(d) => { setAnchor(d); setGran("day"); }} />
          )}
          {gran === "year" && (
            <YearView year={anchor.getFullYear()} events={events} mo={mo} t={t}
              onMonth={(m) => { setAnchor(new Date(anchor.getFullYear(), m, 1)); setGran("month"); }} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== event chip ===================== */
function EventChip({ e, compact }: { e: any; compact?: boolean }) {
  const { t } = useI18n();
  const c = statusColor(e.status);
  // Epic → "Project", anything else (task/bug/story/feature) → "Task".
  const label = e.is_epic ? t("cal_epic_label") : t("cal_task_label");
  return (
    <div
      onClick={() => openIssue(e.key)}
      title={`${label} · ${e.key} · ${e.summary} · ${e.pm} · ${e.status}`}
      style={{
        display: "flex", alignItems: "stretch", borderRadius: 6, overflow: "hidden",
        cursor: "pointer", background: "var(--surface2)", minHeight: compact ? 22 : 58,
      }}
    >
      {/* vertical side label, stuck to the left edge, reads bottom-to-top */}
      <div
        style={{
          flexShrink: 0, background: c, color: "#fff", display: "flex",
          alignItems: "center", justifyContent: "center", fontWeight: 700,
          ...(compact
            ? { width: 14, fontSize: "0.62rem" }
            : { writingMode: "vertical-rl", transform: "rotate(180deg)", padding: "5px 1px", fontSize: "0.52rem", letterSpacing: 0.6, textTransform: "uppercase" }),
        }}
      >
        {compact ? label[0] : label}
      </div>
      {/* ticket body */}
      {compact ? (
        <div style={{ flex: 1, minWidth: 0, padding: "2px 6px", display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>{e.key}</span>
          <span style={{ fontSize: "0.58rem", color: "var(--soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.summary || "—"}</span>
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0, padding: "6px 9px", display: "flex", flexDirection: "column", gap: 2, justifyContent: "center" }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text)" }}>{e.key}</span>
          {/* full issue name — wraps, ticket grows downward to fit */}
          <span style={{ fontSize: "0.66rem", color: "var(--soft)", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.3 }}>{e.summary || "—"}</span>
          <span style={{ fontSize: "0.6rem", color: "var(--muted)" }}>{e.pm || "—"}</span>
        </div>
      )}
    </div>
  );
}

/* ===================== day view ===================== */
function DayView({ events, t }: { events: any[]; t: (k: string) => string }) {
  if (!events.length) return <Empty t={t} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 760, margin: "8px auto 0" }}>
      {events.map((e) => <EventChip key={e.key} e={e} />)}
    </div>
  );
}

/* ===================== week view ===================== */
function WeekView({ start, wd, today, dayEvents }: any) {
  const days = [...Array(7)].map((_, i) => addDays(start, i));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: "100%", minWidth: MIN_GRID, borderTop: "1px solid var(--divider)", marginTop: 8 }}>
      {days.map((d, i) => {
        const evs = dayEvents(d);
        const isToday = sameDay(d, today);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, padding: "8px 6px", borderRight: i < 6 ? "1px solid var(--divider)" : "none" }}>
            <div style={{ textAlign: "center", paddingBottom: 6, borderBottom: `2px solid ${isToday ? ACCENT : "var(--divider)"}` }}>
              <div style={{ fontSize: "0.62rem", color: "var(--muted)", textTransform: "uppercase" }}>{wd[i]}</div>
              <div style={{ fontSize: "1.05rem", fontWeight: isToday ? 700 : 400, color: isToday ? ACCENT : "var(--text)" }}>{d.getDate()}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {evs.length ? evs.map((e: any) => <EventChip key={e.key} e={e} />)
                : <span style={{ fontSize: "0.6rem", color: "var(--muted)", textAlign: "center", padding: "6px 0" }}>—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== month view ===================== */
function MonthView({ anchor, wd, today, dayEvents, onDay }: any) {
  const first = startOfWeek(startOfMonth(anchor));
  const cells = [...Array(42)].map((_, i) => addDays(first, i));
  const month = anchor.getMonth();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: MIN_GRID, marginTop: 8, border: "1px solid var(--divider)", borderRadius: 10, overflow: "hidden" }}>
      {/* weekday header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {wd.map((w: string, i: number) => (
          <div key={i} style={{ fontSize: "0.62rem", color: "var(--muted)", textTransform: "uppercase", textAlign: "center", padding: "6px 0", borderRight: i < 6 ? "1px solid var(--divider)" : "none", borderBottom: "1px solid var(--divider)" }}>{w}</div>
        ))}
      </div>
      {/* day cells — continuous thin-line grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "1fr", flex: 1, minHeight: 0 }}>
        {cells.map((d, i) => {
          const evs = dayEvents(d);
          const isToday = sameDay(d, today);
          const dim = d.getMonth() !== month;
          const shown = evs.slice(0, 3);
          const lastCol = i % 7 === 6, lastRow = i >= 35;
          return (
            <div key={i} style={{
              borderRight: lastCol ? "none" : "1px solid var(--divider)",
              borderBottom: lastRow ? "none" : "1px solid var(--divider)",
              padding: 5, display: "flex", flexDirection: "column", gap: 3, minHeight: 78,
              background: isToday ? `${ACCENT}12` : "transparent", opacity: dim ? 0.4 : 1, overflow: "hidden",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.66rem", fontWeight: isToday ? 700 : 500, color: isToday ? ACCENT : "var(--text)" }}>{d.getDate()}</span>
                {evs.length > 0 && <span style={{ fontSize: "0.55rem", fontWeight: 700, color: ACCENT, background: `${ACCENT}18`, borderRadius: 999, padding: "0 5px" }}>{evs.length}</span>}
              </div>
              {shown.map((e: any) => <EventChip key={e.key} e={e} compact />)}
              {evs.length > 3 && (
                <button onClick={() => onDay(d)} style={{ fontSize: "0.56rem", color: ACCENT, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                  +{evs.length - 3}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== year view ===================== */
function YearView({ year, events, mo, onMonth, t }: any) {
  const counts = useMemo(() => {
    const c = new Array(12).fill(0);
    for (const e of events) {
      if (e.date && e.date.startsWith(String(year))) {
        const m = Number(e.date.slice(5, 7)) - 1;
        if (m >= 0 && m < 12) c[m] += 1;
      }
    }
    return c;
  }, [events, year]);
  const max = Math.max(1, ...counts);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, paddingTop: 8 }}>
      {counts.map((n, m) => (
        <button key={m} onClick={() => onMonth(m)} style={{
          display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 12, cursor: "pointer",
          border: "1px solid var(--divider)", background: "var(--surface2)", textAlign: "left",
        }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)" }}>{mo[m]}</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 300, color: n ? ACCENT : "var(--muted)", lineHeight: 1 }}>{n}</span>
          <div style={{ height: 6, borderRadius: 999, background: "var(--divider)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(n / max) * 100}%`, background: ACCENT, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{t("cal_events")}</span>
        </button>
      ))}
    </div>
  );
}

function Empty({ t }: { t: (k: string) => string }) {
  return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>{t("cal_no_events")}</div>;
}
