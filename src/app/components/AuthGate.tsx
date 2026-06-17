import { useState, useEffect, type ReactNode } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useI18n, LANGS } from "../i18n";

const API = (import.meta as any).env?.VITE_API_URL ?? "";

/** Gates the whole app behind a login. Checks the session on mount; shows the
 *  login screen until authenticated, then renders the app. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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

  const screen = (inner: ReactNode) => (
    <div style={{ minHeight: "100vh", width: "100%", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "var(--font-sans)" }}>
      {inner}
    </div>
  );

  if (state === "loading") {
    return screen(<Loader2 size={26} color="#fff" className="animate-spin" />);
  }

  return screen(
    <form onSubmit={submit} style={{ width: 360, maxWidth: "94vw", background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
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
        <input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--divider)", background: "var(--surface2)", color: "var(--text)", fontSize: "0.85rem", outline: "none" }} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontSize: "0.7rem", color: "var(--soft)", fontWeight: 600 }}>{t("login_pass")}</span>
        <input value={p} onChange={(e) => setP(e.target.value)} type="password" autoComplete="current-password"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--divider)", background: "var(--surface2)", color: "var(--text)", fontSize: "0.85rem", outline: "none" }} />
      </label>

      {err && <div style={{ fontSize: "0.74rem", color: "#e0574f", fontWeight: 600 }}>{err}</div>}

      <button type="submit" disabled={busy || !u || !p}
        style={{ marginTop: 4, padding: "11px", borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer", background: "#0c5563", color: "#fff", fontSize: "0.85rem", fontWeight: 700, opacity: busy || !u || !p ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
  );
}
