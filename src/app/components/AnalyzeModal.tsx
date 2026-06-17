import { useState } from "react";
import { motion } from "motion/react";
import { X, Sparkles, Loader2, FileSearch } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { openIssue } from "../issue";
import { statusColor } from "../status";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

export function AnalyzeModal({ onClose }: { onClose: () => void }) {
  const { analyze } = usePortfolio();
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  usePopupOpenSignal(true);   // float Temur on top while this popup is open
  const besidePad = useTemurBesidePad();

  const run = () => {
    if (!text.trim() || loading) return;
    setLoading(true); setRes(null);
    analyze(text.trim()).then((r) => { setRes(r); setLoading(false); });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 360, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 600, maxWidth: "95vw", height: "min(86vh, 780px)", padding: 24, display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2">
            <FileSearch size={18} color="#2d7a5f" />
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{t("an_title")}</span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("an_placeholder")}
          style={{ width: "100%", minHeight: 96, resize: "vertical", borderRadius: 10, border: "1px solid var(--divider)", background: "var(--surface2)", color: "var(--text)", padding: 12, fontSize: "0.82rem", fontFamily: "var(--font-sans)", outline: "none" }}
        />
        <div className="flex items-center justify-end" style={{ marginTop: 10, marginBottom: 8 }}>
          <button onClick={run} disabled={loading || !text.trim()}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg,#2d7a5f,#4EB6A6)", border: "none", cursor: loading || !text.trim() ? "default" : "pointer", opacity: loading || !text.trim() ? 0.6 : 1, fontSize: "0.82rem", fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)" }}>
            {loading ? <Loader2 size={14} className="pn-spin" /> : <Sparkles size={14} />} {t("an_button")}
          </button>
        </div>

        <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
          {loading && (
            <div className="flex items-center gap-2" style={{ padding: 12, fontSize: "0.8rem", color: "var(--muted)" }}>
              <Loader2 size={14} className="pn-spin" /> {t("an_thinking")}
            </div>
          )}

          {res?.recommendation && (
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: "linear-gradient(135deg, rgba(45,122,95,0.10), rgba(78,182,166,0.10))", border: "1px solid rgba(45,122,95,0.25)" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
                <Sparkles size={15} color="#2d7a5f" />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" }}>{t("an_recommendation")}</span>
                {res.source && <span style={{ fontSize: "0.58rem", color: "var(--muted)" }}>· {res.source}</span>}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{res.recommendation}</div>
            </div>
          )}

          {res?.similar?.length > 0 && (
            <>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{t("an_similar")}</div>
              {res.similar.map((s: any) => (
                <div key={s.key} onClick={() => openIssue(s.key)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", borderBottom: "1px solid var(--divider)", cursor: "pointer" }}>
                  <span style={{ width: 36, fontSize: "0.6rem", fontWeight: 700, color: "#4EB6A6", textAlign: "right" }}>{Math.round(s.score * 100)}%</span>
                  <span className="jira-link" style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>{s.key}</span>
                  <span style={{ fontSize: "0.62rem", fontWeight: 600, color: statusColor(s.status), flexShrink: 0 }}>{s.status}</span>
                  {s.duration_days != null && <span style={{ fontSize: "0.62rem", color: "var(--muted)", flexShrink: 0 }}>{s.duration_days}d</span>}
                  <span style={{ fontSize: "0.72rem", color: "var(--soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.summary}>{s.summary}</span>
                </div>
              ))}
            </>
          )}

          {res && !res.recommendation && !res.similar?.length && (
            <div style={{ padding: 12, fontSize: "0.8rem", color: "var(--muted)" }}>{t("an_empty")}</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
