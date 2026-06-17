import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { openDrill } from "../drill";

const GREEN = "#2d7a5f", AMBER = "#d4a84b", RED = "#e0574f";
const GRANS = ["month", "quarter", "year"] as const;

/* Segmented bar: a vertical bar built from small horizontal ticks stacked on top
   of each other (equalizer / LED-meter look) instead of one solid rectangle. */
function SegmentedBar(props: any) {
  const { x, y, width, height, fill } = props;
  if (!(height > 0) || !(width > 0)) return null;
  const seg = 2.4;          // tick thickness (thin, like the Project-Flow donut spokes)
  const gap = 3.6;          // gap between ticks
  const step = seg + gap;
  const count = Math.max(1, Math.floor((height + gap) / step));
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const ry = y + height - seg - i * step;   // stack upward from the baseline
    if (ry < y - 0.5) break;
    // rx = seg/2 -> pill-shaped ticks (rounded ends, matching the spoke linecap)
    ticks.push(<rect key={i} x={x} y={ry} width={width} height={seg} rx={seg / 2} ry={seg / 2} fill={fill} />);
  }
  return <g>{ticks}</g>;
}

export function WellnessChart() {
  const { t } = useI18n();
  const { flow } = usePortfolio();
  const [gran, setGran] = useState<string>("month");
  const [res, setRes] = useState<any>(null);

  useEffect(() => { flow({ granularity: gran }).then(setRes); }, [flow, gran]);

  const series: any[] = res?.series || [];
  const s = res?.summary || {};
  const ratio = s.ratio ?? 0;
  const delta = s.backlog_delta ?? 0;                  // created - resolved (>0 = backlog grew)
  const ratioColor = ratio >= 100 ? GREEN : ratio >= 80 ? AMBER : RED;

  // drill into the completed issues behind a period
  const drillPeriod = (period: string) => {
    if (!period) return;
    openDrill(`${t("flow_resolved")} · ${period}`, { state: "completed", period: gran, value: period });
  };

  const data = series.map((x) => ({ period: x.period, [t("flow_created")]: x.created, [t("flow_resolved")]: x.resolved }));

  return (
    <div className="p-4 flex flex-col" style={{ height: "100%", minHeight: 0, gap: 8 }}>
      {/* header: title + flow-ratio headline */}
      <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: 6 }}>
        <span style={{ color: "var(--text)", fontSize: "0.85rem", fontWeight: 300 }}>{t("flow_title")}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, color: ratioColor }}>{ratio}%</span>
          <span style={{ fontSize: "0.64rem", color: "var(--muted)" }}>{t("flow_caption")}</span>
        </div>
      </div>

      {/* tabs + backlog delta chip */}
      <div className="flex items-center" style={{ gap: 6, flexWrap: "wrap" }}>
        {GRANS.map((g) => (
          <button key={g} onClick={() => setGran(g)}
            style={{ padding: "3px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.66rem",
              fontWeight: gran === g ? 600 : 400, background: gran === g ? "#0c5563" : "var(--surface2)",
              color: gran === g ? "#fff" : "#6b7a8d" }}>
            {t("pl_" + g)}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* backlog delta: down = good (shrinking), up = bad (growing) */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.68rem", fontWeight: 700,
          color: delta > 0 ? RED : delta < 0 ? GREEN : "var(--muted)" }}>
          {delta > 0 ? <ArrowUp size={12} /> : delta < 0 ? <ArrowDown size={12} /> : null}
          {t("flow_backlog")} {delta > 0 ? `+${delta}` : delta}
        </span>
      </div>

      {/* grouped bars: Created vs Resolved per period */}
      {series.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.8rem" }}>{t("flow_no_data")}</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, cursor: "pointer" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} onClick={(e: any) => e && drillPeriod(e.activeLabel)} margin={{ top: 8, right: 6, left: -22, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--divider)" strokeDasharray="3 4" />
                <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#9aa5b4" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip cursor={{ fill: "rgba(124,138,154,0.08)" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey={t("flow_created")} fill={AMBER} shape={<SegmentedBar />} animationDuration={800} />
                <Bar dataKey={t("flow_resolved")} fill={GREEN} shape={<SegmentedBar />} animationDuration={800} animationBegin={120} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
