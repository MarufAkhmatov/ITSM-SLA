import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar, Users, LayoutGrid, FileText,
  Search, Settings, Bell, ChevronDown, MessageCircle, Sparkles, X, Upload, Sun, Moon, PartyPopper, Menu, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { usePortfolio } from "./portfolio";
import { useTheme } from "./theme";
import { useAvatar, USER_ID } from "./avatars";
import { AvatarManager } from "./components/AvatarManager";
import { NotificationsBell } from "./components/NotificationsBell";
import { Celebrations } from "./components/Celebrations";
import { DataQualityModal } from "./components/DataQualityModal";
import { TtmModal } from "./components/TtmModal";
import { AnalyzeModal } from "./components/AnalyzeModal";
import { DrillDownHost } from "./components/DrillDownHost";
import { EpicQualityModal } from "./components/EpicQualityModal";
import { IssueDetailHost } from "./components/IssueDetailHost";
import { openDrill } from "./drill";
import { WellnessChart } from "./components/WellnessChart";
import { TtmComparePanel } from "./components/TtmComparePanel";
import { PatientFlowChart } from "./components/PatientFlowChart";
import { HealthcareProviders } from "./components/HealthcareProviders";
import { AriaPanel } from "./components/AriaPanel";
import { BestProjects } from "./components/BestProjects";
import { CalendarView } from "./components/CalendarView";
import { RiskDashboard } from "./components/RiskDashboard";
import { useI18n, LANGS } from "./i18n";
import { useBreakpoint } from "./useBreakpoint";
import { usePopupOpen, useTemurMinimized, setTemurMinimized } from "./popup";

/* ---------- glass tokens (nav) ---------- */
const glassPanel: React.CSSProperties = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(22px)",
  WebkitBackdropFilter: "blur(22px)",
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--glass-shadow)",
};
const glassCircle: React.CSSProperties = {
  background: "var(--glass-bg2)",
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--glass-shadow)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  flexShrink: 0,          // keep circular controls round (don't squish to ellipses)
};

/* ---------- card (theme-aware via CSS vars) ---------- */
const card: React.CSSProperties = {
  background: "var(--card)",
  borderRadius: 14,
  boxShadow: "var(--shadow)",
  overflow: "hidden",
};
const innerDivider = "1px solid var(--divider)";
const GAP = 10;

const navIcons = [
  { icon: Calendar, tkey: "nav_calendar" },
  { icon: ShieldAlert, tkey: "nav_risk" },
  { icon: Users, tkey: "nav_patients" },
  { icon: LayoutGrid, tkey: "nav_records" },
  { icon: FileText, tkey: "nav_documents" },
];

