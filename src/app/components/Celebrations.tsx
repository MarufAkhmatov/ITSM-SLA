import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";

type Cel = { id: string; emoji: string; title: string; subtitle: string; url?: string };
const PERIODS = ["week", "month", "quarter", "year"];
const COLORS = ["#3ad94f", "#4EB6A6", "#d4a84b", "#9b59b6", "#ffffff"];

function salute() {
  const end = Date.now() + 900;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS });
    confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 140, spread: 90, startVelocity: 45, origin: { y: 0.45 }, colors: COLORS });
}

export function Celebrations() {
  const { notifications, pmBoard, data } = usePortfolio();
  const { t, tf } = useI18n();
  const [queue, setQueue] = useState<Cel[]>([]);
  const [current, setCurrent] = useState<Cel | null>(null);
  const [enabled, setEnabled] = useState(() => localStorage.getItem("pn-cel-enabled") !== "0");
  const ran = useRef(false);

  // On-demand batch: celebrate the current winners (recent epics + top-3 PMs)
  // all at once — for "turn it on at the meeting and applaud everyone" mode.
  const celebrateNow = useCallback(async () => {
    const cels: Cel[] = [];
    const notif = await notifications();
    (notif.epics || []).slice(0, 3).forEach((e: any) =>
      cels.push({ id: "now-e" + e.key, emoji: "🏆", title: tf("cel_epic_done", { key: e.key }), subtitle: e.summary || "", url: e.url }));
    const all = await pmBoard("all");
    (all.rows || []).slice(0, 3).forEach((r: any) =>
      cels.push({
        id: "now-l" + r.pm,
        emoji: r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉",
        title: tf("cel_congrats", { pm: r.pm }),
        subtitle: tf("cel_top_sub", { projects: r.projects_completed, tasks: r.tasks_completed }),
      }));
    setQueue(cels);
  }, [notifications, pmBoard, tf]);

  // Header toggle: turn celebrations on/off; turning ON fires the batch now.
  useEffect(() => {
    const h = (e: Event) => {
      const on = (e as CustomEvent).detail?.enabled;
      setEnabled(on);
      if (on) celebrateNow();
      else { setQueue([]); setCurrent(null); }
    };
    window.addEventListener("pn-cel-toggle", h);
    return () => window.removeEventListener("pn-cel-toggle", h);
  }, [celebrateNow]);

  useEffect(() => {
    if (ran.current || !data || !enabled) return;
    ran.current = true;
    (async () => {
      const cels: Cel[] = [];
      const firstTime = !localStorage.getItem("pn-cel-init");

      // ---- #7: recently closed epics ----
      const notif = await notifications();
      const epics: any[] = notif.epics || [];
      const seen = new Set(JSON.parse(localStorage.getItem("pn-seen-epics") || "[]"));
      if (!firstTime) {
        epics.filter((e) => !seen.has(e.key)).slice(0, 3).forEach((e) =>
          cels.push({ id: "e" + e.key, emoji: "🏆", title: tf("cel_epic_done", { key: e.key }), subtitle: e.summary || "", url: e.url }));
      }
      localStorage.setItem("pn-seen-epics", JSON.stringify(epics.map((e) => e.key)));

      // ---- #4: leaderboard top-3 changes per period ----
      for (const period of PERIODS) {
        const r = await pmBoard(period);
        const top3: any[] = (r.rows || []).slice(0, 3);
        const old = JSON.parse(localStorage.getItem("pn-top-" + period) || "null");
        if (old && !firstTime) {
          const oldNames = old.map((x: any) => x.pm);
          top3.forEach((row) => {
            if (oldNames.indexOf(row.pm) !== row.rank - 1) {
              cels.push({
                id: `l${period}${row.pm}`, emoji: "🎉",
                title: tf("cel_congrats", { pm: row.pm }),
                subtitle: tf("cel_place", { rank: row.rank, period: t("per_" + period) }),
              });
            }
          });
        }
        localStorage.setItem("pn-top-" + period, JSON.stringify(top3.map((x: any) => ({ pm: x.pm, rank: x.rank }))));
      }

      // ---- first run: one welcome celebration so the feature is visible ----
      if (firstTime) {
        const all = await pmBoard("all");
        const top = (all.rows || [])[0];
        if (top) cels.push({
          id: "welcome", emoji: "🎉", title: tf("cel_top", { pm: top.pm }),
          subtitle: tf("cel_top_sub", { projects: top.projects_completed, tasks: top.tasks_completed }),
        });
        localStorage.setItem("pn-cel-init", "1");
      }

      setQueue(cels);
    })();
  }, [data, notifications, pmBoard, enabled, t, tf]);

  useEffect(() => {
    if (!current && queue.length) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, current]);

  useEffect(() => {
    if (current) {
      salute();
      const tm = setTimeout(() => setCurrent(null), 4400);
      return () => clearTimeout(tm);
    }
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setCurrent(null)}
          style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <motion.div
            initial={{ scale: 0.8, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 18 }}
            transition={{ type: "spring", stiffness: 240, damping: 17 }}
            style={{ background: "var(--card)", borderRadius: 22, padding: "30px 36px", boxShadow: "0 30px 90px rgba(0,0,0,0.45)", textAlign: "center", maxWidth: 440, border: "1px solid var(--divider)" }}
          >
            <div style={{ fontSize: "3.2rem", lineHeight: 1, marginBottom: 12 }}>{current.emoji}</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{current.title}</div>
            <div style={{ fontSize: "0.85rem", color: "var(--soft)", lineHeight: 1.4 }}>{current.subtitle}</div>
            {current.url && (
              <a href={current.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                 style={{ display: "inline-block", marginTop: 12, fontSize: "0.78rem", fontWeight: 600, color: "#2d7a5f", textDecoration: "none" }}>
                {t("cel_open_jira")}
              </a>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
