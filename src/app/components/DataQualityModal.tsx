import { useState, useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { X, Database, AlertTriangle, CheckCircle2, Shuffle, Trash2, HelpCircle } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { usePopupOpenSignal, useTemurBesidePad } from "../popup";

export function DataQualityModal({ onClose }: { onClose: () => void }) {
  const { dataQuality, statusAudit } = usePortfolio();
  const { t } = useI18n();
  const [dq, setDq] = useState<any>(null);
  const [audit, setAudit] = useState<any>(null);
  usePopupOpenSignal(true);   // float Temur on top while this popup is open
  const besidePad = useTemurBesidePad();

  useEffect(() => { dataQuality().then(setDq); statusAudit().then(setAudit); }, [dataQuality, statusAudit]);

  const barColor = (p: number) => (p >= 80 ? "#2d7a5f" : p >= 40 ? "#d4a84b" : "#e07a7a");

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 520, maxWidth: "94vw", height: "min(80vh, 720px)", padding: 24, display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <div className="flex items-center gap-2">
            <Database size={18} color="#2d7a5f" />
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{t("dq_title")}</span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        {dq && dq.has_data !== false ? (
          <>
            <div style={{ fontSize: "0.78rem", color: "var(--soft)", marginBottom: 12 }}>
              {dq.total} {t("dq_issues")} · {dq.epics} {t("dq_epics")} ({t("dq_portfolio_projects")})
            </div>

            <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
              {(dq.fields || []).map((f: any) => (
                <div key={f.field} style={{ marginBottom: 12 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text)" }}>{f.field}</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: barColor(f.pct) }}>
                      {f.filled}/{f.total} · {f.pct}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: "var(--surface2)", overflow: "hidden" }}>
                    <div style={{ width: `${f.pct}%`, height: "100%", borderRadius: 6, background: barColor(f.pct) }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--surface2)", display: "flex", gap: 8, alignItems: "flex-start" }}>
              {dq.has_status_history ? (
                <>
                  <CheckCircle2 size={16} color="#2d7a5f" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.72rem", color: "var(--soft)" }}>{t("dq_history_yes")}</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} color="#d4a84b" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.72rem", color: "var(--soft)" }}>{t("dq_history_no")}</span>
                </>
              )}
            </div>

            {audit?.has_data && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "var(--surface2)" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                  {t("sa_title")}
                </div>

                <AuditBucket icon={<Shuffle size={14} color="#d4a84b" />} label={t("sa_mixed")}
                  hint={t("sa_mixed_hint")} rows={audit.mixed_normalized || []} showCanonical t={t} />
                <AuditBucket icon={<Trash2 size={14} color="#e07a7a" />} label={t("sa_dead")}
                  hint={t("sa_dead_hint")} rows={audit.dead_dropped || []} t={t} />
                {(audit.dead_issue_types || []).length > 0 && (
                  <AuditBucket icon={<Trash2 size={14} color="#a16eb6" />} label={t("sa_dead_types")}
                    hint={t("sa_dead_types_hint")} rows={audit.dead_issue_types || []} t={t} />
                )}
                {(audit.unknown || []).length > 0 && (
                  <AuditBucket icon={<HelpCircle size={14} color="#6b7a8d" />} label={t("sa_unknown")}
                    hint={t("sa_unknown_hint")} rows={audit.unknown || []} t={t} />
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
            {dq ? t("dq_no_data") : t("dq_loading")}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function AuditBucket({ icon, label, hint, rows, showCanonical, t }: {
  icon: ReactNode; label: string; hint: string;
  rows: { raw: string; canonical?: string; count: number }[];
  showCanonical?: boolean; t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const total = rows.reduce((s, r) => s + (r.count || 0), 0);
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)} title={hint}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
          background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}>
        {icon}
        <span style={{ fontSize: "0.72rem", color: "var(--text)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", marginLeft: "auto" }}>
          {rows.length === 0 ? t("sa_none") : `${rows.length} · ${total} ${t("sa_events")}`}
        </span>
      </button>
      {open && rows.length > 0 && (
        <div style={{ marginTop: 4, marginLeft: 22, fontSize: "0.68rem", color: "var(--soft)",
          lineHeight: 1.6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          {rows.slice(0, 30).map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 40, textAlign: "right" }}>{r.count}</span>
              <span style={{ color: "var(--text)" }}>|{r.raw}|</span>
              {showCanonical && r.canonical && <span style={{ color: "var(--muted)" }}>→ {r.canonical}</span>}
            </div>
          ))}
        </div>
      )}
      {open && rows.length > 0 && (
        <p style={{ marginTop: 6, marginLeft: 22, fontSize: "0.66rem", color: "var(--muted)", lineHeight: 1.45 }}>{hint}</p>
      )}
    </div>
  );
}
