import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";

const PLAN = "#9aa5b4";
const FAKT = "#0c5563";
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

  const timeData = top.map(r => ({ name: r.name.slice(0, 18), Plan: r.plan?.total_min ?? 0, Fakt: r.fakt?.total_min ?? 0, full: r.name }));
  const rateData = top.map(r => ({
    name: r.name.slice(0, 18), full: r.name,
    react: r.reaction_pass_rate_pct ?? 0, resol: r.resolution_pass_rate_pct ?? 0,
  }));

  return (
    <ChartShell title={t("chart_sla_title")}>
      <div style={{ display: "flex", borderRadius: 999, background: "var(--surface2)", padding: 3, marginBottom: 8, width: "fit-content" }}>
        {(["time", "rate"] as const).map(m => (
          <button key={m} onClick={() => setMetric(m)}
            style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "4px 11px", fontSize: "0.7rem", fontWeight: 600, background: metric === m ? "var(--card)" : "transparent", color: metric === m ? "var(--text)" : "var(--muted)" }}>
            {t(m === "time" ? "chart_planfakt" : "chart_passrate")}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height="92%">
        {metric === "time" ? (
          <BarChart data={timeData} layout="vertical" margin={{ left: 4, right: 24, top: 2, bottom: 2 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} unit="m" />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "var(--soft)" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: any) => fmtMin(Number(v))} labelFormatter={(_l: any, p: any) => p?.[0]?.payload?.full || ""} contentStyle={{ borderRadius: 10, fontSize: "0.76rem" }} />
            <Bar dataKey="Plan" fill={PLAN} radius={[0, 4, 4, 0]} maxBarSize={9} />
            <Bar dataKey="Fakt" fill={FAKT} radius={[0, 4, 4, 0]} maxBarSize={9} />
          </BarChart>
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
