import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const LIGHT = {
  bg: "linear-gradient(180deg, #7A9AA8 0%, #B7CFD7 50%, #DCECEF 100%)",
  card: "#ffffff",
  text: "#1a2030",
  soft: "#6b7a8d",
  muted: "#9aa5b4",
  divider: "#e4eaef",
  surface2: "#eef1f4",
  shadow: "0 8px 24px rgba(0,0,0,0.06)",
  // header / menu bar glass
  glassBg: "rgba(255,255,255,0.4)",
  glassBg2: "rgba(255,255,255,0.3)",
  glassBorder: "rgba(255,255,255,0.5)",
  glassShadow: "0 8px 26px rgba(20,40,55,0.10), inset 0 1px 1px rgba(255,255,255,0.6)",
  headerIcon: "#3f5560",
  searchText: "#1a2030",
  // active menu buttons
  activeBg: "#ffffff",
  activeText: "#1a2030",
  activeGlow: "0 3px 12px rgba(20,40,55,0.12)",
  activeChip: "#e9f2f0",
  activeIcon: "#0c5563",
};

export const DARK = {
  bg: "linear-gradient(180deg, #0d141d 0%, #121b27 50%, #16212d 100%)",
  card: "#1a2230",
  text: "#e8eef6",
  soft: "#9aa7b6",
  muted: "#76828f",
  divider: "#2a3441",
  surface2: "#222d3b",
  shadow: "0 10px 28px rgba(0,0,0,0.45)",
  // header / menu bar glass
  glassBg: "rgba(34,45,60,0.55)",
  glassBg2: "rgba(34,45,60,0.5)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassShadow: "0 8px 26px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.05)",
  headerIcon: "#aeb9c6",
  searchText: "#e8eef6",
  // active menu buttons — glass kept, glowing in the IPAK logo green (#3ad94f)
  activeBg: "rgba(58,217,79,0.20)",
  activeText: "#c7ffce",
  activeGlow: "0 0 18px rgba(58,217,79,0.55), inset 0 0 0 1px rgba(58,217,79,0.55)",
  activeChip: "rgba(255,255,255,0.14)",
  activeIcon: "#3ad94f",
};

type Mode = "light" | "dark";
type Tokens = typeof LIGHT;

const Ctx = createContext<{ mode: Mode; toggle: () => void; tokens: Tokens }>({
  mode: "light", toggle: () => {}, tokens: LIGHT,
});

function applyVars(tokens: Tokens, mode: Mode) {
  if (typeof document === "undefined") return;
  const r = document.documentElement.style;
  r.setProperty("--bg", tokens.bg);
  r.setProperty("--card", tokens.card);
  r.setProperty("--text", tokens.text);
  r.setProperty("--soft", tokens.soft);
  r.setProperty("--muted", tokens.muted);
  r.setProperty("--divider", tokens.divider);
  r.setProperty("--surface2", tokens.surface2);
  r.setProperty("--shadow", tokens.shadow);
  r.setProperty("--glass-bg", tokens.glassBg);
  r.setProperty("--glass-bg2", tokens.glassBg2);
  r.setProperty("--glass-border", tokens.glassBorder);
  r.setProperty("--glass-shadow", tokens.glassShadow);
  r.setProperty("--header-icon", tokens.headerIcon);
  r.setProperty("--search-text", tokens.searchText);
  r.setProperty("--active-bg", tokens.activeBg);
  r.setProperty("--active-text", tokens.activeText);
  r.setProperty("--active-glow", tokens.activeGlow);
  r.setProperty("--active-chip", tokens.activeChip);
  r.setProperty("--active-icon", tokens.activeIcon);
  document.documentElement.dataset.theme = mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("pn-theme") as Mode | null;
      if (saved) return saved;
    }
    return "light";
  });
  const tokens = mode === "dark" ? DARK : LIGHT;

  // apply synchronously on first render to avoid a flash
  applyVars(tokens, mode);

  useEffect(() => {
    applyVars(tokens, mode);
    if (typeof localStorage !== "undefined") localStorage.setItem("pn-theme", mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"));
  return <Ctx.Provider value={{ mode, toggle, tokens }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
