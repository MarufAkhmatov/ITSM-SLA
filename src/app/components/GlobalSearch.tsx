import { useState, useRef, useEffect } from "react";
import { Search, X, Layers, User, Ticket } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { openIssue } from "../issue";

/** Global, typo-tolerant search over IT services, staff and issues.
 *  Backed by /api/search (fuzzy). Debounced; results in a dropdown. */
export function GlobalSearch({ width = 210 }: { width?: number }) {
  const { search } = usePortfolio();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setRes(null); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const r = await search(q.trim());
      setRes(r); setLoading(false); setOpen(true);
    }, 220);
    return () => timer.current && clearTimeout(timer.current);
  }, [q, search]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const total = res ? (res.request_types?.length || 0) + (res.staff?.length || 0) + (res.issues?.length || 0) : 0;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 999, padding: "9px 16px", width, background: "var(--glass-bg, rgba(255,255,255,0.14))", border: "1px solid var(--glass-border, rgba(255,255,255,0.2))", backdropFilter: "blur(14px)" }}>
        <Search size={15} color="var(--header-icon, #fff)" />
        <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => res && setOpen(true)} placeholder={t("search")}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: "0.82rem", color: "var(--search-text, #fff)", width: "100%" }} />
        {q && <button onClick={() => { setQ(""); setRes(null); }} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 0 }}><X size={13} color="var(--header-icon, #fff)" /></button>}
      </div>

      {open && res && (
        <div className="pn-scroll" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, maxWidth: "92vw", maxHeight: 460, overflowY: "auto", background: "var(--card)", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.35)", border: "1px solid var(--divider)", zIndex: 200, padding: 8 }}>
          {loading && <div style={{ padding: 14, fontSize: "0.76rem", color: "var(--muted)" }}>…</div>}
          {!loading && total === 0 && <div style={{ padding: 14, fontSize: "0.78rem", color: "var(--muted)" }}>{t("search_none")}</div>}

          {res.request_types?.length > 0 && (
            <Group icon={<Layers size={13} color="#0c5563" />} label={t("nav_usage")}>
              {res.request_types.map((x: any) => (
                <Item key={x.name} onClick={() => setOpen(false)} title={x.name} sub={`${x.count} ${t("up_issues")}`} score={x.score} />
              ))}
            </Group>
          )}
          {res.staff?.length > 0 && (
            <Group icon={<User size={13} color="#0c5563" />} label={t("res_title")}>
              {res.staff.map((x: any) => (
                <Item key={x.name} onClick={() => setOpen(false)} title={x.name} sub={`${x.count} ${t("up_issues")}`} score={x.score} />
              ))}
            </Group>
          )}
          {res.issues?.length > 0 && (
            <Group icon={<Ticket size={13} color="#0c5563" />} label={t("up_issues")}>
              {res.issues.map((x: any) => (
                <Item key={x.key} onClick={() => { openIssue(x.key); setOpen(false); }} title={`${x.key} · ${x.summary || ""}`} sub={`${x.customer_request_type || ""}${x.assignee ? " · " + x.assignee : ""}`} score={x.score} clickable />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px 2px", fontSize: "0.64rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function Item({ title, sub, score, onClick, clickable }: { title: string; sub?: string; score?: number; onClick?: () => void; clickable?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", flexDirection: "column", gap: 1, width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: clickable ? "pointer" : "default", borderRadius: 8, padding: "6px 8px" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <span style={{ fontSize: "0.76rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 330 }}>{title}</span>
      {sub && <span style={{ fontSize: "0.66rem", color: "var(--soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 330 }}>{sub}</span>}
    </button>
  );
}
