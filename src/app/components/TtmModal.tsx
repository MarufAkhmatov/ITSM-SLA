import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { X, Timer, AlertTriangle } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

const sel: React.CSSProperties = {
  background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--divider)",
  borderRadius: 8, padding: "5px 9px", fontSize: "0.72rem", fontFamily: "var(--font-sans)", cursor: "pointer",
};

const R = (n: any) => (n === null || n === undefined ? "—" : Math.round(Number(n)));

function Metric({ label, value, suffix, approx }: { label: string; value: any; suffix?: string; approx?: boolean }) {
  return (
    <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: "0.6rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}{approx && <span style={{ color: "#d4a84b" }}> ·approx</span>}
      </div>
      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
        {value}{suffix && <span style={{ fontSize: "0.7rem", fontWeight: 400, color: "var(--muted)" }}> {suffix}</span>}
      </div>
    </div>
  );
}

export function TtmModal({ onClose, preset }: { onClose: () => void; preset?: any }) {
  const { ttm } = usePortfolio();
  const { t } = useI18n();
  const [type, setType] = useState(preset?.type || "all");
  const [period, setPeriod] = useState(preset?.period || "all");
  const [value, setValue] = useState(preset?.value || "");
  const [res, setRes] = useState<any>(null);
  usePopupOpenSignal(true);   // float Temur on top while this popup is open
  const besidePad = useTemurBesidePad();

  useEffect(() => {
    ttm({ type, period, value }).then(setRes);
  }, [ttm, type, period, value]);

  const f = res?.filters;
  const valueOptions = useMemo(() => {
    if (!f) return [];
    return period === "year" ? f.years : period === "quarter" ? f.quarters : period === "month" ? f.months : [];
  }, [f, period]);

  const d = t("ttm_days");
  const s = res?.summary;
  const maxTrend = Math.max(1, ...((res?.trend || []).map((x: any) => x.avg)));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 620, maxWidth: "95vw", height: "min(84vh, 760px)", padding: 24, display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2">
            <Timer size={18} color="#2d7a5f" />
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{t("ttm_title")}</span>
            {s && <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>· {s.count} {t("ttm_resolved")}</span>}
            {res?.has_changelog && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#2e9e5f", background: "rgba(46,158,95,0.14)", borderRadius: 6, padding: "2px 7px" }}>{t("ttm_exact")}</span>}
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontSize: "0.66rem", color: "var(--muted)" }}>{t("ttm_type")}:</span>
          <select style={sel} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">{t("pl_all")}</option>
            {(f?.types || []).map((x: string) => <option key={x} value={x}>{x}</option>)}
          </select>
          <span style={{ fontSize: "0.66rem", color: "var(--muted)", marginLeft: 6 }}>{t("ttm_period")}:</span>
          <select style={sel} value={period} onChange={(e) => { setPeriod(e.target.value); setValue(""); }}>
            <option value="all">{t("pl_all")}</option>
            <option value="year">{t("pl_year")}</option>
            <option value="quarter">{t("pl_quarter")}</option>
            <option value="month">{t("pl_month")}</option>
          </select>
          {period !== "all" && (
            <select style={sel} value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">{t("pl_all")}</option>
              {valueOptions.map((x: string) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
        </div>

        <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
          {/* Summary metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            <Metric label={`${t("ttm_total")} · ${t("ttm_avg")}`} value={R(s?.total?.avg)} suffix={d} />
            <Metric label={`${t("ttm_total")} · ${t("ttm_median")}`} value={R(s?.total?.median)} suffix={d} />
            <Metric label={`${t("ttm_total")} · ${t("ttm_p90")}`} value={R(s?.total?.p90)} suffix={d} />
            <Metric label={`${t("ttm_discovery")} · ${t("ttm_avg")}`} value={R(s?.discovery_approx?.avg)} suffix={d} approx={!res?.has_changelog} />
            <Metric label={`${t("ttm_delivery")} · ${t("ttm_avg")}`} value={R(s?.delivery_approx?.avg)} suffix={d} approx={!res?.has_changelog} />
            <Metric label={`${t("ttm_lead")} · ${t("ttm_avg")}`} value={R(s?.lead_time?.avg)} suffix={d} approx={!res?.has_changelog} />
          </div>

          {/* By type table */}
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("ttm_by_type")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr 0.8fr 0.8fr 0.9fr", gap: 6, fontSize: "0.62rem", color: "var(--muted)", paddingBottom: 4, borderBottom: "1px solid var(--divider)" }}>
            <span>{t("ttm_type")}</span><span style={{ textAlign: "right" }}>{t("ttm_count")}</span>
            <span style={{ textAlign: "right" }}>{t("ttm_avg")}</span><span style={{ textAlign: "right" }}>{t("ttm_median")}</span>
            <span style={{ textAlign: "right" }}>{t("ttm_p90")}</span>
          </div>
          {(res?.by_type || []).map((b: any) => (
            <div key={b.type} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr 0.8fr 0.8fr 0.9fr", gap: 6, fontSize: "0.72rem", color: "var(--text)", padding: "6px 0", borderBottom: "1px solid var(--divider)" }}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={b.type}>{b.type}</span>
              <span style={{ textAlign: "right", color: "var(--soft)" }}>{b.count}</span>
              <span style={{ textAlign: "right", fontWeight: 600 }}>{R(b.total.avg)}{d}</span>
              <span style={{ textAlign: "right", color: "var(--soft)" }}>{R(b.total.median)}{d}</span>
              <span style={{ textAlign: "right", color: "var(--soft)" }}>{R(b.total.p90)}{d}</span>
            </div>
          ))}

          {/* Yearly trend bars */}
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text)", margin: "16px 0 8px" }}>{t("ttm_trend")}</div>
          {(res?.trend || []).map((x: any) => (
            <div key={x.period} className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: "0.66rem", color: "var(--muted)", width: 40 }}>{x.period}</span>
              <div style={{ flex: 1, height: 14, borderRadius: 7, background: "var(--surface2)", overflow: "hidden" }}>
                <div style={{ width: `${(x.avg / maxTrend) * 100}%`, height: "100%", borderRadius: 7, background: "linear-gradient(90deg,#2d7a5f,#4EB6A6)" }} />
              </div>
              <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text)", width: 64, textAlign: "right" }}>{R(x.avg)}{d} · {x.count}</span>
            </div>
          ))}

          {/* Approx note */}
          {res && res.has_changelog === false && (
            <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "var(--surface2)", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle size={16} color="#d4a84b" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: "0.7rem", color: "var(--soft)", lineHeight: 1.45 }}>{t("ttm_approx_note")}</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
