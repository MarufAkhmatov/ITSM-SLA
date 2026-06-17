import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useI18n } from "../i18n";
import { usePortfolio } from "../portfolio";
import { openDrill } from "../drill";
import { FlowKanbanModal } from "./FlowKanbanModal";

type Bucket = { label: string; statuses: string[]; count: number; color: string; state: string };

/** Donut drawn as dense radial sticks (spokes) with a soft glow. */
function SpokeDonut({ buckets, total, pct, onSlice, onCenter, sub }: {
  buckets: Bucket[]; total: number; pct: number; sub: string;
  onSlice: (b: Bucket) => void; onCenter: () => void;
}) {
  const VB = 200, c = VB / 2, innerR = 50, outerR = 92, N = 96;
  const totalCount = buckets.reduce((s, b) => s + b.count, 0) || 1;
  const spokes = [];
  for (let i = 0; i < N; i++) {
    const frac = (i + 0.5) / N;
    let acc = 0, bucket = buckets[buckets.length - 1];
    for (const b of buckets) { acc += b.count / totalCount; if (frac <= acc) { bucket = b; break; } }
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    spokes.push({
      x1: c + innerR * Math.cos(a), y1: c + innerR * Math.sin(a),
      x2: c + outerR * Math.cos(a), y2: c + outerR * Math.sin(a), color: bucket.color, bucket,
    });
  }
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} width="100%" height="100%" style={{ maxHeight: "100%", display: "block" }}>
      <defs>
        <filter id="spokeGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#spokeGlow)">
        {spokes.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color}
            strokeWidth={3.4} strokeLinecap="round"
            style={{ cursor: "pointer", opacity: 0, animation: "pn-spoke 0.32s ease-out forwards", animationDelay: `${i * 7}ms` }}
            onClick={() => onSlice(s.bucket)} />
        ))}
      </g>
      <text x={c} y={c - 2} textAnchor="middle" onClick={onCenter}
        style={{ fontSize: 30, fontWeight: 700, fill: "var(--text)", cursor: "pointer" }}>{total}</text>
      <text x={c} y={c + 18} textAnchor="middle" style={{ fontSize: 11, fill: "#9aa5b4" }}>{sub}</text>
    </svg>
  );
}

export function PatientFlowChart() {
  const { t } = useI18n();
  const { data } = usePortfolio();
  const [kanban, setKanban] = useState(false);
  const pf = data?.widgets?.project_flow;
  const total = pf ? pf.total : 0;
  const pct = pf ? pf.completion_pct : 0;
  // Use ONLY real data — no fallback flash (so the donut animates straight into
  // the correct 10 status colours, not green/purple/red first).
  const buckets: Bucket[] = pf?.by_status || [];
  const ready = buckets.length > 0;

  const drill = (b: Bucket) => {
    const params: Record<string, string> = { scope: "epics" };
    if (b.statuses.length) params.status = b.statuses.join(",");
    else if (b.state) params.state = b.state;
    openDrill(b.label, params);
  };

  return (
    <div className="p-6 flex flex-col" style={{ height: "100%", gap: 8 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.85rem", fontWeight: 300, color: "var(--text)" }}>{t("patient_flow")}</span>
        <button onClick={() => setKanban(true)} title="Kanban"
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 8, background: "var(--surface2)", border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-sans)" }}>
          <LayoutGrid size={13} color="#2d7a5f" /> Kanban
        </button>
      </div>

      {/* Donut (sticks) on the left, status legend on the right */}
      <div className="flex" style={{ flex: 1, minHeight: 0, gap: 10, alignItems: "stretch" }}>
        <div style={{ flex: "1.15 1 0", minWidth: 0, position: "relative" }}>
          {ready && (
            <SpokeDonut buckets={buckets} total={total} pct={pct} sub={`${pct}% ${t("completed").toLowerCase()}`}
              onSlice={drill} onCenter={() => openDrill(t("patient_flow"), { scope: "epics" })} />
          )}
        </div>
        <div className="pn-scroll" style={{ flex: "1 1 0", minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, justifyContent: "center", paddingRight: 4 }}>
          {buckets.map((b) => (
            <div key={b.label} onClick={() => drill(b)} className="flex items-center gap-2"
              style={{ cursor: "pointer", padding: "3px 0" }} title={`${b.label}: ${b.count}`}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flexShrink: 0, boxShadow: `0 0 5px ${b.color}99` }} />
              <b style={{ fontSize: "0.82rem", color: "var(--text)", minWidth: 24, textAlign: "right" }}>{b.count}</b>
              <span style={{ fontSize: "0.68rem", color: "var(--soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {kanban && <FlowKanbanModal onClose={() => setKanban(false)} />}
    </div>
  );
}
