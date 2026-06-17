import { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { useAvatar } from "../avatars";
import { openDrill } from "../drill";

const PERIODS = ["all", "year", "quarter", "month", "week"];

function LeaderAvatar({ pm }: { pm: string }) {
  const url = useAvatar(pm, `https://i.pravatar.cc/64?u=${encodeURIComponent(pm)}`);
  return <img src={url} alt={pm} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
}

export function HealthcareProviders() {
  const { t } = useI18n();
  const { pmBoard } = usePortfolio();
  const [period, setPeriod] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    pmBoard(period).then((r) => { if (alive) setRows(r?.rows || []); });
    return () => { alive = false; };
  }, [period, pmBoard]);

  const Cols = "44px 1.9fr 0.8fr 0.8fr 0.9fr";

  const renderTable = (big: boolean) => (
    <div className="flex flex-col gap-3" style={{ height: "100%", minHeight: 0 }}>
      {/* Title + period filter + expand */}
      <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>{t("healthcare_providers")}</span>
        <div className="flex items-center gap-1" style={{ flexWrap: "wrap", paddingRight: big ? 34 : 0 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "3px 9px", borderRadius: 999, border: "none", cursor: "pointer",
                fontSize: "0.66rem", fontWeight: period === p ? 600 : 400,
                background: period === p ? "#0c5563" : "var(--surface2)",
                color: period === p ? "#ffffff" : "#6b7a8d",
                transition: "all 0.15s",
              }}
            >
              {t("pl_" + p)}
            </button>
          ))}
          {!big && (
            <button onClick={() => setExpanded(true)} title={t("tip_expand")}
              style={{ width: 26, height: 26, borderRadius: 8, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 2 }}>
              <Maximize2 size={12} color="#6b7a8d" />
            </button>
          )}
        </div>
      </div>

      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: Cols, gap: 6, fontSize: "0.68rem", color: "var(--muted)", paddingBottom: 4, borderBottom: "1px solid var(--divider)" }}>
        <span>{t("lb_rank")}</span>
        <span>{t("provider_name")}</span>
        <span style={{ textAlign: "center" }}>{t("lb_projects")}</span>
        <span style={{ textAlign: "center" }}>{t("lb_tasks")}</span>
        <span style={{ textAlign: "right" }}>{t("lb_time")}</span>
      </div>

      {/* Scrollable rows with designed scrollbar */}
      <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: big ? 10 : 8 }}>
        {rows.length === 0 && (
          <span style={{ fontSize: "0.75rem", color: "#9aa5b4", padding: "8px 0" }}>No completions in this period.</span>
        )}
        {rows.map((r: any, i: number) => (
          <motion.div
            key={r.pm}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            style={{ display: "grid", gridTemplateColumns: Cols, gap: 6, alignItems: "center" }}
          >
            {r.rank <= 3 ? (
              <span style={{ fontSize: "1.15rem", lineHeight: 1, textAlign: "center" }} title={`#${r.rank}`}>
                {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
              </span>
            ) : (
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7a8d" }}>#{r.rank}</span>
            )}
            <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <LeaderAvatar pm={r.pm} />
              <span style={{ fontSize: "0.76rem", fontWeight: 400, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.pm}>{r.pm}</span>
            </div>
            <span onClick={() => openDrill(`${r.pm} — ${t("lb_projects")}`, { scope: "epics", state: "completed", pm: r.pm })} style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2d7a5f", textAlign: "center", cursor: "pointer" }}>{r.projects_completed}</span>
            <span onClick={() => openDrill(`${r.pm} — ${t("lb_tasks")}`, { scope: "tasks", state: "completed", pm: r.pm })} style={{ fontSize: "0.8rem", fontWeight: 600, color: "#9b59b6", textAlign: "center", cursor: "pointer" }}>{r.tasks_completed}</span>
            <span style={{ fontSize: "0.72rem", color: "#6b7a8d", textAlign: "right" }}>{r.time_spent}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="p-6" style={{ height: "100%", minHeight: 0 }}>
        {renderTable(false)}
      </div>

      {/* Expanded (enlarge) modal */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(20,40,55,0.45)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.3)", width: "min(720px, 94vw)", height: "min(80vh, 760px)", padding: 24, display: "flex", flexDirection: "column" }}
            >
              <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                <button onClick={() => setExpanded(false)} title={t("tip_shrink")}
                  style={{ position: "absolute", top: -6, right: -6, width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                  <Minimize2 size={14} color="#6b7a8d" />
                </button>
                {renderTable(true)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
