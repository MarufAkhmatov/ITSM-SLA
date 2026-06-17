import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Maximize2, ArrowUp, ArrowDown, BarChart3, Activity } from "lucide-react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { openDrill } from "../drill";

const R = (n: any) => Math.round(Number(n) || 0);

const GRANS = ["year", "quarter", "month"] as const;
const sel: React.CSSProperties = {
  background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--divider)",
  borderRadius: 7, padding: "3px 7px", fontSize: "0.66rem", fontFamily: "var(--font-sans)", cursor: "pointer",
};

function priorKey(period: string, gran: string): string | null {
  if (gran === "year") return String(Number(period) - 1);
  const m = period.match(/^(\d{4})-(.+)$/);
  if (!m) return null;
  return `${Number(m[1]) - 1}-${m[2]}`;
}

function Delta({ cur, prev }: { cur: number; prev?: number }) {
  if (prev === undefined || prev === null || !isFinite(prev) || prev === 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span style={{ fontSize: "0.6rem", color: "var(--muted)" }}>0%</span>;
  const up = pct > 0; // higher TTM = worse (red), lower = better (green)
  const color = up ? "#e0574f" : "#2e9e5f";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 1, fontSize: "0.6rem", fontWeight: 700, color }}>
      {up ? <ArrowUp size={9} /> : <ArrowDown size={9} />}{Math.abs(pct)}%
    </span>
  );
}

