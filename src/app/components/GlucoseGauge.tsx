import { motion } from "motion/react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";

export function GlucoseGauge() {
  const { t } = useI18n();
  const { data } = usePortfolio();
  const flow = data?.widgets?.flow;
  const value = flow ? flow.value : 92;
  const max = flow ? 100 : 140;
  const pct = value / max;
  const angle = -150 + pct * 300;
  const r = 38;
  const cx = 50;
  const cy = 52;
  const startAngle = -150 * (Math.PI / 180);
  const endAngle = (angle) * (Math.PI / 180);

  const arcPath = (startDeg: number, endDeg: number, radius: number) => {
    const start = startDeg * (Math.PI / 180);
    const end = endDeg * (Math.PI / 180);
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  const ticks = Array.from({ length: 9 }, (_, i) => {
    const deg = -150 + i * (300 / 8);
    const rad = deg * (Math.PI / 180);
    const inner = 44;
    const outer = 48;
    return {
      x1: cx + inner * Math.cos(rad),
      y1: cy + inner * Math.sin(rad),
      x2: cx + outer * Math.cos(rad),
      y2: cy + outer * Math.sin(rad),
    };
  });

  return (
    <div className="p-6 flex flex-col gap-1" style={{ height: "100%" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.85rem", fontWeight: 300, color: "var(--text)" }}>{t("glucose")}</span>
        <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "#2d7a5f" }}>{flow ? `${value}%` : "-5%"}</span>
      </div>
      <div className="flex items-center justify-center">
        <svg width="100" height="72" viewBox="0 0 100 72">
          {/* background arc */}
          <path d={arcPath(-150, 150, r)} fill="none" stroke="#e4eaef" strokeWidth={6} strokeLinecap="round" />
          {/* colored arc */}
          <motion.path
            d={arcPath(-150, angle, r)}
            fill="none"
            stroke="url(#glucoseGrad)"
            strokeWidth={6}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="glucoseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d4a84b" />
              <stop offset="50%" stopColor="#9b59b6" />
              <stop offset="100%" stopColor="#2d7a5f" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#c8ccd4" strokeWidth={1} />
          ))}
          <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: "var(--text)", fontFamily: "var(--font-sans)" }}>{value}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: 7, fill: "#9aa5b4", fontFamily: "var(--font-sans)" }}>{t("mgdl")}</text>
          <text x={cx} y={cy + 20} textAnchor="middle" style={{ fontSize: 7, fill: "#9aa5b4", fontFamily: "var(--font-sans)" }}>{t("capacity68")}</text>
        </svg>
      </div>
    </div>
  );
}
