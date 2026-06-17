import { motion } from "motion/react";
import { ClipboardList, Calendar, Users, Apple, Dumbbell, Plus } from "lucide-react";

const steps = [
  {
    icon: ClipboardList,
    label: "Assessment",
    period: "Jan – Feb",
    bullets: ["Establish baseline health metrics", "Review detailed medical history"],
  },
  {
    icon: Calendar,
    label: "Testing",
    period: "March – April",
    bullets: ["Conduct comprehensive lab test", "Analyze key blood biomarkers"],
  },
  {
    icon: Users,
    label: "Specialists",
    period: "April – May",
    bullets: ["Seek additional expert opinions", "Discuss early treatment options"],
  },
  {
    icon: Apple,
    label: "Nutrition",
    period: "June – July",
    bullets: ["Follow balanced healthy diet plan", "Increase fruits and vegetables in"],
  },
  {
    icon: Dumbbell,
    label: "Exercise",
    period: "July – August",
    bullets: ["Engage in regular aerobic exercise", "Maintain consistent activity routine"],
  },
];

export function SuggestedSteps() {
  return (
    <div className="bg-card rounded-2xl p-5 flex flex-col gap-4" style={{ backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.6)" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#1a2030" }}>Suggested Next Steps</span>
        <button
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "#ffffff", border: "1px solid #e4eaef",
            borderRadius: 10, padding: "4px 12px", fontSize: "0.75rem",
            fontWeight: 300, color: "#1a2030", cursor: "pointer",
          }}
        >
          Create Plan <Plus size={12} />
        </button>
      </div>

      <div className="flex gap-4">
        {/* Timeline column */}
        <div className="flex flex-col" style={{ minWidth: 140 }}>
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2"
                style={{ position: "relative", paddingBottom: i < steps.length - 1 ? 16 : 0 }}
              >
                {i < steps.length - 1 && (
                  <div style={{ position: "absolute", left: 13, top: 28, width: 1, height: "calc(100% - 4px)", background: "#e4eaef" }} />
                )}
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f0f4f7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                  <Icon size={13} color="#6b7a8d" />
                </div>
                <div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 300, color: "#1a2030" }}>{s.label}</span>
                  <span style={{ fontSize: "0.68rem", color: "#9aa5b4", marginLeft: 4 }}>({s.period})</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bullets column */}
        <div className="flex flex-col" style={{ flex: 1, borderLeft: "1px solid #e4eaef", paddingLeft: 16 }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{ paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
              {s.bullets.map(b => (
                <div key={b} className="flex items-start gap-1">
                  <span style={{ fontSize: "0.65rem", color: "#9aa5b4", marginTop: 2 }}>•</span>
                  <span style={{ fontSize: "0.68rem", color: "#6b7a8d", lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
