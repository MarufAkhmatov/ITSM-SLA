import { motion } from "motion/react";
import { X, BookOpen } from "lucide-react";
import { useI18n } from "../i18n";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

const SECTIONS = [
  ["meth_rollup_t", "meth_rollup_d"],
  ["meth_health_t", "meth_health_d"],
  ["meth_register_t", "meth_register_d"],
  ["meth_heatmap_t", "meth_heatmap_d"],
  ["meth_aging_t", "meth_aging_d"],
  ["meth_blocked_t", "meth_blocked_d"],
  ["meth_insights_t", "meth_insights_d"],
];

export function RiskMethodologyModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  usePopupOpenSignal(true);   // float Temur on top while this popup is open
  const besidePad = useTemurBesidePad();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 360, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 580, maxWidth: "95vw", height: "min(82vh, 760px)", padding: 24, display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: "#0c556318", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={17} color="#0c5563" />
            </span>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{t("risk_methodology")}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
          <p style={{ fontSize: "0.82rem", color: "var(--soft)", lineHeight: 1.5, margin: "0 0 16px" }}>{t("meth_intro")}</p>
          {SECTIONS.map(([tk, dk]) => (
            <div key={tk} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--divider)" }}>
              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text)", marginBottom: 5 }}>{t(tk)}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--soft)", lineHeight: 1.55 }}>{t(dk)}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
