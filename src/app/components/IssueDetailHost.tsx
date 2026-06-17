import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink, Sparkles, MessageSquare, Lightbulb, Loader2 } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { jiraUrl } from "../jira";
import { statusChip } from "../status";
import { usePopupOpenSignal, useTemurBesidePad, setPageContext } from "../popup";

function Field({ label, value, link }: { label: string; value: any; link?: string }) {
  const v = (value === null || value === undefined || value === "") ? "—" : String(value);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "0.62rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      {link ? (
        <a className="jira-link" href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8rem", color: "var(--text)", fontWeight: 500 }}>{v}</a>
      ) : (
        <div style={{ fontSize: "0.8rem", color: "var(--text)", fontWeight: 500, wordBreak: "break-word" }}>{v}</div>
      )}
    </div>
  );
}

export function IssueDetailHost() {
  const { issueDetail, issueSummary, issueRecommend, data } = usePortfolio();
  const { t } = useI18n();
  const base = data?.meta?.jira_base;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [rec, setRec] = useState<any>(null);
  const [recLoading, setRecLoading] = useState(false);
  usePopupOpenSignal(open);   // float Temur on top while this popup is open
  const besidePad = useTemurBesidePad();

  useEffect(() => {
    const handler = (e: Event) => {
      const { key } = (e as CustomEvent).detail;
      setOpen(true); setLoading(true); setRes(null);
      setSummary(null); setSummaryLoading(false); setRec(null); setRecLoading(false);
      issueDetail(key).then((r) => {
        setRes(r); setLoading(false);
        if (r?.found) {
          // Fetch the AI summary separately so the popup renders instantly.
          setSummaryLoading(true);
          issueSummary(key).then((s) => { setSummary(s); setSummaryLoading(false); });
        }
      });
    };
    window.addEventListener("pn-issue", handler);
    return () => window.removeEventListener("pn-issue", handler);
  }, [issueDetail, issueSummary]);

  // Publish this issue as Temur's "page context" for scoped answers.
  useEffect(() => {
    const ish = res?.issue;
    if (!open || !ish) return;
    const cs = (ish.comments || []).slice(0, 3).map((c: any) => (typeof c === "string" ? c : c?.body || "")).filter(Boolean);
    const text = [
      `${ish.key} — ${ish.summary || ""}`,
      `Type: ${ish.type || ""} | Status: ${ish.status || ""} | PM: ${ish.pm || ""} | Assignee: ${ish.assignee || ""}`,
      `Created: ${(ish.created || "").slice(0, 10)} | Resolved: ${(ish.resolved || "").slice(0, 10)} | Due: ${(ish.due || "").slice(0, 10)}`,
      cs.length ? `Recent comments: ${cs.join(" || ")}` : "",
    ].filter(Boolean).join("\n");
    setPageContext({ title: ish.key, text });
    return () => setPageContext(null);
  }, [open, res]);

  const askRecommendation = () => {
    if (!i || recLoading) return;
    setRecLoading(true); setRec(null);
    issueRecommend(i.key).then((r) => { setRec(r); setRecLoading(false); });
  };

  const i = res?.issue;
  const url = i ? jiraUrl(i.key, i.url, base) : "#";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.55)", backdropFilter: "blur(4px)", zIndex: 450, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, ...besidePad }}
        >
          <motion.div
            initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", width: 560, maxWidth: "95vw", maxHeight: "86vh", padding: 24, display: "flex", flexDirection: "column" }}
          >
            {loading || !i ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                {loading ? t("id_loading") : t("id_not_found")}
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => setOpen(false)} style={{ padding: "8px 16px", borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", color: "var(--text)" }}>{t("id_close")}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between" style={{ marginBottom: 14, gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                      <a className="jira-link" href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.85rem", fontWeight: 700, color: "#2d7a5f" }}>{i.key}</a>
                      <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#fff", background: i.is_epic ? "#9b59b6" : "#2d7a5f", borderRadius: 6, padding: "2px 7px" }}>{i.type}</span>
                      <span style={{ fontSize: "0.62rem", fontWeight: 600, borderRadius: 6, padding: "2px 7px", ...statusChip(i.status) }}>{i.status}</span>
                    </div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>{i.summary || "—"}</div>
                  </div>
                  <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <X size={15} color="#6b7a8d" />
                  </button>
                </div>

                <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
                  {/* AI summary from quarterly status + comments (loaded async) */}
                  {(summaryLoading || summary?.summary) && (
                    <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: "linear-gradient(135deg, rgba(45,122,95,0.10), rgba(78,182,166,0.10))", border: "1px solid rgba(45,122,95,0.25)" }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
                        <Sparkles size={15} color="#2d7a5f" />
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" }}>{t("id_ai_summary")}</span>
                        {summary?.source && (
                          <span style={{ fontSize: "0.58rem", color: "var(--muted)" }}>
                            · {t("id_quarterly_status_short")} + {summary.comments_count} {t("id_comments_word")} · {summary.source}
                          </span>
                        )}
                      </div>
                      {summaryLoading ? (
                        <div className="flex items-center gap-2" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                          <Loader2 size={14} className="pn-spin" /> {t("id_thinking")}
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{summary.summary}</div>
                      )}
                    </div>
                  )}

                  {/* AI recommendation (open issues only, on demand) */}
                  {(recLoading || rec?.recommendation) && (
                    <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: "linear-gradient(135deg, rgba(245,166,35,0.10), rgba(78,182,166,0.10))", border: "1px solid rgba(245,166,35,0.28)" }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
                        <Lightbulb size={15} color="#d98b1f" />
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" }}>{t("id_recommendation")}</span>
                        {rec?.source && (
                          <span style={{ fontSize: "0.58rem", color: "var(--muted)" }}>· {t("id_how_to_close")} · {rec.source}</span>
                        )}
                      </div>
                      {recLoading ? (
                        <div className="flex items-center gap-2" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                          <Loader2 size={14} className="pn-spin" /> {t("id_thinking")}
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{rec.recommendation}</div>
                      )}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
                    <Field label={t("f_project")} value={i.project} />
                    <Field label={t("f_pm")} value={i.pm} />
                    <Field label={t("f_assignee")} value={i.assignee} />
                    <Field label={t("f_reporter")} value={i.reporter} />
                    <Field label={t("f_priority")} value={i.priority} />
                    <Field label={t("f_project_type")} value={i.project_type} />
                    <Field label={t("f_division")} value={i.division} />
                    <Field label={t("f_regulator")} value={i.regulator} />
                    <Field label={t("f_scoring")} value={i.scoring} />
                    <Field label={t("f_created")} value={(i.created || "").slice(0, 10)} />
                    <Field label={t("f_resolved")} value={(i.resolved || "").slice(0, 10)} />
                    <Field label={t("f_due")} value={(i.due || "").slice(0, 10)} />
                    <Field label={t("f_duration")} value={res.duration_days} />
                    {i.epic_key && <Field label={t("f_epic_link")} value={i.epic_key} link={jiraUrl(i.epic_key, "", base)} />}
                    {res.children?.length > 0 && <Field label={t("f_children")} value={res.children.length} />}
                    {i.links?.length > 0 && <Field label={t("f_dependencies")} value={i.links.map((l: any) => `${l.type} ${l.target}`).join(", ")} />}
                  </div>

                  {/* Quarterly status raw */}
                  {i.quarterly_status && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: "0.62rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{t("f_quarterly_status")}</div>
                      <div style={{ fontSize: "0.74rem", color: "var(--soft)", lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 150, overflow: "auto", padding: 10, borderRadius: 8, background: "var(--surface2)" }}>{i.quarterly_status}</div>
                    </div>
                  )}

                  {/* Comments */}
                  {i.comments?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div className="flex items-center gap-1" style={{ fontSize: "0.62rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                        <MessageSquare size={11} /> {t("f_comments")} ({i.comments.length})
                      </div>
                      {i.comments.map((c: any, idx: number) => (
                        <div key={idx} style={{ padding: "8px 0", borderTop: "1px solid var(--divider)" }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text)" }}>
                            {c.author || "—"} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {c.date}</span>
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--soft)", lineHeight: 1.45, marginTop: 2 }}>{c.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2" style={{ marginTop: 18 }}>
                  {res.is_open && (
                    <button onClick={askRecommendation} disabled={recLoading} style={{ display: "flex", alignItems: "center", gap: 6, marginRight: "auto", padding: "8px 16px", borderRadius: 10, background: "rgba(245,166,35,0.14)", border: "1px solid rgba(245,166,35,0.4)", cursor: recLoading ? "default" : "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#b9750f", fontFamily: "var(--font-sans)", opacity: recLoading ? 0.7 : 1 }}>
                      {recLoading ? <Loader2 size={14} className="pn-spin" /> : <Lightbulb size={14} />}
                      {t("id_ai_recommendation")}
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} style={{ padding: "8px 16px", borderRadius: 10, background: "var(--surface2)", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "var(--text)", fontFamily: "var(--font-sans)" }}>{t("id_close")}</button>
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg,#2d7a5f,#4EB6A6)", color: "#fff", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>
                    <ExternalLink size={14} /> {t("id_open_jira")}
                  </a>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
