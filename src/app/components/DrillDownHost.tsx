import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { jiraUrl } from "../jira";
import { openIssue } from "../issue";
import { statusColor } from "../status";
import { usePopupOpenSignal, useTemurBesidePad, setPageContext } from "../popup";

// Logical pipeline order for status groups in the drill-down list.
const STATUS_ORDER = [
  "BACKLOG", "VALIDATION", "ANALYSIS", "ARCHITECTURE REVIEW", "INITIATION",
  "IN PROGRESS", "TESTING", "PILOT IO", "DONE", "DECLINED",
];
const ordIndex = (s: string) => {
  const i = STATUS_ORDER.indexOf((s || "").toUpperCase());
  return i === -1 ? STATUS_ORDER.length : i;
};

export function DrillDownHost() {
  const { drill, data } = usePortfolio();
  const { t } = useI18n();
  const base = data?.meta?.jira_base;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  usePopupOpenSignal(open);   // float Temur on top while this popup is open
  const besidePad = useTemurBesidePad();

  useEffect(() => {
    const handler = (e: Event) => {
      const { title, params } = (e as CustomEvent).detail;
      setTitle(title);
      setOpen(true);
      setLoading(true);
      setRows([]);
      setCollapsed(new Set());
      drill(params).then((r) => {
        setRows(r.issues || []);
        setCount(r.count ?? (r.issues || []).length);
        setLoading(false);
      });
    };
    window.addEventListener("pn-drill", handler);
    return () => window.removeEventListener("pn-drill", handler);
  }, [drill]);

  // Publish this list as Temur's "page context" so it can answer from this view.
  useEffect(() => {
    if (!open) return;
    const text = `${title} (${rows.length})\n` + rows.slice(0, 80).map((r) =>
      `${r.key} — ${r.summary || ""} [${r.status || ""}] PM:${r.pm || ""}${r.duration_days != null ? ` ${r.duration_days}d` : ""}`).join("\n");
    setPageContext({ title, text });
    return () => setPageContext(null);
  }, [open, rows, title]);

  // Group issues by status, ordered along the pipeline.
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const s = r.status || "—";
      (map.get(s) || map.set(s, []).get(s)!).push(r);
    }
    return [...map.entries()]
      .map(([status, items]) => ({ status, items }))
      .sort((a, b) => ordIndex(a.status) - ordIndex(b.status) || a.status.localeCompare(b.status));
  }, [rows]);

  const toggle = (s: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 350, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}
        >
          <motion.div
            initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 640, maxWidth: "95vw", height: "min(80vh, 720px)", padding: 22, display: "flex", flexDirection: "column" }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>{title}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--soft)" }}>{loading ? t("dd_loading") : `${count} ${t("dd_items")}`}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} color="#6b7a8d" />
              </button>
            </div>

            {/* header row */}
            <div style={{ display: "grid", gridTemplateColumns: "92px 2.3fr 0.72fr 0.8fr 40px", gap: 6, fontSize: "0.66rem", color: "var(--muted)", paddingBottom: 6, borderBottom: "1px solid var(--divider)" }}>
              <span>{t("dd_key")}</span><span>{t("dd_summary")}</span><span>{t("dd_status")}</span><span>{t("dd_pm")}</span><span style={{ textAlign: "right" }}>{t("dd_days")}</span>
            </div>

            <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
              {!loading && rows.length === 0 && (
                <div style={{ padding: 18, fontSize: "0.8rem", color: "var(--muted)" }}>{t("dd_none")}</div>
              )}
              {groups.map(({ status, items }) => {
                const isCollapsed = collapsed.has(status);
                const c = statusColor(status);
                return (
                  <div key={status}>
                    {/* Group header — collapsible */}
                    <div
                      onClick={() => toggle(status)}
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 6px", cursor: "pointer", position: "sticky", top: 0, background: "var(--card)", zIndex: 1, borderBottom: "1px solid var(--divider)" }}
                    >
                      {isCollapsed ? <ChevronRight size={14} color="#9aa5b4" /> : <ChevronDown size={14} color="#9aa5b4" />}
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: c, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: c }}>{status}</span>
                      <span style={{ fontSize: "0.66rem", fontWeight: 600, color: c, background: `${c}1f`, borderRadius: 999, padding: "1px 8px" }}>{items.length}</span>
                    </div>
                    {/* Issues in this group */}
                    {!isCollapsed && items.map((r) => (
                      <div key={r.key} style={{ display: "grid", gridTemplateColumns: "92px 2.3fr 0.72fr 0.8fr 40px", gap: 6, alignItems: "center", padding: "8px 0 8px 21px", borderBottom: "1px solid var(--divider)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                          <span className="jira-link" onClick={() => openIssue(r.key)} title={t("tip_view_details")} style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--text)" }}>{r.key}</span>
                          <a href={jiraUrl(r.key, r.url, base)} target="_blank" rel="noopener noreferrer" title={t("tip_open_jira")} style={{ display: "flex", color: "#9aa5b4", flexShrink: 0 }}><ExternalLink size={10} /></a>
                        </span>
                        <span className="jira-link" onClick={() => openIssue(r.key)} title={t("tip_view_details")} style={{ fontSize: "0.72rem", color: "var(--soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>
                          {r.summary || "—"}
                        </span>
                        <span style={{ fontSize: "0.66rem", fontWeight: 600, color: statusColor(r.status), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.status}>{r.status}</span>
                        <span style={{ fontSize: "0.7rem", color: "var(--soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.pm}>{r.pm}</span>
                        <span style={{ fontSize: "0.7rem", color: "var(--muted)", textAlign: "right" }}>{r.duration_days ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
