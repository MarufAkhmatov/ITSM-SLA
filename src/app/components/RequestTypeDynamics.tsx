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

const GRANS = ["all", "year", "month", "week", "day"] as const;
type Gran = typeof GRANS[number];
const GAP = 14;

export function RequestTypeDynamics() {
  const { data } = usePortfolio();
  const { t } = useI18n();
  const dyn = (data?.widgets as any)?.request_type_dynamics;
  const usage = (data?.widgets as any)?.request_type_usage;
  const [gran, setGran] = useState<Gran>("all");
  const [q, setQ] = useState("");

  const hasDates: boolean = dyn?.has_dates;
  // When dates exist use dynamics; otherwise fall back to static usage counts.
  const rts: RT[] = dyn?.request_types || [];
  const staticRows = usage?.all || [];

  const tiles = useMemo(() => {
    if (hasDates && rts.length) {
      return rts
        .filter(r => r.name.toLowerCase().includes(q.toLowerCase()))
        .map(r => {
          const tr = gran === "all" ? null : r.trend[gran];
          const value = gran === "all"
            ? r.total
            : (tr ? tr.latest : 0);
          return { name: r.name, value, trend: tr };
        });
    }
    // fallback: static counts, no trend
    return staticRows
      .filter((r: any) => r.name.toLowerCase().includes(q.toLowerCase()))
      .map((r: any) => ({ name: r.name, value: r.count, trend: null as Trend | null }));
  }, [hasDates, rts, staticRows, gran, q]);

  const maxV = tiles.reduce((m, x) => Math.max(m, x.value), 0) || 1;
  const sorted = [...tiles].sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 300, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>{t("dyn_title")}</h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>{t("dyn_subtitle")}</p>
      </div>

      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", borderRadius: 999, background: "var(--card)", padding: 4, boxShadow: "var(--shadow)" }}>
          {GRANS.map(g => (
            <button key={g} onClick={() => setGran(g)} disabled={g !== "all" && !hasDates}
              title={g !== "all" && !hasDates ? t("dyn_needs_history") : ""}
              style={{ border: "none", cursor: g !== "all" && !hasDates ? "not-allowed" : "pointer", borderRadius: 999, padding: "7px 16px", fontSize: "0.78rem", fontWeight: 600,
                opacity: g !== "all" && !hasDates ? 0.4 : 1,
                background: gran === g ? "var(--active-bg, #0c5563)" : "transparent",
                color: gran === g ? "var(--active-text, #fff)" : "var(--muted)" }}>
              {t(`gran_${g}`)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "7px 14px", background: "var(--card)", boxShadow: "var(--shadow)" }}>
          <Search size={14} color="#6b7a8d" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("res_search")}
            style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.78rem", color: "var(--text)", width: 160 }} />
        </div>
      </div>

      {!hasDates && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--card)", boxShadow: "var(--shadow)", fontSize: "0.76rem", color: "var(--soft)", display: "flex", gap: 8, alignItems: "center" }}>
          <Minus size={14} /> {t("dyn_needs_history")}
        </div>
      )}

      {/* calendar-style tile grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {sorted.map(tile => {
          const intensity = 0.10 + 0.55 * (tile.value / maxV);
          const tr = tile.trend;
          return (
            <div key={tile.name} title={tile.name}
              style={{ borderRadius: 14, padding: 14, minHeight: 96, background: `rgba(12,85,99,${intensity})`, border: "1px solid var(--divider)", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "var(--shadow)" }}>
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
  );
}
