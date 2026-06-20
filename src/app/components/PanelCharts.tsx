import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";

const PLAN = "#9aa5b4";
const FAKT = "#0c5563";
const MAX = "#e07a7a";   // maximum (worst-case) actual SLA
const fmtMin = (m: number | null | undefined) => {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return mm ? `${h}h ${mm}m` : `${h}h`;
};
const rateColor = (v: number) => (v >= 90 ? "#2d7a5f" : v >= 75 ? "#d4a84b" : "#e07a7a");

function ChartShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: 16, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <BarChart3 size={15} color="#0c5563" />
        <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "var(--text)" }}>{title}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

/** SLA chart — top request types as Plan vs Fakt grouped bars, or pass-rate. */
export function SlaChart() {
  const { data } = usePortfolio();
  const { t } = useI18n();
  const rows: any[] = (data?.widgets as any)?.sla_by_request_type || [];
  const [metric, setMetric] = useState<"time" | "rate">("time");
  if (!rows.length) return null;
  const top = rows.slice(0, 10);

  const timeData = top.map(r => ({
    name: r.name.slice(0, 18), full: r.name,
    Plan: r.plan?.total_min ?? 0,
    Fakt: r.fakt?.total_min ?? 0,
    Max: r.fakt_max?.total_min ?? 0,
  }));
  const rateData = top.map(r => ({
    name: r.name.slice(0, 18), full: r.name,
    react: r.reaction_pass_rate_pct ?? 0, resol: r.resolution_pass_rate_pct ?? 0,
  }));

  return (
    <ChartShell title={t("chart_sla_title")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", borderRadius: 999, background: "var(--surface2)", padding: 3, width: "fit-content" }}>
          {(["time", "rate"] as const).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "4px 11px", fontSize: "0.7rem", fontWeight: 600, background: metric === m ? "var(--card)" : "transparent", color: metric === m ? "var(--text)" : "var(--muted)" }}>
              {t(m === "time" ? "chart_planfakt" : "chart_passrate")}
            </button>
          ))}
        </div>
        {metric === "time" && (
          <div style={{ display: "flex", gap: 10, fontSize: "0.62rem", color: "var(--soft)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: PLAN }} /> {t("sla_plan")}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: FAKT }} /> {t("sla_fakt_avg")}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: MAX }} /> {t("sla_fakt_max")}</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height="88%">
        {metric === "time" ? (
          /* TTM-Trend style: smooth gradient areas — Plan / Actual Avg / Maximum */
          <AreaChart data={timeData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PLAN} stopOpacity={0.30} /><stop offset="100%" stopColor={PLAN} stopOpacity={0} /></linearGradient>
              <linearGradient id="gFakt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={FAKT} stopOpacity={0.40} /><stop offset="100%" stopColor={FAKT} stopOpacity={0} /></linearGradient>
              <linearGradient id="gMax" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={MAX} stopOpacity={0.34} /><stop offset="100%" stopColor={MAX} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--divider)" strokeDasharray="3 4" />
            <XAxis dataKey="name" tick={{ fontSize: 8.5, fill: "#9aa5b4" }} axisLine={false} tickLine={false} interval={0} angle={-32} textAnchor="end" height={56} />
            <YAxis tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} width={42} tickFormatter={(v: any) => fmtMin(Number(v))} />
            <Tooltip formatter={(v: any, n: any) => [fmtMin(Number(v)), n === "Fakt" ? t("sla_fakt_avg") : n === "Max" ? t("sla_fakt_max") : t("sla_plan")]} labelFormatter={(_l: any, p: any) => p?.[0]?.payload?.full || ""} contentStyle={{ borderRadius: 10, fontSize: "0.76rem" }} />
            <Area type="monotone" dataKey="Plan" stroke={PLAN} strokeWidth={2.2} fill="url(#gPlan)" dot={false} activeDot={{ r: 3 }} animationDuration={900} />
            <Area type="monotone" dataKey="Fakt" stroke={FAKT} strokeWidth={2.2} fill="url(#gFakt)" dot={false} activeDot={{ r: 3 }} animationDuration={900} />
            <Area type="monotone" dataKey="Max" stroke={MAX} strokeWidth={2.2} fill="url(#gMax)" dot={false} activeDot={{ r: 3 }} animationDuration={900} />
          </AreaChart>
        ) : (
          <BarChart data={rateData} layout="vertical" margin={{ left: 4, right: 30, top: 2, bottom: 2 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} unit="%" />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "var(--soft)" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: any) => `${v}%`} labelFormatter={(_l: any, p: any) => p?.[0]?.payload?.full || ""} contentStyle={{ borderRadius: 10, fontSize: "0.76rem" }} />
            <Bar dataKey="react" name={t("sla_react")} radius={[0, 4, 4, 0]} maxBarSize={9}>
              {rateData.map((d, i) => <Cell key={i} fill={rateColor(d.react)} />)}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartShell>
  );
}

/** Resource chart — top staff by ticket count, tinted by resolution SLA. */
export function ResourceChart() {
  const { data } = usePortfolio();
  const { t } = useI18n();
  const staff: any[] = (data?.widgets as any)?.resource_utilization?.staff || [];
  if (!staff.length) return null;
  const top = staff.slice(0, 12).map(s => ({ name: s.name.split(" ")[0], full: s.name, total: s.total, rate: s.resolution_pass_rate_pct ?? 0 }));
  return (
    <ChartShell title={t("chart_resource_title")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ left: 4, right: 28, top: 2, bottom: 2 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 10, fill: "var(--soft)" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: any) => v} labelFormatter={(_l: any, p: any) => p?.[0]?.payload?.full || ""} contentStyle={{ borderRadius: 10, fontSize: "0.76rem" }} />
          <Bar dataKey="total" radius={[0, 5, 5, 0]} maxBarSize={16}>
            {top.map((d, i) => <Cell key={i} fill={rateColor(d.rate)} />)}
            <LabelList dataKey="total" position="right" style={{ fontSize: 10, fill: "var(--muted)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/** Usage chart — request-type counts as bars (for the IT-services page). */
export function UsageChart({ rows, color = "#0c5563", title }: { rows: any[]; color?: string; title: string }) {
  if (!rows?.length) return null;
  const d = rows.slice(0, 14).map(r => ({ name: r.name.slice(0, 20), full: r.name, count: r.count }));
  return (
    <ChartShell title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={d} layout="vertical" margin={{ left: 4, right: 28, top: 2, bottom: 2 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "var(--soft)" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: any) => v} labelFormatter={(_l: any, p: any) => p?.[0]?.payload?.full || ""} contentStyle={{ borderRadius: 10, fontSize: "0.76rem" }} />
          <Bar dataKey="count" fill={color} radius={[0, 5, 5, 0]} maxBarSize={13}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: "var(--muted)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
