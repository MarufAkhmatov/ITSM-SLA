import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrendingUp, TrendingDown, Search, Info, Maximize2, X } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { PanelMaximizeModal } from "./PanelMaximizeModal";
import { UsageChart } from "./PanelCharts";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

type Row = {
  name: string; count: number; share_pct: number;
  done: number; in_progress: number; todo: number; assignee_count: number;
  reaction_pass_rate_pct: number | null; resolution_pass_rate_pct: number | null;
};
type Section = "most" | "least" | "all";

const GAP = 14;
const rateColor = (v: number | null) => (v == null ? "var(--muted)" : v >= 90 ? "#2d7a5f" : v >= 75 ? "#d4a84b" : "#e07a7a");

export function RequestTypeUsage() {
  const { data } = usePortfolio();
  const { t } = useI18n();
  const usage = (data?.widgets as any)?.request_type_usage;
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const [maxSection, setMaxSection] = useState<Section | null>(null);

  const all: Row[] = usage?.all || [];
  const most: Row[] = usage?.most_used || [];
  const least: Row[] = usage?.least_used || [];
  const maxCount = most[0]?.count || 1;
  const filtered = useMemo(() => all.filter(r => r.name.toLowerCase().includes(q.toLowerCase())), [all, q]);

  if (!usage || !all.length) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>{t("res_no_itsm")}</div>;
  }

  const mostPanel = (compact = false) => (
    <Panel title={t("usage_most")} icon={<TrendingUp size={16} color="#2d7a5f" />}
      info={t("usage_method_most")} onMaximize={compact ? () => setMaxSection("most") : undefined} t={t}>
      <div className="pn-scroll" style={{ maxHeight: compact ? 300 : undefined, overflowY: "auto" }}>
        {most.map((r, i) => <UsageBar key={r.name} r={r} rank={i + 1} maxCount={maxCount} color="#2d7a5f" t={t} onClick={() => setSel(r)} />)}
      </div>
    </Panel>
  );
  const leastPanel = (compact = false) => (
    <Panel title={t("usage_least")} icon={<TrendingDown size={16} color="#e07a7a" />}
      info={t("usage_method_least")} onMaximize={compact ? () => setMaxSection("least") : undefined} t={t}>
      <div className="pn-scroll" style={{ maxHeight: compact ? 300 : undefined, overflowY: "auto" }}>
        {least.length
          ? least.map((r, i) => <UsageBar key={r.name} r={r} rank={i + 1} maxCount={maxCount} color="#e07a7a" t={t} onClick={() => setSel(r)} />)
          : <div style={{ color: "var(--muted)", fontSize: "0.78rem", padding: 10 }}>—</div>}
      </div>
    </Panel>
  );
  const allPanel = (compact = false) => (
    <Panel title={t("usage_all")} icon={null} info={t("usage_method_all")}
      onMaximize={compact ? () => setMaxSection("all") : undefined} t={t}
      right={
        <div style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 12px", background: "var(--surface2)" }}>
          <Search size={13} color="#6b7a8d" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("sla_crt_search")}
            style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.74rem", color: "var(--text)", width: 150 }} />
        </div>
      }>
      <div className="pn-scroll" style={{ maxHeight: compact ? 360 : undefined, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "var(--card)", textAlign: "left", color: "var(--muted)" }}>
              <th style={{ padding: "6px 8px" }}>#</th>
              <th style={{ padding: "6px 8px" }}>{t("sla_crt_col_type")}</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("sla_crt_col_count")}</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("usage_share")}</th>
              <th style={{ padding: "6px 8px", textAlign: "center" }}>{t("sla_done")}/{t("sla_wip")}/{t("sla_todo")}</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("res_staff_count")}</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>SLA %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.name} onClick={() => setSel(r)} style={{ borderTop: "1px solid var(--divider)", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "7px 8px", color: "var(--muted)" }}>{i + 1}</td>
                <td style={{ padding: "7px 8px", color: "var(--text)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--text)", fontWeight: 600 }}>{r.count}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--soft)" }}>{r.share_pct}%</td>
                <td style={{ padding: "7px 8px", textAlign: "center", color: "var(--soft)" }}>
                  <span style={{ color: "#2d7a5f" }}>{r.done}</span> / <span style={{ color: "#d4a84b" }}>{r.in_progress}</span> / <span style={{ color: "#6b7a8d" }}>{r.todo}</span>
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--soft)" }}>{r.assignee_count}</td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>
                  <span style={{ color: rateColor(r.reaction_pass_rate_pct), fontWeight: 600 }}>{r.reaction_pass_rate_pct ?? "—"}</span>
                  <span style={{ color: "var(--muted)" }}> / </span>
                  <span style={{ color: rateColor(r.resolution_pass_rate_pct), fontWeight: 600 }}>{r.resolution_pass_rate_pct ?? "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 300, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>{t("usage_title")}</h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>{t("usage_subtitle")}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: GAP }}>
        <Kpi label={t("usage_total_types")} value={usage.total_types} />
        <Kpi label={t("usage_total_tickets")} value={usage.total_tickets} />
        <Kpi label={t("usage_top_share")} value={`${most[0]?.share_pct ?? 0}%`} sub={most[0]?.name} />
        <Kpi label={t("usage_single_use")} value={all.filter(r => r.count === 1).length} sub={t("usage_single_use_sub")} />
      </div>

      {/* most used — table + chart side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: GAP }}>
        {mostPanel(true)}
        <div style={{ height: 340 }}><UsageChart rows={most} color="#2d7a5f" title={t("chart_most")} /></div>
      </div>

      {/* least used — table + chart side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: GAP }}>
        {leastPanel(true)}
        <div style={{ height: 340 }}><UsageChart rows={least} color="#e07a7a" title={t("chart_least")} /></div>
      </div>

      {/* all types — table + chart side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: GAP }}>
        {allPanel(true)}
        <div style={{ height: 420 }}><UsageChart rows={filtered} color="#0c5563" title={t("chart_all")} /></div>
      </div>

      {/* row detail */}
      <AnimatePresence>
        {sel && <RequestTypeDetailModal row={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>

      {/* maximized section */}
      <AnimatePresence>
        {maxSection && (
          <PanelMaximizeModal onClose={() => setMaxSection(null)}>
            <div style={{ padding: 18 }}>
              {maxSection === "most" && mostPanel(false)}
              {maxSection === "least" && leastPanel(false)}
              {maxSection === "all" && allPanel(false)}
            </div>
          </PanelMaximizeModal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text)" }}>{value}</span>
      {sub && <span style={{ fontSize: "0.68rem", color: "var(--soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
    </div>
  );
}

function Panel({ title, icon, right, info, onMaximize, t, children }: {
  title: string; icon: React.ReactNode; right?: React.ReactNode; info?: string;
  onMaximize?: () => void; t: (k: string) => string; children: React.ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: 18, display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}<span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>{title}</span>
          {info && (
            <button onClick={() => setShowInfo(v => !v)} title={info}
              style={{ width: 22, height: 22, borderRadius: 6, background: showInfo ? "#0c5563" : "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Info size={12} color={showInfo ? "#fff" : "#6b7a8d"} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {right}
          {onMaximize && (
            <button onClick={onMaximize} title={t("panel_maximize")}
              style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Maximize2 size={14} color="#6b7a8d" />
            </button>
          )}
        </div>
      </div>
      {info && showInfo && (
        <div style={{ fontSize: "0.72rem", lineHeight: 1.5, color: "var(--soft)", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>{info}</div>
      )}
      {children}
    </div>
  );
}

function UsageBar({ r, rank, maxCount, color, t, onClick }: { r: Row; rank: number; maxCount: number; color: string; t: (k: string) => string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 4px", borderRadius: 8, cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = "var(--surface2)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <span style={{ width: 18, fontSize: "0.7rem", color: "var(--muted)", textAlign: "right" }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: "0.74rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
          <span style={{ fontSize: "0.74rem", color: "var(--text)", fontWeight: 600, flexShrink: 0 }}>{r.count} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({r.share_pct}%)</span></span>
        </div>
        <div style={{ height: 5, borderRadius: 5, background: "var(--surface2)", marginTop: 3, overflow: "hidden" }}>
          <div style={{ width: `${Math.max(3, 100 * r.count / maxCount)}%`, height: "100%", borderRadius: 5, background: color }} />
        </div>
      </div>
      <span style={{ fontSize: "0.66rem", color: "var(--muted)", flexShrink: 0 }}>{r.assignee_count} {t("res_staff")}</span>
    </div>
  );
}

function RequestTypeDetailModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const { data } = usePortfolio();
  const { t } = useI18n();
  usePopupOpenSignal(true);
  const besidePad = useTemurBesidePad();
  const ru = (data?.widgets as any)?.resource_utilization;
  const perType = ru?.per_request_type?.find((p: any) => p.name === row.name);
  const assignees: { name: string; count: number }[] = perType?.assignees || [];
  const total = row.done + row.in_progress + row.todo || 1;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}>
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }} onClick={e => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 560, maxWidth: "94vw", maxHeight: "88vh", padding: 24, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
        <div className="flex items-start justify-between" style={{ gap: 10 }}>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{row.name}</div>
            <div style={{ fontSize: "0.74rem", color: "var(--soft)", marginTop: 3 }}>{row.count} {t("up_issues")} · {row.share_pct}% {t("usage_share").toLowerCase()} · {row.assignee_count} {t("res_staff")}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        {/* status split bar */}
        <div>
          <div style={{ display: "flex", height: 26, borderRadius: 8, overflow: "hidden" }}>
            {[["#2d7a5f", row.done, t("sla_done")], ["#d4a84b", row.in_progress, t("sla_wip")], ["#6b7a8d", row.todo, t("sla_todo")]].map(([c, v, lbl], i) => (
              Number(v) > 0 ? <div key={i} title={`${lbl}: ${v}`} style={{ width: `${100 * Number(v) / total}%`, background: c as string, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.66rem", fontWeight: 700 }}>{Number(v) > total * 0.06 ? v : ""}</div> : null
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: "0.68rem", color: "var(--soft)" }}>
            <span><b style={{ color: "#2d7a5f" }}>{row.done}</b> {t("sla_done")}</span>
            <span><b style={{ color: "#d4a84b" }}>{row.in_progress}</b> {t("sla_wip")}</span>
            <span><b style={{ color: "#6b7a8d" }}>{row.todo}</b> {t("sla_todo")}</span>
          </div>
        </div>

        {/* SLA pass rates */}
        <div style={{ display: "flex", gap: 24 }}>
          <div><div style={{ fontSize: "0.66rem", color: "var(--muted)", textTransform: "uppercase" }}>{t("sla_react")} SLA</div><div style={{ fontSize: "1.2rem", fontWeight: 700, color: rateColor(row.reaction_pass_rate_pct) }}>{row.reaction_pass_rate_pct ?? "—"}%</div></div>
          <div><div style={{ fontSize: "0.66rem", color: "var(--muted)", textTransform: "uppercase" }}>{t("sla_resol")} SLA</div><div style={{ fontSize: "1.2rem", fontWeight: 700, color: rateColor(row.resolution_pass_rate_pct) }}>{row.resolution_pass_rate_pct ?? "—"}%</div></div>
        </div>

        {/* assignees */}
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{t("res_who")} · {assignees.length}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {assignees.map(a => (
              <span key={a.name} style={{ borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem", background: "var(--surface2)", color: "var(--soft)" }}>
                {a.name} <b style={{ color: "var(--text)" }}>{a.count}</b>
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
