import { motion } from "motion/react";
import { X } from "lucide-react";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

/** Generic "maximize a panel" modal — shows one Risk-dashboard panel's full
 *  content at large size with its own scroll. */
export function RiskPanelModal({ title, Icon, onClose, children }: { title: string; Icon?: any; onClose: () => void; children: React.ReactNode }) {
  usePopupOpenSignal(true);
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
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 640, maxWidth: "95vw", height: "min(84vh, 800px)", padding: 22, display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Icon && <Icon size={17} color="#0c5563" />}
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>
        <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
