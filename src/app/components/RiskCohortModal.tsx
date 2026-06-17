import { useEffect } from "react";
import { motion } from "motion/react";
import { X, ExternalLink } from "lucide-react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { openIssue } from "../issue";
import { jiraUrl } from "../jira";
import { usePopupOpenSignal, useTemurBesidePad, setPageContext } from "../popup";

const TEAL = "#0c5563", GREY = "#7c8a9a";
const R = (n: any) => Math.round(Number(n) || 0);

export function RiskCohortModal({ title, items, onClose }: { title: string; items: any[]; onClose: () => void }) {
  const { t, tf } = useI18n();
  const { data } = usePortfolio();
  const base = data?.meta?.jira_base;
  usePopupOpenSignal(true);
  const besidePad = useTemurBesidePad();

  const cat = (c: string) => (c === "Critical" ? t("risk_cat_critical") : c === "Warning" ? t("risk_cat_warning") : c);
  const reason = (it: any) => {
    const r = it.reason || {};
    if (r.type === "health") return tf("rsn_health", { score: R(r.score), cat: cat(r.category) });
    if (r.type === "overdue_children") return tf("rsn_overdue_children", { count: r.count });
    if (r.type === "overdue") return tf("rsn_overdue", { days: R(r.days) });
    if (r.type === "blocked") return tf("rsn_blocked", { by: (r.by || []).join(", ") });
    if (r.type === "wip") return tf("rsn_wip", { status: it.status });
    return "";
  };

  // publish as Temur's page context
  useEffect(() => {
    const text = `${title} (${items.length})\n` + items.slice(0, 80).map((it) =>
      `${it.key} — ${it.summary || ""} | ${it.pm || ""} | ${reason(it)}`).join("\n");
    setPageContext({ title, text });
    return () => setPageContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, items]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 360, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 600, maxWidth: "95vw", height: "min(82vh, 760px)", padding: 22, display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>{title}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--soft)" }}>{items.length}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.length === 0 ? <div style={{ padding: 18, color: "var(--muted)", fontSize: "0.8rem" }}>—</div>
            : items.map((it) => (
              <div key={it.key} onClick={() => openIssue(it.key)} className="jira-link"
                style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 10px", borderRadius: 10, background: "var(--surface2)", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.54rem", fontWeight: 700, textTransform: "uppercase", color: "#fff", background: it.is_epic ? TEAL : GREY, borderRadius: 4, padding: "1px 5px" }}>
                    {it.is_epic ? t("cal_epic_label") : t("cal_task_label")}
                  </span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text)" }}>{it.key}</span>
                  <a href={jiraUrl(it.key, it.url, base)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "flex", color: "#9aa5b4" }}><ExternalLink size={9} /></a>
                  <span style={{ marginLeft: "auto", fontSize: "0.62rem", fontWeight: 600, color: "#b06a16", background: "#d4a84b22", borderRadius: 999, padding: "1px 8px" }}>{reason(it)}</span>
                </div>
                {/* full name — wraps to next line, no overflow */}
                <span style={{ fontSize: "0.72rem", color: "var(--soft)", lineHeight: 1.3, overflowWrap: "anywhere" }}>{it.summary || "—"}</span>
                {it.pm && <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{it.pm}</span>}
              </div>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
