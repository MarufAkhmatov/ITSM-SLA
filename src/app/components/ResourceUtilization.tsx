import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, Users, CalendarDays, Maximize2 } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

type Staff = {
  name: string; total: number; done: number; in_progress: number; todo: number;
  request_type_count: number;
  top_request_types: { name: string; count: number }[];
  reaction_pass_rate_pct: number | null;
  resolution_pass_rate_pct: number | null;
};
type PerType = { name: string; total: number; assignee_count: number; assignees: { name: string; count: number }[] };

const rateColor = (v: number | null) => (v == null ? "var(--muted)" : v >= 90 ? "#2d7a5f" : v >= 75 ? "#d4a84b" : "#e07a7a");

export function ResourceUtilization({ onMaximize }: { onMaximize?: () => void } = {}) {
  const { data } = usePortfolio();
  const { t } = useI18n();
  const ru = (data?.widgets as any)?.resource_utilization;
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Staff | null>(null);
  const [mode, setMode] = useState<"staff" | "byType">("staff");

  const staff: Staff[] = ru?.staff || [];
  const perType: PerType[] = ru?.per_request_type || [];

  const fStaff = useMemo(() => staff.filter(s => s.name.toLowerCase().includes(q.toLowerCase())), [staff, q]);
  const fType = useMemo(() => perType.filter(p => p.name.toLowerCase().includes(q.toLowerCase())), [perType, q]);

  if (!ru || !staff.length) return null;

  return (
    <div className="p-6 flex flex-col gap-3" style={{ height: "100%" }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, overflow: "hidden" }}>
          <Users size={16} color="#0c5563" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>{t("res_title")}</span>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {ru.total_staff} {t("sla_assignees")} · {ru.total_request_types} {t("up_projects")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", borderRadius: 999, background: "var(--surface2)", padding: 3 }}>
            {(["staff", "byType"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 600, background: mode === m ? "var(--card)" : "transparent", color: mode === m ? "var(--text)" : "var(--muted)" }}>
                {m === "staff" ? t("res_by_staff") : t("res_by_type")}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 12px", background: "var(--surface2)" }}>
            <Search size={13} color="#6b7a8d" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("res_search")}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.74rem", color: "var(--text)", width: 130 }} />
          </div>
          {onMaximize && (
            <button onClick={onMaximize} title={t("panel_maximize")}
              style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Maximize2 size={14} color="#6b7a8d" />
            </button>
          )}
        </div>
      </div>

      <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {mode === "staff" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "var(--card)", zIndex: 1, textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>{t("res_staff")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>{t("res_tickets")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "center" }}>{t("sla_done")}/{t("sla_wip")}/{t("sla_todo")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>{t("res_types")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>SLA %</th>
              </tr>
            </thead>
            <tbody>
              {fStaff.map(s => (
                <tr key={s.name} onClick={() => setSel(s)} style={{ cursor: "pointer", borderTop: "1px solid var(--divider)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "7px 8px", color: "var(--text)", fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--text)", fontWeight: 600 }}>{s.total}</td>
                  <td style={{ padding: "7px 8px", textAlign: "center", color: "var(--soft)" }}>
                    <span style={{ color: "#2d7a5f" }}>{s.done}</span> / <span style={{ color: "#d4a84b" }}>{s.in_progress}</span> / <span style={{ color: "#6b7a8d" }}>{s.todo}</span>
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--soft)" }}>{s.request_type_count}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>
                    <span style={{ color: rateColor(s.reaction_pass_rate_pct), fontWeight: 600 }}>{s.reaction_pass_rate_pct ?? "—"}</span>
                    <span style={{ color: "var(--muted)" }}> / </span>
                    <span style={{ color: rateColor(s.resolution_pass_rate_pct), fontWeight: 600 }}>{s.resolution_pass_rate_pct ?? "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "var(--card)", zIndex: 1, textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>{t("sla_crt_col_type")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>{t("sla_crt_col_count")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>{t("res_staff_count")}</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>{t("res_who")}</th>
              </tr>
            </thead>
            <tbody>
              {fType.map(p => (
                <tr key={p.name} style={{ borderTop: "1px solid var(--divider)" }}>
                  <td style={{ padding: "7px 8px", color: "var(--text)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--text)", fontWeight: 600 }}>{p.total}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "#0c5563", fontWeight: 700 }}>{p.assignee_count}</td>
                  <td style={{ padding: "7px 8px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.assignees.slice(0, 6).map(a => {
                        const full = staff.find(s => s.name === a.name);
                        return (
                          <button key={a.name} onClick={() => full && setSel(full)}
                            style={{ border: "none", cursor: full ? "pointer" : "default", borderRadius: 999, padding: "2px 8px", fontSize: "0.66rem", background: "var(--surface2)", color: "var(--soft)" }}>
                            {a.name} <b style={{ color: "var(--text)" }}>{a.count}</b>
                          </button>
                        );
                      })}
                      {p.assignees.length > 6 && <span style={{ fontSize: "0.66rem", color: "var(--muted)", alignSelf: "center" }}>+{p.assignees.length - 6}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {sel && <StaffModal staff={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}

const GRANS = ["day", "week", "month", "year"] as const;
type Gran = typeof GRANS[number];

function StaffModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const { data } = usePortfolio();
  const { t } = useI18n();
  usePopupOpenSignal(true);
  const besidePad = useTemurBesidePad();
  const [gran, setGran] = useState<Gran>("month");

  const rc = (data?.widgets as any)?.resource_calendar;
  const hasDates: boolean = rc?.has_dates;
  const cal = rc?.by_assignee?.[staff.name]?.[gran] as Record<string, number> | undefined;
  const entries = cal ? Object.entries(cal).sort((a, b) => a[0].localeCompare(b[0])) : [];
  const maxV = entries.reduce((m, [, v]) => Math.max(m, v), 0) || 1;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}>
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }} onClick={e => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 620, maxWidth: "94vw", maxHeight: "88vh", padding: 24, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
        <div className="flex items-start justify-between" style={{ gap: 10 }}>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{staff.name}</div>
            <div style={{ fontSize: "0.74rem", color: "var(--soft)", marginTop: 3 }}>
              {staff.total} {t("up_issues")} · {staff.request_type_count} {t("up_projects")} · <span style={{ color: "#2d7a5f" }}>{staff.done} {t("sla_done")}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        {/* SLA pass rates */}
        <div style={{ display: "flex", gap: 24 }}>
          <div><div style={{ fontSize: "0.66rem", color: "var(--muted)", textTransform: "uppercase" }}>{t("sla_react")} SLA</div><div style={{ fontSize: "1.2rem", fontWeight: 700, color: rateColor(staff.reaction_pass_rate_pct) }}>{staff.reaction_pass_rate_pct ?? "—"}%</div></div>
          <div><div style={{ fontSize: "0.66rem", color: "var(--muted)", textTransform: "uppercase" }}>{t("sla_resol")} SLA</div><div style={{ fontSize: "1.2rem", fontWeight: 700, color: rateColor(staff.resolution_pass_rate_pct) }}>{staff.resolution_pass_rate_pct ?? "—"}%</div></div>
        </div>

        {/* Closed-ticket calendar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarDays size={16} color="#0c5563" />
            <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--text)" }}>{t("res_closed_calendar")}</span>
          </div>
          <div style={{ display: "flex", borderRadius: 999, background: "var(--surface2)", padding: 3 }}>
            {GRANS.map(g => (
              <button key={g} onClick={() => setGran(g)} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "4px 11px", fontSize: "0.7rem", fontWeight: 600, background: gran === g ? "var(--card)" : "transparent", color: gran === g ? "var(--text)" : "var(--muted)" }}>
                {t(`gran_${g}`)}
              </button>
            ))}
          </div>
        </div>

        {hasDates && entries.length ? (
          <div style={{ display: "grid", gridTemplateColumns: gran === "day" ? "repeat(auto-fill, minmax(38px, 1fr))" : "repeat(auto-fill, minmax(70px, 1fr))", gap: 6 }}>
            {entries.map(([k, v]) => (
              <div key={k} title={`${k}: ${v}`} style={{ borderRadius: 8, padding: "8px 6px", textAlign: "center", background: `rgba(12,85,99,${0.12 + 0.6 * (v / maxV)})`, border: "1px solid var(--divider)" }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>{v}</div>
                <div style={{ fontSize: "0.56rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "18px 14px", borderRadius: 10, background: "var(--surface2)", fontSize: "0.74rem", color: "var(--soft)", textAlign: "center" }}>
            {t("res_calendar_needs_history")}
          </div>
        )}

        {/* Request types this person handles */}
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{t("res_their_types")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {staff.top_request_types.map(rt => (
              <span key={rt.name} style={{ borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem", background: "var(--surface2)", color: "var(--soft)" }}>
                {rt.name} <b style={{ color: "var(--text)" }}>{rt.count}</b>
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
