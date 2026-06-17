import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from "recharts";
import { motion } from "motion/react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";

const palette = ["#d4a84b", "#9b59b6", "#2d7a5f"];
const fallback = [
  { month: "Jan", value: 72, color: "#d4a84b" },
  { month: "Feb", value: 88, color: "#9b59b6" },
  { month: "Mar", value: 65, color: "#2d7a5f" },
];

export function HRVChart() {
  const { t, d: tr } = useI18n();
  const { data } = usePortfolio();
  const tp = data?.widgets?.throughput;
  const chartData = tp?.bars?.length
    ? tp.bars.map((b: any, i: number) => ({ month: b.period, value: b.value, color: palette[i % 3] }))
    : fallback;
  const delta = tp ? tp.delta : "+8%";
  const up = !String(delta).startsWith("-");

  return (
    <div className="p-6 flex flex-col gap-2" style={{ height: "100%" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.85rem", fontWeight: 300, color: "var(--text)" }}>{t("w_throughput")}</span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ fontSize: "1.1rem", fontWeight: 600, color: up ? "#2d7a5f" : "#e53e3e" }}
        >
          {delta}
        </motion.span>
      </div>
      <div style={{ height: 70 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={24} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" tickFormatter={(v) => tr.monShort[v] ?? v} tick={{ fontSize: 10, fill: "#9aa5b4" }} axisLine={false} tickLine={false} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1000}>
              {chartData.map((entry: any, i: number) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