/* ---------- header metric sparkline (proportional: value/total bars tinted) ---------- */
const BAR_H = [6, 10, 7, 13, 9, 15, 8, 14, 10, 16, 9, 12, 7, 11, 8];
function MetricBars({ value, total, tint }: { value: number | null; total: number; tint: string }) {
  const max = Math.max(...BAR_H);
  const filled = total > 0 && value != null && value > 0 ? Math.max(1, Math.round(BAR_H.length * Math.min(1, value / total))) : 0;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 40, filter: "drop-shadow(0 0 4px rgba(255,255,255,0.4))" }}>
      {BAR_H.map((b, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${(b / max) * 100}%` }}
          transition={{ duration: 0.5, delay: i * 0.02, ease: "easeOut" }}
          style={{ width: 2, borderRadius: 2, background: i < filled ? tint : "rgba(255,255,255,0.28)" }}
        />
      ))}
    </div>
  );
}

function Metric({ value, total, tint, label, onClick }: { value: number | null; total: number; tint: string; label: string; onClick?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} style={{ display: "flex", alignItems: "center", gap: 13 }}>
      <MetricBars value={value} total={total} tint={tint} />
      <div>
        <div onClick={onClick} style={{ fontSize: 40, fontWeight: 300, color: "#ffffff", lineHeight: 1, letterSpacing: "-1px", cursor: onClick ? "pointer" : "default" }}>{value ?? "—"}</div>
        <div style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.78)", marginTop: 6, whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const { t, lang, setLang } = useI18n();
  const bp = useBreakpoint();
  const isDesktop = bp === "desktop";
  const isTablet = bp === "tablet";
  const isMobile = bp === "mobile";
  const [ariaOpen, setAriaOpen] = useState(false);
  const popupOpen = usePopupOpen();   // any modal open → float Temur on top (right side)
  const temurMin = useTemurMinimized();   // collapse the floating Temur dock out of the way (auto-resets when the last popup closes)
  const [view, setView] = useState<"dashboard" | "calendar" | "risk">("dashboard");   // top-nav page switch
  const [menuOpen, setMenuOpen] = useState(false);   // mobile/tablet hamburger menu
  const { data, upload, uploadBatch, online, epicQuality } = usePortfolio();
  const [eqOpen, setEqOpen] = useState(false);
  const [eqCount, setEqCount] = useState(0);     // flagged new-epic count (badge)
  const { mode, toggle } = useTheme();
  const userAvatar = useAvatar(USER_ID, "/temur.jpg");
  const [avatarMgr, setAvatarMgr] = useState(false);
  const [dqOpen, setDqOpen] = useState(false);
  const [ttmOpen, setTtmOpen] = useState(false);
  const [ttmPreset, setTtmPreset] = useState<any>(null);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  useEffect(() => {
    const openTtm = (e: Event) => { setTtmPreset((e as CustomEvent).detail || null); setTtmOpen(true); };
    const openDq = () => setDqOpen(true);
    const openAnalyze = () => setAnalyzeOpen(true);
    window.addEventListener("pn-open-ttm", openTtm);
    window.addEventListener("pn-open-dq", openDq);
    window.addEventListener("pn-open-analyze", openAnalyze);
    return () => {
      window.removeEventListener("pn-open-ttm", openTtm);
      window.removeEventListener("pn-open-dq", openDq);
      window.removeEventListener("pn-open-analyze", openAnalyze);
    };
  }, []);
  const [celOn, setCelOn] = useState(() => localStorage.getItem("pn-cel-enabled") !== "0");
  const toggleCel = () => {
    const next = !celOn;
    setCelOn(next);
    localStorage.setItem("pn-cel-enabled", next ? "1" : "0");
    window.dispatchEvent(new CustomEvent("pn-cel-toggle", { detail: { enabled: next } }));
  };
  // new-epic QA badge: refresh count whenever the dataset changes
  useEffect(() => {
    if (!data) { setEqCount(0); return; }
    epicQuality().then((r) => setEqCount(r?.count || 0)).catch(() => {});
  }, [data, epicQuality]);

  const hm = data?.widgets?.header_metrics;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const files = Array.from(list);

    // If a dataset is already active, offer to MERGE (combine PMD + PMO) vs replace
    const mode: "replace" | "merge" = data
      ? (window.confirm(t("upload_confirm")) ? "merge" : "replace")
      : "replace";
    setUploading(true);
    try {
      if (files.length === 1) {
        // Single file path — preserves the old behaviour (one alert, no progress)
        const r = await upload(files[0], mode);
        alert(r?.ok
          ? `${mode === "merge" ? t("up_merged") : t("up_loaded")} → ${r.meta.issues} ${t("up_issues")} (${r.meta.epics} ${t("up_projects")}) · ${(r.meta.projects || []).join(", ")}`
          : `${t("upload_failed")}: ${r?.error || "error"}`);
      } else {
        // Batch: orchestrates issue exports first (PMD before PMO) → History XLSX last
        setBatchProgress({ done: 0, total: files.length, current: files[0].name });
        const { results, summary } = await uploadBatch(files, mode, (done, total, current) => {
          setBatchProgress({ done, total, current });
        });
        const lines = results.map(r =>
          r.ok ? `  ✓ ${r.file}${r.kind === "history" ? ` (history, ${r.enriched} enriched)` : r.meta?.issues ? ` (${r.meta.issues} issues)` : ""}`
               : `  ✗ ${r.file} — ${r.error || "error"}`
        ).join("\n");
        const head = summary.failed === 0
          ? `✓ ${summary.ok}/${summary.total} ${t("up_files_loaded")}`
          : `⚠ ${summary.ok}/${summary.total} ${t("up_files_loaded")} (${summary.failed} ${t("up_failed")})`;
        const tail = summary.lastMeta
          ? `\n\n→ ${summary.lastMeta.issues} ${t("up_issues")} (${summary.lastMeta.epics} ${t("up_projects")}) · ${(summary.lastMeta.projects || []).join(", ")}`
          : "";
        alert(`${head}\n\n${lines}${tail}`);
      }
    } catch {
      alert(t("upload_failed_backend"));
    } finally {
      setUploading(false);
      setBatchProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* TTM comparison card (Discovery/Delivery/Total + Lead, by year/quarter/month) */
  const stressCard = (extra: React.CSSProperties = {}) => (
    <div style={{ ...card, display: "flex", flexDirection: "column", ...extra }}>
      <TtmComparePanel />
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        height: isDesktop ? "100vh" : "auto",
        overflow: isDesktop ? "hidden" : "auto",
        background: "var(--bg)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ===================== TOP NAV ===================== */}
      <header style={{ display: "flex", alignItems: "center", gap: 14, padding: isMobile ? "16px 18px 6px" : "20px 32px 8px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", ...glassCircle }}>
            <img src="/ipak-logo.svg" alt="IPAK" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
          {!isMobile && <span style={{ fontSize: "1.1rem", fontWeight: 300, color: "#ffffff" }}>ProjectNest</span>}
        </div>

        <div style={{ flex: 1 }} />

        {/* centered neo-glass nav — desktop only */}
        {isDesktop && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 6, borderRadius: 999, ...glassPanel }}>
              <button onClick={() => setView("dashboard")} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px 8px 8px", borderRadius: 999, background: view === "dashboard" ? "var(--active-bg)" : "transparent", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "none", cursor: "pointer", boxShadow: view === "dashboard" ? "var(--active-glow)" : "none", fontSize: "0.83rem", fontWeight: 300, color: view === "dashboard" ? "var(--active-text)" : "var(--header-icon)" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--active-chip)", color: "var(--active-icon)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageCircle size={14} />
                </span>
                {t("nav_dashboard")}
              </button>
              {navIcons.map(({ icon: Icon, tkey }) => {
                const isCal = tkey === "nav_calendar";
                const isRisk = tkey === "nav_risk";
                const active = (isCal && view === "calendar") || (isRisk && view === "risk");
                const onClick = isCal ? () => setView("calendar") : isRisk ? () => setView("risk") : undefined;
                return (
                  <button key={tkey} title={t(tkey)} onClick={onClick}
                    style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      color: active ? "var(--active-text)" : "var(--header-icon)",
                      background: active ? "var(--active-bg)" : undefined,
                      boxShadow: active ? "var(--active-glow)" : undefined,
                      ...(active ? {} : glassCircle) }}>
                    <Icon size={17} />
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1 }} />
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 7 : 10, flexShrink: 0 }}>
          {/* Language switcher — always */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: 4, borderRadius: 999, flexShrink: 0, ...glassPanel }}>
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                style={{
                  padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer",
                  fontSize: "0.72rem", fontWeight: lang === l.code ? 600 : 300,
                  background: lang === l.code ? "var(--active-bg)" : "transparent",
                  color: lang === l.code ? "var(--active-text)" : "#ffffff",
                  boxShadow: lang === l.code ? "var(--active-glow)" : "none",
                  fontFamily: "var(--font-sans)", transition: "all 0.18s",
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Theme toggle — always */}
          <button
            onClick={toggle}
            title={mode === "dark" ? t("tip_light_mode") : t("tip_dark_mode")}
            style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--header-icon)", ...glassCircle }}
          >
            {mode === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Upload Jira export — accepts MULTIPLE files in one go.
              FE auto-orders: issue CSV/HTML/XLS (PMD before PMO) → History XLSX last.
              `.xls` covers the Jira Service Desk Issue Navigator export. */}
          <input ref={fileRef} type="file" multiple accept=".csv,.xls,.xlsx,.xlsm,.html,.htm" onChange={onUpload} style={{ display: "none" }} />
          <button
            onClick={() => fileRef.current?.click()}
            title={online ? t("tip_upload") : t("tip_backend_offline")}
            style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: online ? "#0c5563" : "#9aa5b4", position: "relative", ...glassCircle }}
          >
            <Upload size={17} className={uploading ? "animate-pulse" : ""} />
            {batchProgress && (
              <span style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#0c5563", color: "#fff", fontSize: "0.58rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--bg)" }}>
                {batchProgress.done}/{batchProgress.total}
              </span>
            )}
            <span style={{ position: "absolute", bottom: 6, right: 7, width: 7, height: 7, borderRadius: "50%", background: online ? "#1f9d57" : "#e53e3e", border: "1.5px solid #cfe0e2" }} />
          </button>

          {/* Search — desktop + tablet */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 999, padding: "9px 18px", width: isTablet ? 160 : 210, ...glassPanel }}>
              <Search size={15} color="var(--header-icon)" />
              <input placeholder={t("search")} style={{ border: "none", outline: "none", background: "transparent", fontSize: "0.82rem", color: "var(--search-text)", fontFamily: "var(--font-sans)", width: "100%" }} />
            </div>
          )}

          {/* new-epic QA alert — desktop only (badge = flagged count) */}
          {isDesktop && (
            <button onClick={() => setEqOpen(true)} title={t("tip_epic_quality")} style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: eqCount > 0 ? "#e0574f" : "var(--header-icon)", position: "relative", ...glassCircle }}>
              <AlertTriangle size={17} />
              {eqCount > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999, background: "#e0574f", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--bg)" }}>{eqCount}</span>
              )}
            </button>
          )}

          {/* settings + bell — desktop only */}
          {isDesktop && (
            <>
              <button onClick={toggleCel} title={celOn ? t("tip_celebrations_on") : t("tip_celebrations_off")} style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: celOn ? "#3ad94f" : "var(--header-icon)", ...glassCircle }}>
                <PartyPopper size={17} />
              </button>
              <button onClick={() => setDqOpen(true)} title={t("tip_data_quality")} style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--header-icon)", ...glassCircle }}>
                <Settings size={17} />
              </button>
              <NotificationsBell />
            </>
          )}

          {/* hamburger — mobile + tablet: holds the nav + actions that don't fit */}
          {!isDesktop && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button onClick={() => setMenuOpen(o => !o)} title="Menu" style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: menuOpen ? "var(--active-text)" : "var(--header-icon)", background: menuOpen ? "var(--active-bg)" : undefined, ...(menuOpen ? {} : glassCircle) }}>
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 320 }} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.16 }}
                      style={{ position: "absolute", top: 50, right: 0, zIndex: 321, background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: 8, minWidth: 210, display: "flex", flexDirection: "column", gap: 2 }}
                    >
                      {[
                        { icon: MessageCircle, label: t("nav_dashboard"), active: view === "dashboard", onClick: () => setView("dashboard") },
                        { icon: Calendar, label: t("nav_calendar"), active: view === "calendar", onClick: () => setView("calendar") },
                        { icon: ShieldAlert, label: t("nav_risk"), active: view === "risk", onClick: () => setView("risk") },
                        { icon: AlertTriangle, label: `${t("eq_title")}${eqCount > 0 ? ` (${eqCount})` : ""}`, onClick: () => setEqOpen(true) },
                        { icon: Settings, label: t("tip_data_quality"), onClick: () => setDqOpen(true) },
                        { icon: PartyPopper, label: celOn ? t("tip_celebrations_on") : t("tip_celebrations_off"), onClick: toggleCel },
                      ].map(({ icon: Ic, label, active, onClick }) => (
                        <button key={label} onClick={() => { onClick(); setMenuOpen(false); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
                            background: active ? "var(--surface2)" : "transparent", color: active ? "#0c5563" : "var(--text)", fontSize: "0.84rem", fontWeight: active ? 600 : 400, fontFamily: "var(--font-sans)" }}>
                          <Ic size={17} color={active ? "#0c5563" : "var(--header-icon)"} /> {label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <img
            src={userAvatar}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://ui-avatars.com/api/?name=Temur&background=8a5a2b&color=fff&bold=true"; }}
            onClick={() => setAvatarMgr(true)}
            title={t("tip_manage_avatars")}
            alt="Temur"
            style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.7)", cursor: "pointer", flexShrink: 0 }}
          />
        </div>
      </header>

      {/* ===================== CONTENT ===================== */}
      <main
        style={{
          flex: 1,
          padding: isMobile ? `4px 16px ${ariaOpen ? 16 : 96}px` : `4px ${isTablet ? 20 : 32}px 20px`,
          display: "flex",
          flexDirection: "column",
          gap: GAP,
          minHeight: 0,
        }}
      >
        {view === "calendar" ? (
          <CalendarView />
        ) : view === "risk" ? (
          <RiskDashboard />
        ) : (
        <>
        {/* Title (left) + metrics cluster (right) */}
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 14 : 32, flexWrap: isDesktop ? "nowrap" : "wrap", flexDirection: isMobile ? "column" : "row" }}>
          <div style={{ maxWidth: isDesktop ? 560 : "100%", flexShrink: 0 }}>
            <motion.h1 initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: isMobile ? 30 : isTablet ? 40 : 50, fontWeight: 300, color: "#ffffff", letterSpacing: "-1px", margin: 0, lineHeight: 1.05 }}>
              {t("title")}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} style={{ fontSize: isMobile ? 14 : 19, fontWeight: 300, color: "rgba(255,255,255,0.85)", margin: "8px 0 0 0" }}>
              {t("subtitle")}
            </motion.p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 22 : 38, flexShrink: 0, flexWrap: "wrap" }}>
            <Metric value={hm ? hm[0].value : null} total={hm ? hm[0].value : 0} tint="#2e9e5f" label={t("kpi_total_projects")} onClick={() => openDrill(t("kpi_total_projects"), { scope: "epics" })} />
            <Metric value={hm ? hm[1].value : null} total={hm ? hm[0].value : 0} tint="#2e9e5f" label={t("kpi_completed")} onClick={() => openDrill(t("kpi_completed"), { scope: "epics", state: "completed" })} />
            <Metric value={hm ? hm[2].value : null} total={hm ? hm[0].value : 0} tint="#3b82c4" label={t("kpi_open")} onClick={() => openDrill(t("kpi_open"), { scope: "epics", state: "open" })} />
          </div>
        </div>

        {/* ============ ITSM SLA HEADLINE (only shows when SLA data is present) ============ */}
        {(() => {
          const sla = (data?.widgets as any)?.sla_summary;
          if (!sla || !sla.total_itsm_issues) return null;
          const card = { background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "14px 18px", display: "flex", flexDirection: "column" as const, gap: 4, minWidth: 150 };
          const rate = (v: number | null) => v == null ? "—" : `${v}%`;
          const tint = (v: number | null) => v == null ? "var(--muted)" : v >= 90 ? "#2d7a5f" : v >= 75 ? "#d4a84b" : "#e07a7a";
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: GAP }}>
              <div style={card}><span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>ITSM tickets</span><span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>{sla.total_itsm_issues}</span><span style={{ fontSize: "0.7rem", color: "var(--soft)" }}>{sla.distinct_request_types} request types · {sla.distinct_assignees} assignees</span></div>
              <div style={card}><span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Reaction SLA pass-rate</span><span style={{ fontSize: "1.5rem", fontWeight: 700, color: tint(sla.reaction.pass_rate_pct) }}>{rate(sla.reaction.pass_rate_pct)}</span><span style={{ fontSize: "0.7rem", color: "var(--soft)" }}>{sla.reaction.met} met · {sla.reaction.breached} breached · {sla.reaction.running} running</span></div>
              <div style={card}><span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Resolution SLA pass-rate</span><span style={{ fontSize: "1.5rem", fontWeight: 700, color: tint(sla.resolution.pass_rate_pct) }}>{rate(sla.resolution.pass_rate_pct)}</span><span style={{ fontSize: "0.7rem", color: "var(--soft)" }}>{sla.resolution.met} met · {sla.resolution.breached} breached · {sla.resolution.running} running</span></div>
              <div style={card}><span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Overall SLA pass-rate</span><span style={{ fontSize: "1.5rem", fontWeight: 700, color: tint(sla.overall_pass_rate_pct) }}>{rate(sla.overall_pass_rate_pct)}</span><span style={{ fontSize: "0.7rem", color: "var(--soft)" }}>combined reaction + resolution</span></div>
            </div>
          );
        })()}

        {/* ============ DESKTOP LAYOUT ============ */}
        {isDesktop && (
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 0.95fr", gap: GAP, flex: 1, minHeight: 0 }}>
            {/* Left region: Wellness|Stress (top) + Best|Healthcare (bottom) */}
            <div style={{ display: "flex", flexDirection: "column", gap: GAP, minHeight: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: GAP, flex: "1.5 1 0", minHeight: 0 }}>
                <div style={{ ...card }}><WellnessChart /></div>
                {stressCard()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.5fr", gap: GAP, flex: "1.2 1 0", minHeight: 0 }}>
                <div style={{ ...card }}><BestProjects /></div>
                <div style={{ ...card }}><HealthcareProviders /></div>
              </div>
            </div>

            {/* Right region: Patient Flow (shorter) + Temur (taller).
                When a popup opens, Temur detaches into a tall right-side dock that
                floats ABOVE the modal backdrop — so you can keep asking Temur to
                drive the dashboard while a popup is open. */}
            <div style={{ display: "flex", flexDirection: "column", gap: GAP, minHeight: 0 }}>
              <div style={{ ...card, flex: "1.26 1 0", minHeight: 0 }}><PatientFlowChart /></div>
              {popupOpen && temurMin ? (
                /* Collapsed: a small pill at the bottom-right that restores Temur
                   (so it never blocks a wide popup like the Kanban board) */
                <button
                  onClick={() => setTemurMinimized(false)}
                  title={t("temur_restore")}
                  style={{ position: "fixed", right: 18, bottom: 18, zIndex: 480, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, border: "none", cursor: "pointer", color: "#fff", background: "linear-gradient(165deg, #083A47 0%, #0c5563 50%, #4EB6A6 100%)", boxShadow: "0 10px 28px rgba(8,58,71,0.5)", fontSize: "0.8rem", fontWeight: 600 }}
                >
                  <MessageCircle size={16} /> Temur
                </button>
              ) : (
                <div
                  style={popupOpen
                    ? { position: "fixed", right: 18, top: 80, bottom: 18, width: "min(390px, 30vw)", zIndex: 480, borderRadius: 14, boxShadow: "0 24px 70px rgba(0,0,0,0.5)", overflow: "hidden" }
                    : { flex: "1.44 1 0", minHeight: 0 }}
                >
                  {popupOpen && (
                    /* Minimize the floating dock down to the corner pill */
                    <button
                      onClick={() => setTemurMinimized(true)}
                      title={t("temur_minimize")}
                      style={{ position: "absolute", top: 10, right: 10, zIndex: 2, width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.18)", color: "#fff", backdropFilter: "blur(6px)" }}
                    >
                      <ChevronDown size={16} />
                    </button>
                  )}
                  <AriaPanel />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ TABLET LAYOUT (2 columns) ============ */}
        {isTablet && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: GAP }}>
            {/* charts need a DEFINITE height (recharts absolute-inset pattern collapses to 0 with only min-height) */}
            <div style={{ ...card, height: 340, display: "flex", flexDirection: "column" }}><WellnessChart /></div>
            {stressCard({ height: 360 })}
            <div style={{ ...card, minHeight: 320 }}><PatientFlowChart /></div>
            <div style={{ ...card, minHeight: 320 }}><BestProjects /></div>
            <div style={{ ...card, minHeight: 300, gridColumn: "1 / 3" }}><HealthcareProviders /></div>
            <div style={{ minHeight: 360, gridColumn: "1 / 3" }}><AriaPanel /></div>
          </div>
        )}

        {/* ============ MOBILE LAYOUT (single column stack) ============ */}
        {isMobile && (
          <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            {/* charts need a DEFINITE height (recharts absolute-inset pattern collapses to 0 with only min-height) */}
            <div style={{ ...card, height: 340, display: "flex", flexDirection: "column" }}><WellnessChart /></div>
            {stressCard({ height: 420 })}
            <div style={{ ...card, minHeight: 340 }}><PatientFlowChart /></div>
            <div style={{ ...card, minHeight: 280 }}><BestProjects /></div>
            <div style={{ ...card, minHeight: 320 }}><HealthcareProviders /></div>
          </div>
        )}
        </>
        )}
      </main>

      {/* ============ MOBILE ARIA — floating round button + chat panel ============ */}
      {isMobile && (
        <>
          <AnimatePresence>
            {ariaOpen && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.96 }}
                transition={{ duration: 0.22 }}
                style={{ position: "fixed", left: 14, right: 14, bottom: 88, height: "68vh", zIndex: popupOpen ? 491 : 99, borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}
              >
                <AriaPanel />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => setAriaOpen(o => !o)}
            whileTap={{ scale: 0.92 }}
            style={{
              position: "fixed", bottom: 20, right: 20, width: 62, height: 62, borderRadius: "50%",
              background: "linear-gradient(165deg, #083A47 0%, #0c5563 50%, #4EB6A6 100%)",
              border: "none", cursor: "pointer", zIndex: popupOpen ? 501 : 100,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 10px 28px rgba(8,58,71,0.45)",
            }}
            aria-label="Aria"
          >
            {ariaOpen ? <X size={24} color="#fff" /> : <MessageCircle size={24} color="#fff" />}
          </motion.button>
        </>
      )}

      {/* Avatar manager (open from the user avatar) */}
      <AnimatePresence>
        {avatarMgr && <AvatarManager onClose={() => setAvatarMgr(false)} />}
      </AnimatePresence>

      {/* Data quality / field coverage (open from the gear) */}
      <AnimatePresence>
        {dqOpen && <DataQualityModal onClose={() => setDqOpen(false)} />}
      </AnimatePresence>

      {/* TTM analysis (open from the TTM panel expand button) */}
      <AnimatePresence>
        {ttmOpen && <TtmModal preset={ttmPreset} onClose={() => setTtmOpen(false)} />}
      </AnimatePresence>

      {/* Analyze a new task / report against the portfolio (open from Temur's + button) */}
      <AnimatePresence>
        {analyzeOpen && <AnalyzeModal onClose={() => setAnalyzeOpen(false)} />}
      </AnimatePresence>

      {/* New-epic QA: Temur flags unclear/incomplete new PMD epics + drafts author feedback */}
      <AnimatePresence>
        {eqOpen && <EpicQualityModal onClose={() => setEqOpen(false)} />}
      </AnimatePresence>

      {/* Drill-down popup: any number opens the underlying issue list */}
      <DrillDownHost />

      {/* Issue detail popup: full issue info in-app (no Jira access needed) */}
      <IssueDetailHost />

      {/* Celebrations: recently-closed epics + leaderboard changes (confetti) */}
      <Celebrations />
    </div>
  );
}
