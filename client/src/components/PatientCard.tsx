"use client";
import { useState } from "react";
import { Syringe } from "lucide-react";
import type { AppSummary, IncidentMeta, VitalSigns, Status } from "../lib/api";
import { injectIncident, startIncidentRun } from "../lib/api";
import { StatusPill } from "./StatusPill";
import { Sparkline } from "./Sparkline";
import { HeartbeatIcon } from "./HeartbeatIcon";

const LANG_EMOJI: Record<string, string> = {
  rust: "🦀", python: "🐍", go: "🐹", node: "🟢", java: "☕", ruby: "💎",
};

function bpmFromStatus(status: Status): number {
  if (status === "critical") return 180;
  if (status === "watch") return 100;
  if (status === "recovering") return 70;
  return 60;
}

interface Props {
  app: AppSummary;
  vitals: VitalSigns | null;
  status: Status;
  incidents: IncidentMeta[];
  onAction?: () => void;
}

export function PatientCard({ app, vitals, status, incidents, onAction }: Props) {
  const [selectedIncident, setSelectedIncident] = useState(incidents[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const bpm = bpmFromStatus(status);
  const lang = app.language?.toLowerCase() ?? "unknown";
  const emoji = LANG_EMOJI[lang] ?? "📦";

  const v = vitals?.vitals;
  const lastRps = v?.req_per_sec.at(-1) ?? 0;
  const lastP99 = v?.p99_latency_ms.at(-1) ?? 0;
  const lastErr = v?.error_rate_pct.at(-1) ?? 0;

  async function handleInject(e: React.MouseEvent) {
    e.stopPropagation();
    if (!selectedIncident) return;
    setLoading(true);
    try {
      await injectIncident(app.name, selectedIncident);
      const run = await startIncidentRun(app.name, selectedIncident);
      if (run.run_id) {
        window.location.href = `/incidents/${run.run_id}`;
      }
    } finally {
      setLoading(false);
      onAction?.();
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-bg-elevated)",
    border: `1px solid ${status === "critical" ? "#ef444455" : status === "watch" ? "#f59e0b33" : "var(--color-border-soft)"}`,
    borderRadius: 12,
    padding: "1rem",
    cursor: "pointer",
    transition: "border-color 600ms cubic-bezier(0.4,0,0.2,1), box-shadow 150ms ease",
    boxShadow: status === "critical" ? "0 0 20px #ef444422" : undefined,
  };

  return (
    <div style={cardStyle} onClick={() => window.location.href = `/apps/${app.name}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.5rem" }}>{emoji}</span>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-text-primary)" }}>{app.name}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{lang}</div>
          </div>
        </div>
        <StatusPill status={status} size="sm" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HeartbeatIcon bpm={bpm} size={13} />
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", width: 70 }}>{lastRps.toFixed(0)} req/s</span>
          <Sparkline data={v?.req_per_sec ?? []} width={80} height={20} color="var(--color-doctor)" thresholds={{}} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.75rem" }}>🩺</span>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", width: 70 }}>{lastP99.toFixed(0)} ms</span>
          <Sparkline data={v?.p99_latency_ms ?? []} width={80} height={20} color="var(--color-watch)" thresholds={{ warn: 200, crit: 500 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.75rem" }}>🌡</span>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", width: 70 }}>{lastErr.toFixed(2)}%</span>
          <Sparkline data={v?.error_rate_pct ?? []} width={80} height={20} color="var(--color-critical)" thresholds={{ warn: 0.5, crit: 5 }} />
        </div>
      </div>

      {incidents.length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
          <select
            value={selectedIncident}
            onChange={e => setSelectedIncident(e.target.value)}
            style={{ flex: 1, background: "var(--color-bg-panel)", border: "1px solid var(--color-border-soft)", borderRadius: 6, padding: "4px 6px", color: "var(--color-text-secondary)", fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}
          >
            {incidents.map(i => (
              <option key={i.id} value={i.id}>{i.id}</option>
            ))}
          </select>
          <button
            onClick={handleInject}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 4, background: loading ? "var(--color-bg-panel)" : "var(--color-critical)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: "0.75rem", cursor: loading ? "wait" : "pointer", fontWeight: 600 }}
          >
            <Syringe size={12} />{loading ? "…" : "Inject"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: "0.6875rem", color: "var(--color-text-dim)" }}>{app.source_root}</div>
    </div>
  );
}
