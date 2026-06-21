import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Info, Search, Maximize2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

type MinTriple = { reaction_min: number | null; resolution_min: number | null; total_min: number };
type Row = {
  name: string; count: number; assignees: number;
  done: number; in_progress: number; todo: number;
  plan: MinTriple;
  fakt: MinTriple;
  fakt_max?: MinTriple;
  reaction_pass_rate_pct: number | null;
  resolution_pass_rate_pct: number | null;
};

const PLAN = "#9aa5b4";   // grey = target
const FAKT = "#0c5563";   // teal = actual
const fmtMin = (m: number | null | undefined) => {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return mm ? `${h}h ${mm}m` : `${h}h`;
};
const rateColor = (v: number | null) => (v == null ? "var(--muted)" : v >= 90 ? "#2d7a5f" : v >= 75 ? "#d4a84b" : "#e07a7a");

export function SlaByRequestType({ onMaximize }: { onMaximize?: () => void } = {}) {
  const { data } = usePortfolio();
  const { t } = useI18n();
  const rows: Row[] = (data?.widgets as any)?.sla_by_request_type || [];
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const [faktMode, setFaktMode] = useState<"avg" | "max">("avg");

  const filtered = useMemo(
    () => rows.filter(r => r.name.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  // pick avg or max Fakt depending on the toggle
  const fk = (r: Row): MinTriple => (faktMode === "max" && r.fakt_max ? r.fakt_max : r.fakt);

  if (!rows.length) return null;

  return (
    <div className="p-6 flex flex-col gap-3" style={{ height: "100%" }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("sla_crt_title")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* avg / max toggle for Fakt */}
          <div style={{ display: "flex", borderRadius: 999, background: "var(--surface2)", padding: 3 }}>
            {(["avg", "max"] as const).map(m => (
              <button key={m} onClick={() => setFaktMode(m)} title={t(m === "avg" ? "sla_fakt_avg_hint" : "sla_fakt_max_hint")}
                style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "4px 11px", fontSize: "0.7rem", fontWeight: 600, background: faktMode === m ? "var(--card)" : "transparent", color: faktMode === m ? "var(--text)" : "var(--muted)" }}>
                {t(m === "avg" ? "sla_fakt_avg" : "sla_fakt_max")}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 12px", background: "var(--surface2)" }}>
            <Search size={13} color="#6b7a8d" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("sla_crt_search")}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.74rem", color: "var(--text)", width: 140 }} />
          </div>
          {onMaximize && (
            <button onClick={onMaximize} title={t("panel_maximize")}
              style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Maximize2 size={14} color="#6b7a8d" />
            </button>
          )}
        </div>
      </div>

      {/* legend */}
      <div style={{ display: "flex", gap: 16, fontSize: "0.68rem", color: "var(--soft)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: PLAN, display: "inline-block" }} /> {t("sla_plan")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: FAKT, display: "inline-block" }} /> {t("sla_fakt")} ({t(faktMode === "avg" ? "sla_fakt_avg" : "sla_fakt_max")})</span>
        <span style={{ color: "var(--muted)" }}>· {t("sla_crt_hint")}</span>
      </div>

      <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "var(--card)", zIndex: 1, textAlign: "left", color: "var(--muted)" }}>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>{t("sla_crt_col_type")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>{t("sla_crt_col_count")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "center" }}>{t("sla_crt_col_react")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "center" }}>{t("sla_crt_col_resol")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "center" }}>{t("sla_crt_col_total")}</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>SLA %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.name} onClick={() => setSel(r)}
                style={{ cursor: "pointer", borderTop: "1px solid var(--divider)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "7px 8px", color: "var(--text)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--soft)" }}>{r.count}</td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}><PvF plan={r.plan.reaction_min} fakt={fk(r).reaction_min} /></td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}><PvF plan={r.plan.resolution_min} fakt={fk(r).resolution_min} /></td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}><PvF plan={r.plan.total_min} fakt={fk(r).total_min} /></td>
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

      <AnimatePresence>
        {sel && <DetailModal row={sel} faktMode={faktMode} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* compact "Plan → Fakt" cell */
function PvF({ plan, fakt }: { plan: number | null; fakt: number | null }) {
  const over = plan != null && fakt != null && fakt > plan;
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span style={{ color: "var(--muted)" }}>{fmtMin(plan)}</span>
      <span style={{ color: "var(--muted)" }}> → </span>
      <span style={{ color: over ? "#e07a7a" : "#2d7a5f", fontWeight: 600 }}>{fmtMin(fakt)}</span>
    </span>
  );
}

function DetailModal({ row, faktMode = "avg", onClose }: { row: Row; faktMode?: "avg" | "max"; onClose: () => void }) {
  const { t } = useI18n();
  usePopupOpenSignal(true);
  const besidePad = useTemurBesidePad();

  const fk = (faktMode === "max" && row.fakt_max ? row.fakt_max : row.fakt);
  const chartData = [
    { k: t("sla_react"), Plan: row.plan.reaction_min ?? 0, Fakt: fk.reaction_min ?? 0 },
    { k: t("sla_resol"), Plan: row.plan.resolution_min ?? 0, Fakt: fk.resolution_min ?? 0 },
    { k: t("sla_total_word"), Plan: row.plan.total_min ?? 0, Fakt: fk.total_min ?? 0 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}>
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 560, maxWidth: "94vw", maxHeight: "88vh", padding: 24, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
        <div className="flex items-start justify-between" style={{ gap: 10 }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>{row.name}</div>
            <div style={{ fontSize: "0.74rem", color: "var(--soft)", marginTop: 3 }}>
              {row.count} {t("up_issues")} · {row.assignees} {t("sla_assignees")} · {row.done} {t("sla_done")} / {row.in_progress} {t("sla_wip")} / {row.todo} {t("sla_todo")}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        {/* Plan vs Fakt comparison chart */}
        <div style={{ height: 220, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="k" tick={{ fontSize: 12, fill: "var(--soft)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} unit="m" />
              <Tooltip formatter={(v: any) => fmtMin(Number(v))} contentStyle={{ borderRadius: 10, fontSize: "0.78rem" }} />
              <Bar dataKey="Plan" fill={PLAN} radius={[5, 5, 0, 0]} maxBarSize={42}>
                <LabelList dataKey="Plan" position="top" formatter={(v: any) => fmtMin(Number(v))} style={{ fontSize: 10, fill: "var(--muted)" }} />
              </Bar>
              <Bar dataKey="Fakt" fill={FAKT} radius={[5, 5, 0, 0]} maxBarSize={42}>
                <LabelList dataKey="Fakt" position="top" formatter={(v: any) => fmtMin(Number(v))} style={{ fontSize: 10, fill: FAKT }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* numeric grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 1, background: "var(--divider)", borderRadius: 10, overflow: "hidden" }}>
          {[
            ["", t("sla_plan"), t("sla_fakt"), "Δ"],
            [t("sla_react"), fmtMin(row.plan.reaction_min), fmtMin(fk.reaction_min), delta(row.plan.reaction_min, fk.reaction_min)],
            [t("sla_resol"), fmtMin(row.plan.resolution_min), fmtMin(fk.resolution_min), delta(row.plan.resolution_min, fk.resolution_min)],
            [t("sla_total_word"), fmtMin(row.plan.total_min), fmtMin(fk.total_min), delta(row.plan.total_min, fk.total_min)],
          ].map((cells, ri) => (
            cells.map((c, ci) => (
              <div key={`${ri}-${ci}`} style={{ background: "var(--card)", padding: "8px 10px", fontSize: "0.74rem", fontWeight: ri === 0 || ci === 0 ? 600 : 400, color: ri === 0 ? "var(--muted)" : ci === 0 ? "var(--text)" : "var(--soft)", textAlign: ci === 0 ? "left" : "right" }}>
                {c}
              </div>
            ))
          ))}
        </div>

        {/* pass rates */}
        <div style={{ display: "flex", gap: 24, padding: "4px 2px" }}>
          <div><div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase" }}>{t("sla_react")} SLA</div><div style={{ fontSize: "1.3rem", fontWeight: 700, color: rateColor(row.reaction_pass_rate_pct) }}>{row.reaction_pass_rate_pct ?? "—"}%</div></div>
          <div><div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase" }}>{t("sla_resol")} SLA</div><div style={{ fontSize: "1.3rem", fontWeight: 700, color: rateColor(row.resolution_pass_rate_pct) }}>{row.resolution_pass_rate_pct ?? "—"}%</div></div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.7rem", color: "var(--muted)", background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t("sla_detail_hint")}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function delta(plan: number | null, fakt: number | null): string {
  if (plan == null || fakt == null) return "—";
  const d = fakt - plan;
  const sign = d > 0 ? "+" : "";
  return `${sign}${fmtMin(Math.abs(d)) === "—" ? "0m" : (d < 0 ? "-" : sign) + fmtMin(Math.abs(d))}`;
}
