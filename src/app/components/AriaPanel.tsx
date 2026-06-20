import { useState, useRef, useEffect } from "react";
import { Send, Plus, Mic, Volume2, VolumeX, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { usePopupOpen, usePageContext } from "../popup";

const suggestionKeys = ["suggestion1", "suggestion2"];
const VOICE_BCP: Record<string, string> = { en: "en-US", ru: "ru-RU", uz: "uz-UZ" };

// Prefer a deep male voice ("Jarvis"-like) per language.
const MALE_PREF: Record<string, string[]> = {
  en: ["david", "daniel", "alex", "aaron", "fred", "arthur", "gordon", "oliver", "rishi", "mark", "george", "guy"],
  ru: ["pavel", "yuri", "dmitr"],
};
const MALE_HINT = /(david|mark|george|guy|ryan|daniel|aaron|fred|alex|arthur|gordon|oliver|rishi|pavel|yuri|dmitr|james|john|paul|\bmale\b|мужск|#male)/i;
const FEMALE_HINT = /(zira|irina|helena|hazel|susan|catherine|samantha|karen|moira|tessa|martha|nicky|allison|ava|zoe|milena|yelena|elena|victoria|aria|jenny|linda|female|женск|#female)/i;

// Interrupt words: stop Temur talking and listen for the next command (EN/RU/UZ).
const STOP_WORDS = ["stop", "стоп", "хватит", "прекрат", "замолч", "тихо", "to'xta", "to`xta", "toxta", "to xta", "bas", "jim"];
const isStop = (low: string) => STOP_WORDS.some(w => low.includes(w));

function pickMaleVoice(bcp: string): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  const two = bcp.slice(0, 2).toLowerCase();
  const inLang = window.speechSynthesis.getVoices().filter(v => (v.lang || "").toLowerCase().startsWith(two));
  if (!inLang.length) return null;
  for (const p of (MALE_PREF[two] || [])) {
    const hit = inLang.find(v => v.name.toLowerCase().includes(p));
    if (hit) return hit;
  }
  const male = inLang.find(v => MALE_HINT.test(v.name) && !FEMALE_HINT.test(v.name));
  if (male) return male;
  const nonFemale = inLang.find(v => !FEMALE_HINT.test(v.name));
  return nonFemale || inLang[0];
}

export function AriaPanel() {
  const { t, tf, lang } = useI18n();
  const { ask } = usePortfolio();
  const popupOpen = usePopupOpen();
  const pageCtx = usePageContext();
  const [pendingQ, setPendingQ] = useState<string | null>(null);   // question awaiting page/global scope choice
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOut, setVoiceOut] = useState(() => localStorage.getItem("pn-voice-out") === "1");
  const recRef = useRef<any>(null);
  const [messages, setMessages] = useState(() => [
    { role: "assistant", text: t("aria_greeting") },
  ]);

  const activeRef = useRef(false);   // wake-mode active (for auto-restart)
  const armedRef = useRef(false);    // heard "Temur", waiting for the command
  const armTimerRef = useRef<any>(null);

  const arm = () => {
    armedRef.current = true;
    clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => { armedRef.current = false; }, 12000);
  };

  const stopSpeaking = () => {
    try { window.speechSynthesis?.cancel(); } catch { /* */ }
    setSpeaking(false);
    if (listening) arm();   // ready for the next command right away
  };

  const speak = (text: string) => {
    if (!voiceOut || !text || !window.speechSynthesis) return;
    // No Uzbek system voice — skip speaking UZ for now (per request).
    if (lang === "uz") return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const bcp = VOICE_BCP[lang] || "en-US";
      u.lang = bcp;
      const v = pickMaleVoice(bcp);
      if (v) u.voice = v;
      u.pitch = 0.85;  // deep, Jarvis-like
      u.rate = 1.12;   // brisk, natural (not sluggish)
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  const toggleVoiceOut = () => {
    const n = !voiceOut;
    setVoiceOut(n);
    localStorage.setItem("pn-voice-out", n ? "1" : "0");
    if (!n) window.speechSynthesis?.cancel();
  };

  // Continuous wake-word listening: say "Temur ..." to give a command.
  const startWake = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setMessages(prev => [...prev, { role: "assistant", text: t("voice_unsupported") }]); return false; }
    try {
      const rec = new SR();
      rec.lang = VOICE_BCP[lang] || "en-US";
      rec.continuous = true;
      rec.interimResults = true;     // catch "stop" fast, even mid-word
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const res = e.results[e.results.length - 1];
        const raw = (res[0].transcript || "").trim();
        const low = raw.toLowerCase();
        const speaking = !!window.speechSynthesis?.speaking;

        // "stop" — interrupt speech immediately (even on interim) and re-arm.
        if (isStop(low)) {
          window.speechSynthesis?.cancel();
          arm();
          return;
        }
        if (!res.isFinal) return;
        // Ignore the rest of the audio captured while Temur is speaking
        // (so Temur doesn't trigger itself); only "stop" gets through above.
        if (speaking) return;

        // Wake word "Amir" (RU "Амир") — tolerate common ASR variants.
        const m = low.match(/(?:amir|am[ie]r|amer|emir|ам[ие]р|амур)[\s,:!.]*(.*)/);
        if (m) {
          const cmd = raw.slice(raw.length - m[1].length).trim();
          if (cmd) { armedRef.current = false; send(cmd); }
          else { arm(); speak(t("voice_listening")); }
        } else if (armedRef.current) {
          armedRef.current = false;
          send(raw);
        }
      };
      rec.onerror = () => {};
      rec.onend = () => { if (activeRef.current) { try { rec.start(); } catch { /* */ } } };
      recRef.current = rec;
      activeRef.current = true;
      rec.start();
      return true;
    } catch { return false; }
  };

  const stopWake = () => {
    activeRef.current = false;
    armedRef.current = false;
    clearTimeout(armTimerRef.current);
    window.speechSynthesis?.cancel();
    try { recRef.current?.stop(); } catch { /* */ }
    setListening(false);
  };

  const toggleMic = () => {
    if (listening) { stopWake(); return; }
    if (startWake()) setListening(true);
  };

  // Restart the wake recognizer with the new language when the UI language changes.
  useEffect(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    try { recRef.current?.stop(); } catch { /* */ }
    const id = setTimeout(() => { if (startWake()) setListening(true); }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Prime the TTS voice list (loads async) so the right male voice is ready
  // on the very first reply.
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
    }
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => {
    activeRef.current = false;
    try { recRef.current?.stop(); } catch { /* */ }
    window.speechSynthesis?.cancel();
  }, []);

  const runAction = (a: any) => {
    if (!a || !a.type) return;
    if (a.type === "open_ttm") {
      window.dispatchEvent(new CustomEvent("pn-open-ttm", { detail: a.params }));
    } else if (a.type === "drill") {
      const titleMap: Record<string, string> = {
        open: t("kpi_open"), completed: t("kpi_completed"), declined: t("pf_declined"),
      };
      window.dispatchEvent(new CustomEvent("pn-drill", {
        detail: { title: titleMap[a.state] || "", params: { scope: a.scope || "epics", state: a.state } },
      }));
    } else if (a.type === "open_issue") {
      window.dispatchEvent(new CustomEvent("pn-issue", { detail: { key: a.params.key } }));
    } else if (a.type === "open_dq") {
      window.dispatchEvent(new CustomEvent("pn-open-dq"));
    }
  };

  const clean = (s: string) => (s || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*/g, "")
    .trim();

  // Run the actual query (optionally scoped to the open popup's on-screen data).
  const runQuery = async (q: string, opts?: { scope?: string; context?: string }) => {
    setBusy(true);
    try {
      const res = await ask(q, lang, opts);
      const ans = clean(res?.answer || t("aria_reply"));
      setMessages(prev => [...prev, { role: "assistant", text: ans }]);
      if (res?.action) runAction(res.action);
      speak(ans);
    } finally {
      setBusy(false);
    }
  };

  const send = async (override?: string) => {
    const q = (override ?? input).trim();
    if (!q || busy || pendingQ) return;
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setInput("");
    // If a popup with its own data is open, first ask whether to answer from THIS
    // page or search the whole portfolio (so Temur spends effort on the right scope).
    if (popupOpen && pageCtx) {
      setPendingQ(q);
      setMessages(prev => [...prev, { role: "assistant", text: tf("temur_scope_prompt", { page: pageCtx.title }) }]);
      return;
    }
    await runQuery(q);
  };

  const chooseScope = (scope: "page" | "global") => {
    const q = pendingQ;
    setPendingQ(null);
    if (!q) return;
    runQuery(q, scope === "page" && pageCtx ? { scope: "page", context: pageCtx.text } : undefined);
  };

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(165deg, #083A47 0%, #0c5563 45%, #4EB6A6 100%)",
        borderRadius: 14,
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
        height: "100%",
      }}
    >
      {/* Compact header (no oversized blob — keeps the chat area tall) */}
      <div style={{ position: "relative", overflow: "hidden", flexShrink: 0, padding: "12px 16px 8px" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 70% 30%, rgba(155,89,182,0.30) 0%, rgba(45,122,95,0.20) 45%, transparent 75%)",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }}>Amir</div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)" }}>{t("aria_sub")}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4 pt-1 flex-1" style={{ minHeight: 0 }}>
        {/* Suggestion chips */}
        <div className="flex gap-2 flex-wrap">
          {suggestionKeys.map(s => (
            <button
              key={s}
              onClick={() => setInput(t(s))}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: "0.68rem",
                color: "rgba(255,255,255,0.85)",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              {t(s)}
            </button>
          ))}
        </div>

        {/* Stop speaking — always-reliable interrupt while Temur talks */}
        {speaking && (
          <button
            onClick={stopSpeaking}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              width: "100%", padding: "8px", borderRadius: 10,
              background: "rgba(255,80,80,0.22)", border: "1px solid rgba(255,80,80,0.55)",
              color: "#ffdede", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
            }}
          >
            <Square size={11} fill="#ffdede" /> {t("voice_stop")}
          </button>
        )}

        {/* Messages — grows to fill the panel (chat field expands upward) */}
        <div style={{ flex: 1, minHeight: 80, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          <AnimatePresence>
            {messages.slice(1).map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "rgba(155,89,182,0.5)" : "rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  padding: "6px 10px",
                  fontSize: "0.68rem",
                  color: "rgba(255,255,255,0.9)",
                  maxWidth: "85%",
                  lineHeight: 1.4,
                }}
              >
                {m.text}
              </motion.div>
            ))}
            {busy && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ alignSelf: "flex-start", background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 10px", fontSize: "0.68rem", color: "rgba(255,255,255,0.7)", maxWidth: "85%" }}
              >
                {t("id_thinking")}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Page vs Global scope choice (shown while a popup with data is open) */}
        {pendingQ && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => chooseScope("page")} style={{ flex: 1, minWidth: 110, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.16)", color: "#fff", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
              📄 {t("temur_scope_page")}
            </button>
            <button onClick={() => chooseScope("global")} style={{ flex: 1, minWidth: 110, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.9)", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
              🌐 {t("temur_scope_global")}
            </button>
          </div>
        )}

        {/* Credits */}
        <div className="flex items-center justify-between">
          <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>{t("credits")}</span>
          <button style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            padding: "3px 10px",
            fontSize: "0.65rem",
            color: "rgba(255,255,255,0.8)",
            cursor: "pointer",
          }}>
            {t("upgrade")}
          </button>
        </div>

        {/* Input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "8px 12px",
          border: "1px solid rgba(255,255,255,0.15)",
        }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("pn-open-analyze"))}
            title={t("tip_analyze")}
            style={{ background: "none", border: "none", cursor: "pointer" }}>
            <Plus size={14} color="rgba(255,255,255,0.5)" />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder={t("ask_anything")}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: "0.75rem", color: "rgba(255,255,255,0.85)",
              fontFamily: "Montserrat, sans-serif",
            }}
          />
          <button onClick={toggleVoiceOut} title={voiceOut ? t("voice_on") : t("voice_off")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            {voiceOut ? <Volume2 size={14} color="#3ad94f" /> : <VolumeX size={14} color="rgba(255,255,255,0.5)" />}
          </button>
          <button onClick={toggleMic} title={listening ? t("voice_listening") : t("voice_speak")} className={listening ? "animate-pulse" : ""} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <Mic size={14} color={listening ? "#ff6b6b" : "rgba(255,255,255,0.5)"} />
          </button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={send}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#1a2030",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Send size={12} color="#ffffff" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
