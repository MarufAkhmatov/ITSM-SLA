import { useState, useEffect, type ReactNode } from "react";
import { ShieldCheck, Loader2, Smartphone, User, Lock } from "lucide-react";
import { useI18n, LANGS } from "../i18n";

const API = (import.meta as any).env?.VITE_API_URL ?? "";

/** Gates the whole app behind a login. Two-pane animated screen: a playful
 *  animated brand panel (left) and, on the right, the login form (top) + a QR
 *  to open the app on a phone on the same Wi-Fi (bottom). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < 860);

  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 860);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  useEffect(() => {
    fetch(`${API}/api/me`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => setState(j.authed ? "in" : "out"))
      .catch(() => setState("out"));
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !u || !p) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/api/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ username: u, password: p }),
      });
      const j = await r.json();
      if (j.ok) setState("in");
      else setErr(t("login_error"));
    } catch {
      setErr(t("login_error"));
    } finally {
      setBusy(false);
    }
  };

  if (state === "in") return <>{children}</>;

  // QR points at the current origin — the launcher opens the app via the LAN IP,
  // so this is the address a phone on the same Wi-Fi can reach.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=6&data=${encodeURIComponent(origin)}`;

  const wrap = (inner: ReactNode) => (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", fontFamily: "var(--font-sans)", overflow: "hidden" }}>
      <style>{KEYFRAMES}</style>
      {inner}
    </div>
  );

  if (state === "loading") {
    return wrap(<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND_BG }}><Loader2 size={26} color="#fff" className="animate-spin" /></div>);
  }

  const brandPane = (
    <div style={{ flex: 1, position: "relative", overflow: "hidden", background: BRAND_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* floating cute orbs */}
      <span style={orb("#4EB6A6", 220, "8%", "12%", "0s")} />
      <span style={orb("#0c5563", 300, "60%", "70%", "1.2s")} />
      <span style={orb("#9b59b6", 150, "75%", "12%", "2.1s")} />
      <span style={orb("#2d7a5f", 120, "20%", "78%", "0.6s")} />

      {/* mascot + brand */}
      <div style={{ position: "relative", textAlign: "center", color: "#fff", padding: 24 }}>
        <div style={{ animation: "slaBob 3.2s ease-in-out infinite" }}>
          <Mascot />
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "1px", marginTop: 18 }}>SLANEST</div>
        <div style={{ fontSize: 15, fontWeight: 300, opacity: 0.9, marginTop: 8, maxWidth: 320 }}>{t("login_subtitle")}</div>
      </div>
    </div>
  );

  const rightPane = (
    <div style={{ width: narrow ? "100%" : 420, flexShrink: 0, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, overflowY: "auto" }}>
      {/* login form */}
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 340, background: "var(--card)", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.28)", padding: 26, display: "flex", flexDirection: "column", gap: 13, animation: "slaUp 0.5s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: "#0c556318", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={20} color="#0c5563" />
          </span>
          <div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)" }}>{t("login_title")}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{t("login_subtitle")}</div>
          </div>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: "0.7rem", color: "var(--soft)", fontWeight: 600 }}>{t("login_user")}</span>
          <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <User size={15} color="#6b7a8d" style={{ position: "absolute", left: 11 }} />
            <input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username"
              style={{ ...inp }} />
          </span>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: "0.7rem", color: "var(--soft)", fontWeight: 600 }}>{t("login_pass")}</span>
          <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Lock size={15} color="#6b7a8d" style={{ position: "absolute", left: 11 }} />
            <input value={p} onChange={(e) => setP(e.target.value)} type="password" autoComplete="current-password"
              style={{ ...inp }} />
          </span>
        </label>

        {err && <div style={{ fontSize: "0.74rem", color: "#e0574f", fontWeight: 600, animation: "slaShake 0.4s" }}>{err}</div>}

        <button type="submit" disabled={busy || !u || !p}
          style={{ marginTop: 4, padding: "11px", borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer", background: "linear-gradient(135deg,#0c5563,#4EB6A6)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, opacity: busy || !u || !p ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {busy && <Loader2 size={15} className="animate-spin" />}
          {busy ? t("login_signing") : t("login_submit")}
        </button>

        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 2 }}>
          {LANGS.map((l) => (
            <button type="button" key={l.code} onClick={() => setLang(l.code)}
              style={{ padding: "3px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.7rem",
                fontWeight: lang === l.code ? 700 : 400, background: lang === l.code ? "#0c5563" : "var(--surface2)", color: lang === l.code ? "#fff" : "var(--soft)" }}>
              {l.label}
            </button>
          ))}
        </div>
      </form>

      {/* QR — open on phone (same Wi-Fi) */}
      {!isLocal && (
        <div style={{ width: "100%", maxWidth: 340, background: "var(--card)", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.28)", padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: "slaUp 0.7s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text)", fontWeight: 600, fontSize: "0.82rem" }}>
            <Smartphone size={15} color="#0c5563" /> {t("login_qr_title")}
          </div>
          <img src={qrSrc} alt="QR" width={150} height={150}
            style={{ borderRadius: 12, background: "#fff", padding: 8 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <a href={origin} style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0c5563", textDecoration: "none" }}>{origin.replace(/^https?:\/\//, "")}</a>
          <span style={{ fontSize: "0.66rem", color: "var(--muted)", textAlign: "center" }}>{t("login_qr_hint")}</span>
        </div>
      )}
    </div>
  );

  return wrap(<>{!narrow && brandPane}{rightPane}</>);
}

const BRAND_BG = "radial-gradient(ellipse at 30% 20%, #0f6475 0%, #083a47 55%, #05222b 100%)";
const inp: React.CSSProperties = {
  padding: "10px 12px 10px 34px", borderRadius: 10, border: "1px solid var(--divider)",
  background: "var(--surface2)", color: "var(--text)", fontSize: "0.85rem", outline: "none", width: "100%",
};

function orb(color: string, size: number, top: string, left: string, delay: string): React.CSSProperties {
  return {
    position: "absolute", top, left, width: size, height: size, borderRadius: "50%",
    background: color, opacity: 0.22, filter: "blur(38px)",
    animation: `slaFloat 7s ease-in-out ${delay} infinite`,
  };
}

/** A cute blinking SLANEST mascot (rounded "service-desk" face). */
function Mascot() {
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 14px 30px rgba(0,0,0,0.35))" }}>
      <rect x="20" y="26" width="110" height="98" rx="28" fill="#ffffff" />
      <rect x="20" y="26" width="110" height="98" rx="28" fill="url(#mg)" opacity="0.18" />
      {/* antenna */}
      <line x1="75" y1="26" x2="75" y2="10" stroke="#4EB6A6" strokeWidth="4" strokeLinecap="round" />
      <circle cx="75" cy="8" r="6" fill="#4EB6A6" style={{ animation: "slaPulse 1.8s ease-in-out infinite" }} />
      {/* eyes (blink) */}
      <g style={{ animation: "slaBlink 4s infinite" }}>
        <circle cx="55" cy="68" r="9" fill="#0c5563" />
        <circle cx="95" cy="68" r="9" fill="#0c5563" />
      </g>
      {/* cheeks */}
      <circle cx="45" cy="88" r="6" fill="#4EB6A6" opacity="0.5" />
      <circle cx="105" cy="88" r="6" fill="#4EB6A6" opacity="0.5" />
      {/* smile */}
      <path d="M58 92 Q75 108 92 92" stroke="#0c5563" strokeWidth="5" strokeLinecap="round" fill="none" />
      <defs>
        <linearGradient id="mg" x1="20" y1="26" x2="130" y2="124"><stop stopColor="#4EB6A6" /><stop offset="1" stopColor="#0c5563" /></linearGradient>
      </defs>
    </svg>
  );
}

const KEYFRAMES = `
@keyframes slaFloat { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,-26px)} }
@keyframes slaBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
@keyframes slaPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:.5} }
@keyframes slaBlink { 0%,92%,100%{transform:scaleY(1)} 96%{transform:scaleY(0.1)} }
@keyframes slaUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes slaShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
`;
