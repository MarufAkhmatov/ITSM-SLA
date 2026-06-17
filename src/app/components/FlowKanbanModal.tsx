import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { X, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { openIssue } from "../issue";
import { jiraUrl } from "../jira";
import { statusColor } from "../status";
import { usePopupOpenSignal } from "../popup";

const ORDER = [
  "BACKLOG", "VALIDATION", "NEED INFO", "ANALYSIS", "INITIATION", "ARCHITECTURE REVIEW",
  "IN PROGRESS", "TESTING", "PILOT IO", "DONE", "DECLINED",
];
const ord = (s: string) => { const i = ORDER.indexOf(s); return i === -1 ? ORDER.length : i; };
// Columns collapsed by default (opened on demand, then collapsed again).
const DEFAULT_COLLAPSED = new Set(["VALIDATION", "NEED INFO", "INITIATION", "ARCHITECTURE REVIEW", "DONE", "DECLINED"]);

const sel: React.CSSProperties = {
  background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--divider)",
  borderRadius: 8, padding: "5px 9px", fontSize: "0.74rem", fontFamily: "var(--font-sans)", cursor: "pointer",
};

export function FlowKanbanModal({ onClose }: { onClose: () => void }) {
  const { drill, data } = usePortfolio();
  const { t } = useI18n();
  const base = data?.meta?.jira_base;
  const [epics, setEpics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pm, setPm] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(DEFAULT_COLLAPSED));
  usePopupOpenSignal(true);   // float Temur on top while the Kanban board is open

  useEffect(() => {
    drill({ scope: "epics" }).then((r) => { setEpics(r.issues || []); setLoading(false); });
  }, [drill]);

  const pms = useMemo(() => [...new Set(epics.map((e) => e.pm).filter(Boolean))].sort(), [epics]);
  const shown = pm === "all" ? epics : epics.filter((e) => e.pm === pm);

  const groups: Record<string, any[]> = {};
  for (const e of shown) (groups[e.status] = groups[e.status] || []).push(e);
  const cols = Object.keys(groups).sort((a, b) => ord(a) - ord(b) || a.localeCompare(b)).map((s) => ({ status: s, items: groups[s] }));

  const toggle = (s: string) => setCollapsed((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.55)", backdropFilter: "blur(4px)", zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", width: "96vw", height: "90vh", padding: 20, display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} color="#2d7a5f" />
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{t("patient_flow")}</span>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>· {shown.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>PM:</span>
            <select style={sel} value={pm} onChange={(e) => setPm(e.target.value)}>
              <option value="all">{t("pl_all")}</option>
              {pms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={15} color="#6b7a8d" />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>{t("id_loading")}</div>
        ) : (
          <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden", display: "flex", gap: 10, paddingBottom: 8 }}>
            {cols.map(({ status, items }) => {
              const c = statusColor(status);
              const isCol = collapsed.has(status);

              if (isCol) {
                return (
                  <div key={status} onClick={() => toggle(status)} title={`${status} — ${items.length}`}
                    style={{ width: 42, flexShrink: 0, background: "var(--surface2)", borderRadius: 12, padding: "10px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <ChevronRight size={13} color="#9aa5b4" />
                    <span style={{ fontSize: "0.64rem", fontWeight: 700, color: c, background: `${c}22`, borderRadius: 999, padding: "1px 6px" }}>{items.length}</span>
                    <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: "0.68rem", fontWeight: 700, color: c, whiteSpace: "nowrap" }}>{status}</span>
                  </div>
                );
              }

              return (
                <div key={status} style={{ width: 250, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--surface2)", borderRadius: 12, padding: 8, minHeight: 0 }}>
                  <div onClick={() => toggle(status)} className="flex items-center justify-between" style={{ padding: "4px 6px 8px", borderBottom: `2px solid ${c}`, cursor: "pointer" }}>
                    <span className="flex items-center gap-1" style={{ fontSize: "0.72rem", fontWeight: 700, color: c }}><ChevronLeft size={12} />{status}</span>
                    <span style={{ fontSize: "0.66rem", fontWeight: 700, color: c, background: `${c}22`, borderRadius: 999, padding: "1px 8px" }}>{items.length}</span>
                  </div>
                  <div className="pn-scroll" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, paddingTop: 8, paddingRight: 3 }}>
                    {items.map((e) => (
                      <div key={e.key} onClick={() => openIssue(e.key)}
                        style={{ background: `${c}1a`, borderRadius: 5, borderLeft: `3px solid ${c}`, padding: "8px 10px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.10)" }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                          <a className="jira-link" href={jiraUrl(e.key, e.url, base)} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}
                            style={{ fontSize: "0.7rem", fontWeight: 700, color: "#2d7a5f" }}>{e.key}</a>
                          {e.pm && <span style={{ fontSize: "0.58rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }} title={e.pm}>{e.pm}</span>}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text)", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.summary || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
