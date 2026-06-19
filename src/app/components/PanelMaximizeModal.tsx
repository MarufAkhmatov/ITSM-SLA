import { motion } from "motion/react";
import { Minimize2 } from "lucide-react";
import { useI18n } from "../i18n";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

/** A large, near-full-screen modal that re-renders a dashboard panel at scale.
 *  Amir floats beside it (popup signal) so it's reachable while maximized. */
export function PanelMaximizeModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  usePopupOpenSignal(true);
  const besidePad = useTemurBesidePad();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.55)", backdropFilter: "blur(5px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, ...besidePad }}
    >
      <motion.div
        initial={{ scale: 0.97, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 14 }}
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 90px rgba(0,0,0,0.4)", width: "min(1180px, 96vw)", height: "min(88vh, 940px)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}
      >
        <button onClick={onClose} title={t("panel_minimize")}
          style={{ position: "absolute", top: 12, right: 12, zIndex: 5, width: 34, height: 34, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Minimize2 size={16} color="#6b7a8d" />
        </button>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
