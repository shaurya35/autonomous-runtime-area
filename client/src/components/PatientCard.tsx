"use client";
import { useState } from "react";
import { Syringe, Activity, Clock, AlertTriangle } from "lucide-react";
import type { AppSummary, IncidentMeta, VitalSigns, Status } from "../lib/api";
import { injectIncident, startIncidentRun } from "../lib/api";
import { StatusPill } from "./StatusPill";
import { Sparkline } from "./Sparkline";

const LANG_COLOR: Record<string, string> = {
  rust: "#f97316", python: "#3b82f6", go: "#06b6d4",
  node: "#22c55e", java: "#f59e0b", ruby: "#ef4444",
};

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
  const lang = app.language?.toLowerCase() ?? "unknown";
  const langColor = LANG_COLOR[lang] ?? "var(--color-text-muted)";

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

  const borderColor = status === "critical" ? "var(--color-critical)" : status === "watch" ? "var(--color-warn)" : "var(--color-border-soft)";
  const cardStyle: React.CSSProperties = {
    background: "var(--color-bg-elevated)",
    border: `1px solid ${borderColor}`,
    borderLeft: status === "critical" ? `2px solid var(--color-critical)` : status === "watch" ? `2px solid var(--color-warn)` : `1px solid var(--color-border-soft)`,
    borderRadius: 6,
    padding: "1rem",
    cursor: "pointer",
    transition: "border-color 200ms ease",
  };

  return (
    <div style={cardStyle} onClick={() => window.location.href = `/apps/${app.name}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: langColor, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "0.875rem", color: "var(--color-text-primary)" }}>{app.name}</div>
            <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{lang}</div>
          </div>
        </div>
        <StatusPill status={status} size="sm" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={12} color="var(--color-text-muted)" />
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", width: 70, fontFamily: "var(--font-mono)" }}>{lastRps.toFixed(0)} req/s</span>
          <Sparkline data={v?.req_per_sec ?? []} width={80} height={20} color="var(--color-accent)" thresholds={{}} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={12} color="var(--color-text-muted)" />
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", width: 70, fontFamily: "var(--font-mono)" }}>{lastP99.toFixed(0)} ms</span>
          <Sparkline data={v?.p99_latency_ms ?? []} width={80} height={20} color="var(--color-warn)" thresholds={{ warn: 200, crit: 500 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={12} color="var(--color-text-muted)" />
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", width: 70, fontFamily: "var(--font-mono)" }}>{lastErr.toFixed(2)}%</span>
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

      <div style={{ marginTop: 6, fontSize: "0.6875rem", color: "var(--color-text-dim)", fontFamily: "var(--font-mono)" }}>{app.source_root}</div>
    </div>
  );
}
