import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { jiraUrl } from "../jira";

const glassCircle: React.CSSProperties = {
  background: "var(--glass-bg2)",
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--glass-shadow)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

const SEEN_KEY = "pn-seen-notif";

export function NotificationsBell() {
  const { notifications, data } = usePortfolio();
  const { t } = useI18n();
  const base = data?.meta?.jira_base;
  const [open, setOpen] = useState(false);
  const [epics, setEpics] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [unseen, setUnseen] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const n = await notifications();
    const e = n.epics || [], t = n.tasks || [];
    setEpics(e); setTasks(t);
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
    setUnseen([...e, ...t].filter((x) => !seen.has(x.key)).length);
  }, [notifications]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...epics, ...tasks].map((x) => x.key)));
      setUnseen(0);
    }
  };

  const all = [
    ...epics.map((e) => ({ ...e, kind: "Epic" })),
    ...tasks.map((t) => ({ ...t, kind: t.type })),
  ];

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        title={t("tip_recent_closures")}
        style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", color: "var(--header-icon)", ...glassCircle }}
      >
        <Bell size={17} />
        {unseen > 0 && (
          <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "#e53e3e", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--bg)" }}>
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            style={{ position: "absolute", top: 50, right: 0, width: 320, maxHeight: 420, background: "var(--card)", borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,0.25)", border: "1px solid var(--divider)", zIndex: 120, overflow: "hidden", display: "flex", flexDirection: "column" }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--divider)", fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>
              {t("nb_recently_closed")}
            </div>
            <div className="pn-scroll" style={{ overflowY: "auto", padding: "6px 6px" }}>
              {all.length === 0 && (
                <div style={{ padding: 16, fontSize: "0.78rem", color: "var(--muted)" }}>{t("nb_none")}</div>
              )}
              {all.map((x) => (
                <div key={x.key} className="flex items-start gap-2" style={{ padding: "9px 10px", borderRadius: 9 }}>
                  <CheckCircle2 size={15} color="#2d7a5f" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--text)" }}>
                      <a className="jira-link" href={jiraUrl(x.key, x.url, base)} target="_blank" rel="noopener noreferrer"><b>{x.key}</b></a> <span style={{ fontSize: "0.64rem", color: "#2d7a5f" }}>{x.kind}</span>
                    </div>
                    <a className="jira-link" href={jiraUrl(x.key, x.url, base)} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.68rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }} title={x.summary}>{x.summary}</a>
                    <div style={{ fontSize: "0.62rem", color: "var(--soft)" }}>{x.pm} · {x.resolved}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
