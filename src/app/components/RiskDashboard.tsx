import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, AlertTriangle, Clock, Ban, Activity, Flame, Sparkles, ExternalLink, Info, Maximize2, MessageCircle, ChevronDown } from "lucide-react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { openIssue } from "../issue";
import { openDrill } from "../drill";
import { statusColor } from "../status";
import { jiraUrl } from "../jira";
import { useBreakpoint } from "../useBreakpoint";
import { usePopupOpen, useTemurMinimized, setTemurMinimized } from "../popup";
import { AriaPanel } from "./AriaPanel";
import { RiskMethodologyModal } from "./RiskMethodologyModal";
import { RiskCohortModal } from "./RiskCohortModal";
import { RiskPanelModal } from "./RiskPanelModal";

const GREEN = "#2e9e5f", YELLOW = "#d4a84b", RED = "#e0574f", TEAL = "#0c5563", GREY = "#7c8a9a";
const R = (n: any) => Math.round(Number(n) || 0);

/* Portfolio-dashboard-style metric: proportional sparkline (value/total bars tinted) + number + label */
const RBAR_H = [6, 10, 7, 13, 9, 15, 8, 14, 10, 16, 9, 12];
function MetricBars({ value, total, tint }: { value: number | null; total: number; tint: string }) {
  const max = Math.max(...RBAR_H);
  const filled = total > 0 && value != null && value > 0 ? Math.max(1, Math.round(RBAR_H.length * Math.min(1, value / total))) : 0;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 34, filter: "drop-shadow(0 0 4px rgba(255,255,255,0.4))" }}>
      {RBAR_H.map((b, i) => (
        <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(b / max) * 100}%` }}
          transition={{ duration: 0.5, delay: i * 0.02, ease: "easeOut" }}
          style={{ width: 2, borderRadius: 2, background: i < filled ? tint : "rgba(255,255,255,0.28)" }} />
      ))}
    </div>
  );
}
function RMetric({ value, total, label, tint, onClick }: { value: number | null; total: number; label: string; tint: string; onClick?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
      onClick={onClick} title={label}
      style={{ display: "flex", alignItems: "center", gap: 10, cursor: onClick ? "pointer" : "default" }}>
      <MetricBars value={value} total={total} tint={tint} />
      <div>
        <div style={{ fontSize: 32, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-1px" }}>{value ?? "—"}</div>
        <div style={{ fontSize: 12, fontWeight: 300, color: "rgba(255,255,255,0.78)", marginTop: 5, whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </motion.div>
  );
}
const healthColor = (s: number) => (s >= 70 ? GREEN : s >= 50 ? YELLOW : RED);
const sevColor = (s: string) => (s === "high" ? RED : s === "med" ? YELLOW : TEAL);

export function RiskDashboard() {
  const { t, tf } = useI18n();
  const { risk, data } = usePortfolio();
  const bp = useBreakpoint();
  const base = data?.meta?.jira_base;
  const [r, setR] = useState<any>(null);
  const [meth, setMeth] = useState(false);
  const [cohort, setCohort] = useState<{ title: string; items: any[] } | null>(null);
  const [maxP, setMaxP] = useState<{ key: string; title: string; Icon: any } | null>(null);
  const popupOpen = usePopupOpen();
  const temurMin = useTemurMinimized();
  const isDesktop = bp === "desktop";
  const isMobile = bp === "mobile";
  const dockFixed = popupOpen && isDesktop;   // float Temur to a right-side dock while a popup is open

  useEffect(() => { risk().then(setR); }, [risk]);

  const rollup = r?.rollup || {};
  const buckets = r?.health_buckets || { green: 0, yellow: 0, red: 0 };
  const register: any[] = r?.register || [];
  const heatmap: any[] = r?.heatmap || [];
  const aging: any[] = r?.aging || [];
  const blocked: any[] = (r?.blocked?.projects || []).concat(r?.blocked?.tasks || []);
  const insights: any[] = r?.insights || [];
  const cohorts: Record<string, any[]> = r?.cohorts || {};
  const openCohort = (key: string, label: string) => setCohort({ title: label, items: cohorts[key] || [] });

  const Tag = ({ epic }: { epic: boolean }) => (
    <span style={{ fontSize: "0.54rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "#fff", background: epic ? TEAL : GREY, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>
      {epic ? t("cal_epic_label") : t("cal_task_label")}
    </span>
  );
  const KeyLink = ({ k, url }: { k: string; url?: string }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text)" }}>{k}</span>
      {url !== undefined && <a href={jiraUrl(k, url, base)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "flex", color: "#9aa5b4" }}><ExternalLink size={9} /></a>}
    </span>
  );

  const cards = [
    { key: "at_risk", label: t("risk_at_risk"), val: rollup.at_risk, color: YELLOW, Icon: ShieldAlert },
    { key: "critical", label: t("risk_critical"), val: rollup.critical, color: RED, Icon: Flame },
    { key: "delayed", label: t("risk_delayed"), val: rollup.delayed, color: YELLOW, Icon: Clock },
    { key: "overdue", label: t("risk_overdue"), val: rollup.overdue_tasks, color: YELLOW, Icon: AlertTriangle },
    { key: "blocked", label: t("risk_blocked"), val: rollup.blocked, color: RED, Icon: Ban },
    { key: "wip", label: t("risk_wip"), val: rollup.wip, color: TEAL, Icon: Activity },
  ];
  const totalH = (buckets.green || 0) + (buckets.yellow || 0) + (buckets.red || 0) || 1;

  const insightText = (i: any) => {
    if (i.type === "slow_project") return tf("ins_slow_project", { key: i.key, name: i.summary || "", score: R(i.score), ttm: R(i.ttm) });
    if (i.type === "throughput_drop") return tf("ins_throughput_drop", { value: Math.abs(R(i.value)), period: i.period });
    if (i.type === "long_blocked") return tf("ins_long_blocked", { key: i.key, name: i.summary || "", days: R(i.days) });
    if (i.type === "aging") return tf("ins_aging", { key: i.key, name: i.summary || "", status: i.status, days: R(i.days) });
    return "";
  };

  const cardBox: React.CSSProperties = { background: "var(--surface2)", borderRadius: 12, padding: 14, minWidth: 0 };
  const itemRow: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, padding: "8px 0", borderBottom: "1px solid var(--divider)", cursor: "pointer" };
  const nameWrap: React.CSSProperties = { fontSize: "0.7rem", color: "var(--soft)", lineHeight: 1.3, overflowWrap: "anywhere" };
  const metaRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
  const emptyTxt = <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>—</span>;

  /* ---------------- panel body renderers (used in card AND maximize modal) --------------- */
  const registerBody = () => register.length === 0 ? <div style={{ padding: 12, color: "var(--muted)", fontSize: "0.8rem" }}>{t("risk_none")}</div> : (
    <>{register.map((h) => (
      <div key={h.key} onClick={() => openIssue(h.key)} className="jira-link" style={itemRow}>
        <div style={metaRow}>
          <Tag epic={!!h.is_epic} /><KeyLink k={h.key} url={h.url} />
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "#fff", background: healthColor(h.score), borderRadius: 6, padding: "1px 6px" }} title={t("risk_score")}>{R(h.score)}</span>
            <span style={{ fontSize: "0.64rem", color: "var(--muted)" }} title={t("risk_col_ttm")}>{R(h.ttm)}{t("ttm_days") || "d"}</span>
            {h.blocked > 0 && <span style={{ fontSize: "0.62rem", fontWeight: 700, color: RED }} title={t("risk_col_blockers")}>⛔ {h.blocked}</span>}
          </span>
        </div>
        <span style={nameWrap} title={h.project}>{h.summary || h.project}</span>
        <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{h.pm}</span>
      </div>
    ))}</>
  );

  const agingBody = () => aging.length === 0 ? emptyTxt : (
    <>{aging.map((a) => (
      <div key={a.key} onClick={() => openIssue(a.key)} className="jira-link" style={itemRow}>
        <div style={metaRow}>
          <Tag epic={!!a.is_epic} /><KeyLink k={a.key} url={a.url} />
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: statusColor(a.status) }} />
            <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{a.status}</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: RED }}>{R(a.days)}{t("ttm_days") || "d"}</span>
          </span>
        </div>
        <span style={nameWrap} title={a.summary}>{a.summary || "—"}</span>
      </div>
    ))}</>
  );

  const blockedBody = () => blocked.length === 0 ? emptyTxt : (
    <>{blocked.map((b) => (
      <div key={b.key} onClick={() => openIssue(b.key)} className="jira-link" style={itemRow}>
        <div style={metaRow}>
          <Tag epic={!!b.is_epic} /><KeyLink k={b.key} />
          <span style={{ marginLeft: "auto", fontSize: "0.62rem", fontWeight: 700, color: b.risk === "High" ? RED : YELLOW }}>{b.risk}</span>
        </div>
        <span style={nameWrap} title={b.summary}>{b.summary || "—"}</span>
        {(b.blocked_by || []).length > 0 && <span style={{ fontSize: "0.6rem", color: "var(--muted)", overflowWrap: "anywhere" }}>← {(b.blocked_by || []).join(", ")}</span>}
      </div>
    ))}</>
  );

  const insightsBody = () => insights.length === 0 ? emptyTxt : (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {insights.map((i, idx) => (
        <div key={idx} onClick={() => i.key && openIssue(i.key)} style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: i.key ? "pointer" : "default" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: sevColor(i.severity), marginTop: 5, flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            {i.key && <Tag epic={!!i.is_epic} />}
            <span style={{ fontSize: "0.74rem", color: "var(--soft)", lineHeight: 1.35 }}>{insightText(i)}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const heatmapBody = () => heatmap.length === 0 ? emptyTxt : (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 34px 34px 34px", gap: 4, alignItems: "center", marginBottom: 4 }}>
        <span />
        {[[t("risk_b_green"), GREEN], [t("risk_b_yellow"), YELLOW], [t("risk_b_red"), RED]].map(([lab, c]: any) => (
          <span key={lab} title={lab} style={{ display: "flex", justifyContent: "center" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: c }} /></span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {heatmap.map((row) => (
          <div key={row.pm} style={{ display: "grid", gridTemplateColumns: "1fr 34px 34px 34px", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }} title={row.pm}>{row.pm}</span>
            {[["green", GREEN], ["yellow", YELLOW], ["red", RED]].map(([k, c]) => {
              const n = row[k as string] || 0;
              return <span key={k as string} onClick={(e) => { e.stopPropagation(); n && openDrill(row.pm, { scope: "epics", pm: row.pm }); }}
                style={{ textAlign: "center", fontSize: "0.66rem", fontWeight: n ? 700 : 400, color: n ? "#fff" : "var(--muted)", background: n ? (c as string) : "var(--divider)", borderRadius: 5, padding: "2px 0", opacity: n ? 1 : 0.5, cursor: n ? "pointer" : "default" }}>{n}</span>;
            })}
          </div>
        ))}
      </div>
    </>
  );

  const bodyFor = (k: string) => k === "register" ? registerBody() : k === "aging" ? agingBody() : k === "blocked" ? blockedBody() : k === "insights" ? insightsBody() : k === "heatmap" ? heatmapBody() : null;

  // panel card. flex set → fill mode (grows to fill its column, body scrolls → bottoms
  // align like the Portfolio dashboard). flex unset → content mode (mobile), capped by bodyMax.
  const Panel = ({ pkey, title, Icon, flex, bodyMax = 210, children }: { pkey: string; title: string; Icon: any; flex?: number; bodyMax?: number; children: React.ReactNode }) => (
    <div style={{ ...cardBox, display: "flex", flexDirection: "column", ...(flex ? { flex: `${flex} 1 0`, minHeight: 0 } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexShrink: 0 }}>
        <Icon size={15} color={TEAL} />
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>{title}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => setMeth(true)} title={t("risk_methodology")} style={{ width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer", background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Info size={13} color="#9aa5b4" />
          </button>
          <button onClick={() => setMaxP({ key: pkey, title, Icon })} title={t("risk_expand")} style={{ width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer", background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Maximize2 size={12} color="#9aa5b4" />
          </button>
        </div>
      </div>
      <div className="pn-scroll" style={flex ? { flex: 1, minHeight: 0, overflowY: "auto" } : { maxHeight: bodyMax, overflowY: "auto", minHeight: 0 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: isDesktop ? "100%" : "auto", minHeight: isDesktop ? 0 : "calc(100dvh - 130px)", overflow: isDesktop ? "hidden" : "visible", gap: 12 }}>
      {/* Portfolio-style header: big white title + subtitle (left), KPI metrics (right) */}
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 14 : 24, flexDirection: isMobile ? "column" : "row", flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 300, color: "#fff", letterSpacing: "-1px", margin: 0, lineHeight: 1.05 }}>{t("risk_title")}</h1>
          <p style={{ fontSize: isMobile ? 13 : 16, fontWeight: 300, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>{t("risk_subtitle")}</p>
          <button onClick={() => setMeth(true)} title={t("risk_methodology")} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", fontSize: "0.74rem", fontWeight: 600 }}>
            <Info size={14} /> {t("risk_methodology")}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 16 : 24, flexWrap: "wrap", flexShrink: 0 }}>
          {cards.map(({ key, label, val, color }) => (
            <RMetric key={key} value={val} total={totalH} label={label} tint={color} onClick={() => openCohort(key, label)} />
          ))}
        </div>
      </div>

        {/* portfolio health bar */}
        <div style={{ ...cardBox, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>{t("risk_health")}</span>
            <button onClick={() => setMeth(true)} title={t("risk_methodology")} style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer", background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center" }}><Info size={13} color="#9aa5b4" /></button>
          </div>
          <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", background: "var(--divider)" }}>
            {[["green", GREEN], ["yellow", YELLOW], ["red", RED]].map(([k, c]) => (
              (buckets[k as string] || 0) > 0 && <div key={k as string} style={{ width: `${(buckets[k as string] / totalH) * 100}%`, background: c as string }} title={`${buckets[k as string]}`} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
            {[[t("risk_b_green"), GREEN, buckets.green], [t("risk_b_yellow"), YELLOW, buckets.yellow], [t("risk_b_red"), RED, buckets.red]].map(([lab, c, n]: any) => (
              <span key={lab} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "var(--soft)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} /> {lab}: <b style={{ color: "var(--text)" }}>{n || 0}</b>
              </span>
            ))}
          </div>
        </div>

        {/* Panels region — on desktop the 3 columns FILL the remaining height so all
            panel bottoms align (like the Portfolio dashboard). Temur floats to a right
            dock (minimize/restore) when a popup opens. */}
        {(() => {
          const temurCell = (dockFixed && temurMin) ? (
            <button key="tpill" onClick={() => setTemurMinimized(false)} title={t("temur_restore")}
              style={{ position: "fixed", right: 18, bottom: 18, zIndex: 480, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, border: "none", cursor: "pointer", color: "#fff", background: "linear-gradient(165deg, #083A47 0%, #0c5563 50%, #4EB6A6 100%)", boxShadow: "0 10px 28px rgba(8,58,71,0.5)", fontSize: "0.8rem", fontWeight: 600 }}>
              <MessageCircle size={16} /> Temur
            </button>
          ) : (
            <div key="tdock" style={dockFixed
              ? { position: "fixed", right: 18, top: 80, bottom: 18, width: "min(390px, 30vw)", zIndex: 480, borderRadius: 14, boxShadow: "0 24px 70px rgba(0,0,0,0.5)", overflow: "hidden" }
              : isDesktop ? { position: "relative", flex: "1.7 1 0", minHeight: 0, borderRadius: 14, overflow: "hidden" }
              : { position: "relative", height: 420, borderRadius: 14, overflow: "hidden" }}>
              {dockFixed && (
                <button onClick={() => setTemurMinimized(true)} title={t("temur_minimize")}
                  style={{ position: "absolute", top: 10, right: 10, zIndex: 2, width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.18)", color: "#fff", backdropFilter: "blur(6px)" }}>
                  <ChevronDown size={16} />
                </button>
              )}
              <AriaPanel />
            </div>
          );
          const f = (n: number) => (isDesktop ? n : undefined);
          const pRegister = <Panel pkey="register" title={t("risk_register")} Icon={AlertTriangle} flex={f(1.3)} bodyMax={230}>{registerBody()}</Panel>;
          const pAging = <Panel pkey="aging" title={t("risk_aging")} Icon={Clock} flex={f(1.1)} bodyMax={230}>{agingBody()}</Panel>;
          const pBlocked = <Panel pkey="blocked" title={t("risk_blocked_items")} Icon={Ban} flex={f(0.8)} bodyMax={150}>{blockedBody()}</Panel>;
          const pHeatmap = <Panel pkey="heatmap" title={t("risk_heatmap")} Icon={Flame} flex={f(1)} bodyMax={150}>{heatmapBody()}</Panel>;
          const pInsights = <Panel pkey="insights" title={t("risk_insights")} Icon={Sparkles} flex={f(1.1)} bodyMax={230}>{insightsBody()}</Panel>;
          const col: React.CSSProperties = { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 };
          return isDesktop ? (
            <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
              <div style={col}>{pRegister}{pHeatmap}</div>
              <div style={col}>{pAging}{pInsights}</div>
              <div style={col}>{pBlocked}{temurCell}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pRegister}{pAging}{pBlocked}{pHeatmap}{pInsights}{temurCell}
            </div>
          );
        })()}

      <AnimatePresence>{meth && <RiskMethodologyModal onClose={() => setMeth(false)} />}</AnimatePresence>
      <AnimatePresence>{cohort && <RiskCohortModal title={cohort.title} items={cohort.items} onClose={() => setCohort(null)} />}</AnimatePresence>
      <AnimatePresence>{maxP && <RiskPanelModal title={maxP.title} Icon={maxP.Icon} onClose={() => setMaxP(null)}>{bodyFor(maxP.key)}</RiskPanelModal>}</AnimatePresence>
    </div>
  );
}
