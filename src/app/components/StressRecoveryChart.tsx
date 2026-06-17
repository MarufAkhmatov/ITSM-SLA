import { motion } from "motion/react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Dot } from "recharts";
import { Maximize2 } from "lucide-react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { useTheme } from "../theme";

const fallbackData = [
  { day: "Sun", value: 0.62 },
  { day: "Mon", value: 0.58 },
  { day: "Tue", value: 0.71 },
  { day: "Wed", value: 0.55 },
  { day: "Thu", value: 0.48 },
  { day: "Fri", value: 0.52 },
  { day: "Sat", value: 0.40 },
];

export function StressRecoveryChart() {
  const { t, d: tr } = useI18n();
  const { data } = usePortfolio();
  const { tokens } = useTheme();
  const tt = data?.widgets?.ttm_trend;
  const chartData = tt?.points?.length
    ? tt.points.map((p: any) => ({ day: p.period, value: p.value }))
    : fallbackData;
  const delta = tt ? tt.delta : "+0.34";
  return (
    <div className="p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.85rem", fontWeight: 300, color: "var(--text)" }}>{t("stress_recovery")}</span>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--text)" }}>{delta}</span>
          <button onClick={() => window.dispatchEvent(new CustomEvent("pn-open-ttm"))} title={t("tip_ttm_expand")}
            style={{ width: 24, height: 24, borderRadius: 7, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Maximize2 size={12} color="#6b7a8d" />
          </button>
        </div>
      </div>

      <div style={{ height: 90 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -30, bottom: 0 }}>
            <XAxis dataKey="day" tickFormatter={(v) => tr.dayShort[v] ?? v} tick={{ fontSize: 10, fill: "#9aa5b4" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Line
              type="monotone"
              dataKey="value"
              stroke={tokens.text}
              strokeWidth={1.5}
              dot={{ r: 3, fill: tokens.text, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: "#2d7a5f" }}
              animationDuration={1200}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "#e8f0e8", flexShrink: 0, overflow: "hidden" }}>
          <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=56&h=56&fit=crop&auto=format" alt="Doctor" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <p style={{ fontSize: "0.68rem", color: "#6b7a8d", lineHeight: 1.4 }}>
          {t("recovery_note")}
        </p>
      </div>
    </div>
  );
}
