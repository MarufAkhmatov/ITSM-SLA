import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X, ExternalLink, AlertTriangle, Sparkles, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { openIssue } from "../issue";
import { jiraUrl } from "../jira";
import { usePopupOpenSignal, useTemurBesidePad, setPageContext } from "../popup";

const SEV = {
  high: { bg: "#e0574f", soft: "#e0574f1a", text: "#c5453d" },
  med: { bg: "#d4a84b", soft: "#d4a84b1a", text: "#b06a16" },
  low: { bg: "#7c8a9a", soft: "#7c8a9a1a", text: "#6b7a8d" },
} as const;

export function EpicQualityModal({ onClose }: { onClose: () => void }) {
  const { t, tf, lang } = useI18n();
  const { epicQuality, epicQualityRecommend, data } = usePortfolio();
  const base = data?.meta?.jira_base;
  usePopupOpenSignal(true);
  const besidePad = useTemurBesidePad();

  const [res, setRes] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);                 // expanded epic key
  const [recs, setRecs] = useState<Record<string, any>>({});            // key -> {loading, text}
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { epicQuality().then(setRes); }, [epicQuality]);

  const flagged: any[] = res?.flagged || [];
  const sevLabel = (s: string) => (s === "high" ? t("eq_sev_high") : s === "med" ? t("eq_sev_med") : t("eq_sev_low"));

  // publish to Temur as page context
  useEffect(() => {
    if (!res) return;
    const text = `${t("eq_title")} (${flagged.length})\n` + flagged.slice(0, 60).map((f) =>
      `${f.key} [${f.severity}] ${f.summary || ""} — ${(f.problems || []).map((p: any) => t("eqp_" + p.type)).join("; ")}`).join("\n");
    setPageContext({ title: t("eq_title"), text });
    return () => setPageContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  const toggle = async (f: any) => {
    const k = f.key;
    if (open === k) { setOpen(null); return; }
    setOpen(k);
    if (!recs[k]) {
      setRecs((r) => ({ ...r, [k]: { loading: true } }));
      const out = await epicQualityRecommend(k, lang);
      setRecs((r) => ({ ...r, [k]: { loading: false, text: out?.recommendation || "" } }));
    }
  };

  const copy = (k: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(k);
      setTimeout(() => setCopied((c) => (c === k ? null : c)), 1800);
    });
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
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 680, maxWidth: "96vw", height: "min(86vh, 820px)", padding: 22, display: "flex", flexDirection: "column" }}
      >
        {/* header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "#e0574f1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={18} color="#e0574f" />
            </span>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>{t("eq_title")}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--soft)" }}>{t("eq_subtitle")}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        {/* summary line */}
        {res && (
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 8 }}>
            {flagged.length > 0 && <>{tf("eq_flagged_of", { count: flagged.length, total: res.total_recent })} · </>}
            {tf("eq_window", { days: res.window_days })}
          </div>
        )}

        {/* body */}
        <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6, display: "flex", flexDirection: "column", gap: 8 }}>
          {!res ? (
            <div style={{ padding: 24, color: "var(--muted)", fontSize: "0.82rem", textAlign: "center" }}>{t("eq_loading")}</div>
          ) : flagged.length === 0 ? (
            <div style={{ padding: 24, color: "var(--muted)", fontSize: "0.82rem", textAlign: "center" }}>
              <Check size={26} color="#2e9e5f" style={{ marginBottom: 8 }} /><br />{t("eq_none")}
            </div>
          ) : flagged.map((f) => {
            const sv = (SEV as any)[f.severity] || SEV.low;
            const isOpen = open === f.key;
            const rec = recs[f.key];
            return (
              <div key={f.key} style={{ flexShrink: 0, borderRadius: 12, background: "var(--surface2)", border: `1px solid ${sv.soft}`, overflow: "hidden" }}>
                {/* card head */}
                <div style={{ padding: "10px 12px", borderLeft: `3px solid ${sv.bg}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.54rem", fontWeight: 700, textTransform: "uppercase", color: "#fff", background: sv.bg, borderRadius: 4, padding: "1px 6px" }}>{sevLabel(f.severity)}</span>
                    <span onClick={() => openIssue(f.key)} className="jira-link" style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text)", cursor: "pointer" }}>{f.key}</span>
                    <a href={jiraUrl(f.key, f.url, base)} target="_blank" rel="noopener noreferrer" style={{ display: "flex", color: "#9aa5b4" }}><ExternalLink size={10} /></a>
                    <span style={{ marginLeft: "auto", fontSize: "0.62rem", color: "var(--muted)" }}>{t("eq_score")} {f.score}/100</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--soft)", lineHeight: 1.35, overflowWrap: "anywhere", marginTop: 4 }}>{f.summary || "—"}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: "0.62rem", color: "var(--muted)", flexWrap: "wrap" }}>
                    {f.reporter && <span>{t("eq_reporter")}: <b style={{ color: "var(--soft)", fontWeight: 600 }}>{f.reporter}</b></span>}
                    {f.pm && <span>PM: {f.pm}</span>}
                    {f.created && <span>{f.created}</span>}
                  </div>

                  {/* problem badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                    {(f.problems || []).map((p: any, i: number) => {
                      const ps = (SEV as any)[p.severity] || SEV.low;
                      return (
                        <span key={i} style={{ fontSize: "0.62rem", fontWeight: 600, color: ps.text, background: ps.soft, borderRadius: 999, padding: "2px 9px" }}>
                          {t("eqp_" + p.type)}
                        </span>
                      );
                    })}
                  </div>

                  {/* recommendation toggle */}
                  <button onClick={() => toggle(f)}
                    style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "6px 11px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: "linear-gradient(165deg, #083A47 0%, #0c5563 60%, #4EB6A6 100%)", color: "#fff", fontSize: "0.7rem", fontWeight: 600 }}>
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <Sparkles size={12} /> {t("eq_generate")}
                  </button>
                </div>

                {/* recommendation body */}
                {isOpen && (
                  <div style={{ padding: "0 12px 12px 15px" }}>
                    <div style={{ fontSize: "0.66rem", fontWeight: 600, color: "var(--muted)", margin: "4px 0 6px" }}>{t("eq_recommend_title")}</div>
                    {rec?.loading || !rec ? (
                      <div style={{ fontSize: "0.76rem", color: "var(--muted)", fontStyle: "italic", padding: "8px 0" }}>{t("eq_generating")}</div>
                    ) : (
                      <div style={{ position: "relative" }}>
                        <div style={{ fontSize: "0.78rem", color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap", background: "var(--card)", borderRadius: 10, padding: "12px 13px", border: "1px solid var(--divider)" }}>
                          {rec.text}
                        </div>
                        <button onClick={() => copy(f.key, rec.text)}
                          style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: "1px solid var(--divider)", cursor: "pointer", background: "var(--surface2)", color: "var(--text)", fontSize: "0.7rem", fontWeight: 600 }}>
                          {copied === f.key ? <><Check size={12} color="#2e9e5f" /> {t("eq_copied")}</> : <><Copy size={12} /> {t("eq_copy")}</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
