import { useState, useRef, useEffect } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";

/** Collapsible service-desk selector (open/close button). Sits top-right,
 *  across from the page title. Replaces the inline chip row. */
export function ProjectDropdown() {
  const { project, projects, setProject } = usePortfolio();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!projects.length) return null;
  const total = projects.reduce((s, p) => s + p.count, 0);
  const items = [{ key: "all", count: total }, ...projects];
  const current = items.find(i => i.key === project) || items[0];
  const label = (k: string) => (k === "all" ? t("filter_all") : k);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, cursor: "pointer", border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.16)", color: "#fff", backdropFilter: "blur(10px)", fontSize: "0.82rem", fontWeight: 600, minWidth: 150 }}>
        <Layers size={15} />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 500, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("filter_service_desk")}</span>
          <span>{label(current.key)} · {current.count}</span>
        </span>
        <ChevronDown size={15} style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 200, background: "var(--card)", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.3)", border: "1px solid var(--divider)", zIndex: 60, padding: 6 }}>
          {items.map(it => {
            const active = project === it.key;
            return (
              <button key={it.key} onClick={() => { setProject(it.key); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", textAlign: "left", border: "none", cursor: "pointer", borderRadius: 8, padding: "8px 10px",
                  background: active ? "var(--surface2)" : "transparent", color: "var(--text)", fontSize: "0.82rem", fontWeight: active ? 700 : 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                onMouseLeave={e => (e.currentTarget.style.background = active ? "var(--surface2)" : "transparent")}>
                <span>{label(it.key)}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>{it.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
