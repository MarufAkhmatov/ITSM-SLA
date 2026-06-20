import { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";

/** Global time filter — year / quarter / month / week, with a value picker.
 *  Affects every page + panel because it re-fetches the whole dashboard with
 *  ?period=&value=. Date-driven: populates once a History export supplies dates. */
export function TimeFilter() {
  const { period, periodValue, periods, setPeriod } = usePortfolio();
  const { t } = useI18n();

  const types: { key: string; label: string }[] = [
    { key: "all", label: t("gran_all") },
    { key: "year", label: t("gran_year") },
    { key: "quarter", label: t("gran_quarter") },
    { key: "month", label: t("gran_month") },
    { key: "week", label: t("gran_week") },
  ];

  const values: string[] = useMemo(() => {
    if (period === "year") return periods?.years || [];
    if (period === "quarter") return periods?.quarters || [];
    if (period === "month") return periods?.months || [];
    if (period === "week") return periods?.weeks || [];
    return [];
  }, [period, periods]);

  const hasDates = !!periods?.has_dates;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 2 }}>
        <CalendarRange size={14} /> {t("time_filter")}
      </span>
      <div style={{ display: "flex", borderRadius: 999, background: "rgba(255,255,255,0.14)", padding: 3, backdropFilter: "blur(8px)" }}>
        {types.map(tp => {
          const active = period === tp.key;
          const disabled = tp.key !== "all" && !hasDates;
          return (
            <button key={tp.key} disabled={disabled}
              onClick={() => {
                if (tp.key === "all") setPeriod("all");
                else {
                  const list = tp.key === "year" ? periods.years : tp.key === "quarter" ? periods.quarters : tp.key === "month" ? periods.months : periods.weeks;
                  setPeriod(tp.key, list?.[list.length - 1] || "");   // default to latest
                }
              }}
              title={disabled ? t("time_needs_history") : ""}
              style={{ border: "none", cursor: disabled ? "not-allowed" : "pointer", borderRadius: 999, padding: "5px 13px", fontSize: "0.78rem", fontWeight: active ? 700 : 500,
                opacity: disabled ? 0.4 : 1,
                background: active ? "#fff" : "transparent", color: active ? "#0c5563" : "#fff" }}>
              {tp.label}
            </button>
          );
        })}
      </div>

      {period !== "all" && values.length > 0 && (
        <select value={periodValue} onChange={e => setPeriod(period, e.target.value)}
          style={{ borderRadius: 999, border: "none", padding: "6px 14px", fontSize: "0.78rem", fontWeight: 600, background: "#fff", color: "#0c5563", cursor: "pointer" }}>
          {values.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )}

      {!hasDates && (
        <span style={{ fontSize: "0.66rem", color: "rgba(255,255,255,0.6)" }}>· {t("time_needs_history")}</span>
      )}
    </div>
  );
}
