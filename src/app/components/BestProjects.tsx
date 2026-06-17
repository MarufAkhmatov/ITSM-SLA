import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Info, X, ExternalLink } from "lucide-react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { jiraUrl } from "../jira";
import { openIssue } from "../issue";

const fallback = [
  { name: "Cardio Care", pct: 82, color: "#2d7a5f" },
  { name: "Wellness 2.0", pct: 64, color: "#9b59b6" },
  { name: "Lab Sync", pct: 47, color: "#d4a84b" },
];

export function BestProjects() {
  const { t } = useI18n();
  const { data } = usePortfolio();
  const base = data?.meta?.jira_base;
  const projects = data?.widgets?.top_projects?.length ? data.widgets.top_projects : fallback;
  const [info, setInfo] = useState(false);

  return (
    <div className="p-6 flex flex-col gap-4" style={{ height: "100%", position: "relative" }}>
      {/* header + methodology info button (top-right) */}
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>{t("best_projects")}</span>
        <button onClick={() => setInfo((v) => !v)} title={t("tip_bp_method")}
          style={{ width: 24, height: 24, borderRadius: 7, background: info ? "#0c5563" : "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Info size={13} color={info ? "#fff" : "#6b7a8d"} />
        </button>
      </div>

      {/* methodology popover (anchored top-right of the panel) */}
      <AnimatePresence>
        {info && (
          <>
            <div onClick={() => setInfo(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{ position: "absolute", top: 44, right: 12, zIndex: 31, width: 290, maxWidth: "calc(100% - 24px)", background: "var(--card)", borderRadius: 12, boxShadow: "0 18px 50px rgba(0,0,0,0.32)", border: "1px solid var(--divider)", padding: 14 }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" }}>{t("bp_method_title")}</span>
                <button onClick={() => setInfo(false)} style={{ width: 22, height: 22, borderRadius: 6, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={12} color="#6b7a8d" />
                </button>
              </div>
              <p style={{ fontSize: "0.71rem", lineHeight: 1.5, color: "var(--soft)", margin: 0 }}>{t("bp_method_body")}</p>
              <p style={{ fontSize: "0.71rem", lineHeight: 1.5, color: "var(--text)", fontWeight: 600, margin: "10px 0 0", background: "#0c556312", borderRadius: 8, padding: "8px 10px" }}>{t("bp_method_note")}</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-5" style={{ flex: 1, justifyContent: "center" }}>
        {projects.map((p: any, i: number) => {
          const clickable = !!p.key;
          return (
            <div key={i} className={`flex flex-col gap-2${clickable ? " jira-link" : ""}`}
              onClick={clickable ? () => openIssue(p.key) : undefined}
              style={{ cursor: clickable ? "pointer" : "default" }}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text)" }}>{p.key || p.name}</span>
                    {p.key && (
                      <a href={jiraUrl(p.key, p.url, base)} target="_blank" rel="noopener noreferrer"
                         onClick={(e) => e.stopPropagation()} style={{ display: "flex", color: "#9aa5b4" }} title={t("tip_open_jira")}>
                        <ExternalLink size={10} />
                      </a>
                    )}
                    {p.duration_days != null && (
                      <span style={{ fontSize: "0.6rem", fontWeight: 600, color: "#0c5563", background: "var(--surface2)", borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap" }}>
                        {p.duration_days} {t("days")}
                      </span>
                    )}
                  </div>
                  {p.summary && (
                    /* full project name — wraps to as many lines as needed, never clipped */
                    <span style={{ fontSize: "0.63rem", color: "#9aa5b4", lineHeight: 1.35, overflowWrap: "anywhere" }}>{p.summary}</span>
                  )}
                </div>
                {/* health score (NOT completion — see the ⓘ methodology) */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: p.color }}>{p.pct}%</span>
                  <span style={{ fontSize: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>{t("bp_health")}</span>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: "var(--surface2)", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${p.pct}%` }}
                  transition={{ duration: 0.9, delay: i * 0.12, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 6, background: p.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