export function TtmComparePanel() {
  const { t, lang } = useI18n();
  const { ttm } = usePortfolio();
  const [type, setType] = useState("all");
  const [gran, setGran] = useState<string>("quarter");
  const [scope, setScope] = useState<"full" | "start">("full");
  const [view, setView] = useState<"bar" | "graph">("graph");
  const [res, setRes] = useState<any>(null);

  useEffect(() => {
    const p: Record<string, string> = { type, granularity: gran };
    if (scope === "start") p.since = "2026-01-01";
    ttm(p).then(setRes);
  }, [ttm, type, gran, scope]);

  const series: any[] = res?.series || [];
  const types: string[] = res?.filters?.types || [];

  // Click a period -> drill into the completed issues behind it (type + period).
  const drillPeriod = (period: string) => {
    if (!period) return;
    const params: Record<string, string> = { state: "completed", period: gran, value: period };
    if (type !== "all") params.type = type;
    openDrill(`${type === "all" ? "TTM" : type} · ${period}`, params);
  };

  // Year-over-year delta for the latest period (same period, previous year).
  const yoy = useMemo(() => {
    if (series.length < 2) return null;
    const last = series[series.length - 1];
    const pk = priorKey(last.period, gran);
    const prev = series.find((s) => s.period === pk);
    return prev ? { last, prev } : null;
  }, [series, gran]);

  const d = t("ttm_days");
  const phaseData = series.map((s) => ({ period: s.period, Discovery: R(s.discovery), Delivery: R(s.delivery), total: R(s.total) }));
  const leadData = series.map((s) => ({ period: s.period, Lead: R(s.lead) }));
  const graphData = series.map((s) => ({ period: s.period, Discovery: R(s.discovery), Delivery: R(s.delivery), Lead: R(s.lead) }));

  return (
    <div className="p-4 flex flex-col" style={{ height: "100%", minHeight: 0, gap: 6 }}>
      {/* Header: title + type + granularity + expand */}
      <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 300, color: "var(--text)" }}>{t("stress_recovery")}</span>
        <div className="flex items-center gap-1" style={{ flexWrap: "wrap" }}>
          <select style={sel} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">{t("pl_all")}</option>
            {types.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          {GRANS.map((g) => (
            <button key={g} onClick={() => setGran(g)}
              style={{ padding: "3px 8px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.64rem",
                fontWeight: gran === g ? 600 : 400, background: gran === g ? "#0c5563" : "var(--surface2)",
                color: gran === g ? "#fff" : "#6b7a8d" }}>
              {t("pl_" + g)}
            </button>
          ))}
          {/* Start (from 2026) vs Full (all years) — pre-2026 data is unreliable */}
          <button onClick={() => setScope(scope === "full" ? "start" : "full")}
            style={{ padding: "3px 8px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.64rem", fontWeight: 600,
              background: scope === "start" ? "#2d7a5f" : "var(--surface2)", color: scope === "start" ? "#fff" : "#6b7a8d" }}>
            {scope === "start" ? t("ttm_start") : t("ttm_full")}
          </button>
          {/* Bars <-> Lines (smooth graph) view toggle */}
          <button onClick={() => setView(view === "bar" ? "graph" : "bar")}
            title={view === "bar" ? t("ttm_graph") : t("ttm_bars")}
            style={{ width: 22, height: 22, borderRadius: 6, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {view === "bar" ? <Activity size={12} color="#2d7a5f" /> : <BarChart3 size={12} color="#2d7a5f" />}
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent("pn-open-ttm"))} title={t("tip_ttm_expand")}
            style={{ width: 22, height: 22, borderRadius: 6, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Maximize2 size={11} color="#6b7a8d" />
          </button>
        </div>
      </div>

      {series.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.78rem" }}>{t("ttm_no_data")}</div>
      ) : (
        <>
          {/* YoY headline numbers for the latest period */}
          {yoy && (
            <div className="flex items-center" style={{ gap: 14, flexWrap: "wrap", fontSize: "0.66rem", color: "var(--soft)" }}>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{yoy.last.period}</span>
              <span>{t("ttm_total")}: <b style={{ color: "var(--text)" }}>{R(yoy.last.total)}{d}</b> <Delta cur={yoy.last.total} prev={yoy.prev.total} /> <span style={{ color: "var(--muted)" }}>({t("ttm_vs")} {yoy.prev.period})</span></span>
              <span>{t("ttm_lead")}: <b style={{ color: "var(--text)" }}>{R(yoy.last.lead)}{d}</b> <Delta cur={yoy.last.lead} prev={yoy.prev.lead} /></span>
            </div>
          )}

          {view === "graph" ? (
            /* Smooth multi-line / area view (modern style) */
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
             <div style={{ position: "absolute", inset: 0, cursor: "pointer" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} onClick={(e: any) => e && drillPeriod(e.activeLabel)} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gDisc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c8a9a" stopOpacity={0.32} /><stop offset="100%" stopColor="#7c8a9a" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gDeliv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d7a5f" stopOpacity={0.38} /><stop offset="100%" stopColor="#2d7a5f" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gLead" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9b59b6" stopOpacity={0.38} /><stop offset="100%" stopColor="#9b59b6" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--divider)" strokeDasharray="3 4" />
                  <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => `${v}${d}`} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="Discovery" stroke="#7c8a9a" strokeWidth={2.2} fill="url(#gDisc)" dot={false} activeDot={{ r: 3 }} animationDuration={1100} />
                  <Area type="monotone" dataKey="Delivery" stroke="#2d7a5f" strokeWidth={2.2} fill="url(#gDeliv)" dot={false} activeDot={{ r: 3 }} animationDuration={1100} />
                  <Area type="monotone" dataKey="Lead" stroke="#9b59b6" strokeWidth={2.2} fill="url(#gLead)" dot={false} activeDot={{ r: 3 }} animationDuration={1100} />
                </AreaChart>
              </ResponsiveContainer>
             </div>
            </div>
          ) : (
            <>
              {/* Chart 1: Discovery + Delivery as HORIZONTAL stacked bars (= Total).
                  Animation is sequential — Discovery fills first, then the fill
                  continues into Delivery (they read as one flowing segment). */}
              <div style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{t("ttm_phases")}</div>
              <div style={{ flex: 1.3, minHeight: 0, position: "relative" }}>
               <div style={{ position: "absolute", inset: 0, cursor: "pointer" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={phaseData} onClick={(e: any) => e && drillPeriod(e.activeLabel)} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="period" tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} width={46} />
                    <Tooltip cursor={{ fill: "rgba(124,138,154,0.08)" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => `${v}${d}`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Discovery" stackId="a" fill="#7c8a9a" radius={[4, 0, 0, 4]} animationDuration={700} animationBegin={0} />
                    <Bar dataKey="Delivery" stackId="a" fill="#2d7a5f" radius={[0, 4, 4, 0]} animationDuration={700} animationBegin={700} />
                  </BarChart>
                </ResponsiveContainer>
               </div>
              </div>

              {/* Chart 2: Lead Time per period — horizontal bars (separate) */}
              <div style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{t("ttm_lead")}</div>
              <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
               <div style={{ position: "absolute", inset: 0, cursor: "pointer" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={leadData} onClick={(e: any) => e && drillPeriod(e.activeLabel)} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="period" tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} width={46} />
                    <Tooltip cursor={{ fill: "rgba(124,138,154,0.08)" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => `${v}${d}`} />
                    <Bar dataKey="Lead" fill="#9b59b6" radius={[0, 4, 4, 0]} animationDuration={800} animationBegin={150} />
                  </BarChart>
                </ResponsiveContainer>
               </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
