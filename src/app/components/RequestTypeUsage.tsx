import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Search } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";

type Row = {
  name: string; count: number; share_pct: number;
  done: number; in_progress: number; todo: number; assignee_count: number;
  reaction_pass_rate_pct: number | null; resolution_pass_rate_pct: number | null;
};

const rateColor = (v: number | null) => (v == null ? "var(--muted)" : v >= 90 ? "#2d7a5f" : v >= 75 ? "#d4a84b" : "#e07a7a");

export function RequestTypeUsage() {
  const { data } = usePortfolio();
  const { t } = useI18n();
  const usage = (data?.widgets as any)?.request_type_usage;
  const [q, setQ] = useState("");

  const all: Row[] = usage?.all || [];
  const most: Row[] = usage?.most_used || [];
  const least: Row[] = usage?.least_used || [];
  const maxCount = most[0]?.count || 1;

  const filtered = useMemo(() => all.filter(r => r.name.toLowerCase().includes(q.toLowerCase())), [all, q]);

  if (!usage || !all.length) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>{t("res_no_itsm")}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
      {/* title */}
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 300, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>{t("usage_title")}</h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>{t("usage_subtitle")}</p>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: GAP }}>
        <Kpi label={t("usage_total_types")} value={usage.total_types} />
        <Kpi label={t("usage_total_tickets")} value={usage.total_tickets} />
        <Kpi label={t("usage_top_share")} value={`${most[0]?.share_pct ?? 0}%`} sub={most[0]?.name} />
        <Kpi label={t("usage_single_use")} value={all.filter(r => r.count === 1).length} sub={t("usage_single_use_sub")} />
      </div>

      {/* most + least used, side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: GAP }}>
        <Panel title={t("usage_most")} icon={<TrendingUp size={16} color="#2d7a5f" />}>
          {most.map((r, i) => <UsageBar key={r.name} r={r} rank={i + 1} maxCount={maxCount} color="#2d7a5f" t={t} />)}
        </Panel>
        <Panel title={t("usage_least")} icon={<TrendingDown size={16} color="#e07a7a" />}>
          {least.length
            ? least.map((r, i) => <UsageBar key={r.name} r={r} rank={i + 1} maxCount={maxCount} color="#e07a7a" t={t} />)
            : <div style={{ color: "var(--muted)", fontSize: "0.78rem", padding: 10 }}>—</div>}
        </Panel>
      </div>

      {/* full ranked table */}
      <Panel title={t("usage_all")} icon={null} right={
        <div style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 12px", background: "var(--surface2)" }}>
          <Search size={13} color="#6b7a8d" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("sla_crt_search")}
            style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.74rem", color: "var(--text)", width: 150 }} />
        </div>
      }>
        <div className="pn-scroll" style={{ maxHeight: 420, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "var(--card)", textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "6px 8px" }}>#</th>
                <th style={{ padding: "6px 8px" }}>{t("sla_crt_col_type")}</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("sla_crt_col_count")}</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("usage_share")}</th>
                <th style={{ padding: "6px 8px", textAlign: "center" }}>{t("sla_done")}/{t("sla_wip")}/{t("sla_todo")}</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("res_staff_count")}</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>SLA %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.name} style={{ borderTop: "1px solid var(--divider)" }}>
                  <td style={{ padding: "7px 8px", color: "var(--muted)" }}>{i + 1}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--text)", fontWeight: 600 }}>{r.count}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--soft)" }}>{r.share_pct}%</td>
                  <td style={{ padding: "7px 8px", textAlign: "center", color: "var(--soft)" }}>
                    <span style={{ color: "#2d7a5f" }}>{r.done}</span> / <span style={{ color: "#d4a84b" }}>{r.in_progress}</span> / <span style={{ color: "#6b7a8d" }}>{r.todo}</span>
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--soft)" }}>{r.assignee_count}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>
                    <span style={{ color: rateColor(r.reaction_pass_rate_pct), fontWeight: 600 }}>{r.reaction_pass_rate_pct ?? "—"}</span>
                    <span style={{ color: "var(--muted)" }}> / </span>
                    <span style={{ color: rateColor(r.resolution_pass_rate_pct), fontWeight: 600 }}>{r.resolution_pass_rate_pct ?? "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

const GAP = 14;

function Kpi({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text)" }}>{value}</span>
      {sub && <span style={{ fontSize: "0.68rem", color: "var(--soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
    </div>
  );
}

function Panel({ title, icon, right, children }: { title: string; icon: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}<span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function UsageBar({ r, rank, maxCount, color, t }: { r: Row; rank: number; maxCount: number; color: string; t: (k: string) => string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <span style={{ width: 18, fontSize: "0.7rem", color: "var(--muted)", textAlign: "right" }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: "0.74rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
          <span style={{ fontSize: "0.74rem", color: "var(--text)", fontWeight: 600, flexShrink: 0 }}>{r.count} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({r.share_pct}%)</span></span>
        </div>
        <div style={{ height: 5, borderRadius: 5, background: "var(--surface2)", marginTop: 3, overflow: "hidden" }}>
          <div style={{ width: `${Math.max(3, 100 * r.count / maxCount)}%`, height: "100%", borderRadius: 5, background: color }} />
        </div>
      </div>
      <span style={{ fontSize: "0.66rem", color: "var(--muted)", flexShrink: 0 }}>{r.assignee_count} {t("res_staff")}</span>
    </div>
  );
}
