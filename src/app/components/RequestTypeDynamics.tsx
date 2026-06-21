import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";

type Trend = { latest: number; prev: number; delta: number; dir: "up" | "down" | "flat"; period?: string };
type RT = {
  name: string; total: number;
  series: Record<string, Record<string, number>>;
  trend: Record<string, Trend>;
};

const GAP = 14;

export function RequestTypeDynamics() {
  const { data, period } = usePortfolio();
  const { t } = useI18n();
  const dyn = (data?.widgets as any)?.request_type_dynamics;
  const usage = (data?.widgets as any)?.request_type_usage;
  const [q, setQ] = useState("");

  const hasDates: boolean = dyn?.has_dates;
  const rts: RT[] = dyn?.request_types || [];
  const staticRows = usage?.all || [];

  // ONE filter only — the global Period filter at the top of the page drives
  // both the data scope and the trend granularity here (no second toggle).
  const trendGran = period === "week" ? "week" : period === "year" ? "year" : "month";

  const tiles = useMemo(() => {
    if (hasDates && rts.length) {
      return rts
        .filter(r => r.name.toLowerCase().includes(q.toLowerCase()))
        .map(r => ({ name: r.name, value: r.total, trend: r.trend?.[trendGran] || null }));
    }
    return staticRows
      .filter((r: any) => r.name.toLowerCase().includes(q.toLowerCase()))
      .map((r: any) => ({ name: r.name, value: r.count, trend: null as Trend | null }));
  }, [hasDates, rts, staticRows, trendGran, q]);

  const maxV = tiles.reduce((m, x) => Math.max(m, x.value), 0) || 1;
  const sorted = [...tiles].sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: GAP, flex: 1, minHeight: 0 }}>
      {/* controls — search only; the time dimension is the global Period filter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.8)" }}>
          {sorted.length} {t("nav_usage")} · {t("dyn_trend_vs")} {t(`gran_${trendGran}`).toLowerCase()}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "7px 14px", background: "var(--card)", boxShadow: "var(--shadow)" }}>
          <Search size={14} color="#6b7a8d" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("res_search")}
            style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.78rem", color: "var(--text)", width: 160 }} />
        </div>
      </div>

      {/* calendar-style tile grid — scrolls internally so the page never overflows */}
      <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {sorted.map(tile => {
            const intensity = 0.10 + 0.55 * (tile.value / maxV);
            const tr = tile.trend;
            return (
              <div key={tile.name} title={tile.name}
                style={{ borderRadius: 14, padding: 14, minHeight: 92, background: `rgba(12,85,99,${intensity})`, border: "1px solid var(--divider)", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: "0.72rem", color: "var(--text)", fontWeight: 600, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{tile.name}</div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>{tile.value}</span>
                  {tr && (
                    <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.72rem", fontWeight: 700,
                      color: tr.dir === "up" ? "#2d7a5f" : tr.dir === "down" ? "#e07a7a" : "var(--muted)" }}>
                      {tr.dir === "up" ? <TrendingUp size={14} /> : tr.dir === "down" ? <TrendingDown size={14} /> : <Minus size={14} />}
                      {tr.delta > 0 ? `+${tr.delta}` : tr.delta}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
