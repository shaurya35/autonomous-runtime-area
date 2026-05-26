"use client";
import { useState } from "react";
import { Syringe, Activity, Clock, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { AppSummary, IncidentMeta, VitalSigns, Status } from "../lib/api";
import { injectIncident, startIncidentRun } from "../lib/api";
import { StatusPill } from "./StatusPill";
import { Sparkline } from "./Sparkline";

const LANG_COLOR: Record<string, string> = {
  rust: "#f97316", python: "#3b82f6", go: "#06b6d4",
  node: "#22c55e", java: "#f59e0b", ruby: "#ef4444",
};

const DIFF_COLOR: Record<string, string> = {
  easy: "#10b981", medium: "#f59e0b", hard: "#ef4444",
};

const CATEGORY_LABEL: Record<string, string> = {
  code: "Code change", config: "Config change",
  resource: "Resource limit", network: "Network fault", integration: "Integration",
};

const INJECT_LABEL: Record<string, string> = {
  code: "Deploy Bug", config: "Break Config", resource: "Exhaust Resource",
  network: "Inject Fault", integration: "Break Integration",
};

type Phase = "idle" | "confirming" | "destabilizing" | "dispatching";

interface Props {
  app: AppSummary;
  vitals: VitalSigns | null;
  status: Status;
  incidents: IncidentMeta[];
  onAction?: () => void;
}

export function PatientCard({ app, vitals, status, incidents, onAction }: Props) {
  const [selectedId, setSelectedId] = useState(incidents[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hoveredInfo, setHoveredInfo] = useState(false);
  const [error, setError] = useState("");

  const lang = app.language?.toLowerCase() ?? "unknown";
  const langColor = LANG_COLOR[lang] ?? "var(--color-text-muted)";
  const v = vitals?.vitals;
  const lastRps = v?.req_per_sec.at(-1) ?? 0;
  const lastP99 = v?.p99_latency_ms.at(-1) ?? 0;
  const lastErr = v?.error_rate_pct.at(-1) ?? 0;

  const selected = incidents.find(i => i.id === selectedId);

  async function handleConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    if (!selectedId) return;
    setError("");
    setPhase("destabilizing");
    try {
      await injectIncident(app.name, selectedId);
      setPhase("dispatching");
      await new Promise(r => setTimeout(r, 800));
      const run = await startIncidentRun(app.name, selectedId);
      if (run.run_id) window.location.href = `/incidents/${run.run_id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Incident start failed");
      setPhase("idle");
    } finally {
      onAction?.();
    }
  }

  const borderColor =
    status === "critical" ? "var(--color-critical)" :
    status === "watch" ? "var(--color-warn)" :
    "var(--color-border-soft)";

  const injectLabel = INJECT_LABEL[selected?.category ?? ""] ?? "Inject";
  const isWorking = phase === "destabilizing" || phase === "dispatching";

  return (
    <div
      style={{
        background: "var(--color-bg-elevated)",
        border: `1px solid ${borderColor}`,
        borderLeft: status === "critical" ? `3px solid var(--color-critical)` :
                    status === "watch" ? `3px solid var(--color-warn)` :
                    `1px solid var(--color-border-soft)`,
        borderRadius: 6,
        overflow: "visible",
        transition: "border-color 600ms ease",
        position: "relative",
      }}
    >
      {/* Card body — navigates to app page */}
      <div
        style={{ padding: "0.875rem 1rem", cursor: "pointer" }}
        onClick={() => window.location.href = `/apps/${app.name}`}
      >
        {/* Header row */}
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

        {/* Vitals */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { icon: <Activity size={12} color="var(--color-text-muted)" />, val: `${lastRps.toFixed(0)} req/s`, data: v?.req_per_sec ?? [], color: "var(--color-accent)", thresholds: {} },
            { icon: <Clock size={12} color="var(--color-text-muted)" />, val: `${lastP99.toFixed(0)} ms`, data: v?.p99_latency_ms ?? [], color: "var(--color-warn)", thresholds: { warn: 200, crit: 500 } },
            { icon: <AlertTriangle size={12} color="var(--color-text-muted)" />, val: `${lastErr.toFixed(2)}%`, data: v?.error_rate_pct ?? [], color: "var(--color-critical)", thresholds: { warn: 0.5, crit: 5 } },
          ].map(({ icon, val, data, color, thresholds }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {icon}
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", width: 70, fontFamily: "var(--font-mono)" }}>{val}</span>
              <Sparkline data={data} width={80} height={20} color={color} thresholds={thresholds} />
            </div>
          ))}
        </div>
      </div>

      {/* Controls — outside nav click zone */}
      {incidents.length > 0 && (
        <div style={{ padding: "0 1rem 0.875rem", position: "relative" }} onClick={e => e.stopPropagation()}>
          <div style={{ height: 1, background: "var(--color-border-soft)", marginBottom: 10 }} />

          {/* Hover tooltip — floats above the action row, overlays vitals */}
          {hoveredInfo && selected && (
            <div style={{
              position: "absolute",
              bottom: "calc(100% - 0.875rem + 4px)",
              left: "1rem", right: "1rem",
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-soft)",
              borderLeft: "3px solid var(--color-accent)",
              borderRadius: 6, padding: "10px 12px",
              zIndex: 20,
              display: "flex", flexDirection: "column", gap: 6,
              pointerEvents: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                color: "var(--color-text-primary)", fontWeight: 500,
                lineHeight: 1.4,
              }}>
                {selected.title}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <span style={{
                  fontSize: "0.625rem", padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-mono)",
                  background: "rgba(59,130,246,0.1)", color: "var(--color-accent)",
                  border: "1px solid rgba(59,130,246,0.25)",
                }}>{selected.difficulty}</span>
                <span style={{
                  fontSize: "0.625rem", padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-mono)",
                  background: "rgba(111,122,152,0.12)", color: "var(--color-text-muted)",
                  border: "1px solid rgba(111,122,152,0.25)",
                }}>{CATEGORY_LABEL[selected.category] ?? selected.category}</span>
              </div>
              {selected.symptoms && selected.symptoms.length > 0 && (
                <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                  {selected.symptoms[0]}
                </div>
              )}
            </div>
          )}

          {/* Working state */}
          {isWorking ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "var(--color-critical)",
                boxShadow: "0 0 6px var(--color-critical)",
                animation: "pulse 0.6s ease-in-out infinite",
                flexShrink: 0,
              }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-critical)" }}>
                {phase === "destabilizing" ? "Applying fault..." : "Dispatching Sentinel..."}
              </span>
            </div>
          ) : (
            /* Action row — single fixed row */
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {/* Dropdown — ID only, no title */}
              <select
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setPhase("idle"); }}
                style={{
                  background: "var(--color-bg-panel)",
                  border: "1px solid var(--color-border-soft)",
                  borderRadius: 6, padding: "4px 6px",
                  color: "var(--color-text-secondary)",
                  fontSize: "0.75rem", fontFamily: "var(--font-mono)",
                  flex: "0 0 auto",
                }}
              >
                {incidents.map(i => (
                  <option key={i.id} value={i.id}>{i.id}</option>
                ))}
              </select>

              {/* Info — hover to reveal details */}
              <button
                onMouseEnter={() => setHoveredInfo(true)}
                onMouseLeave={() => setHoveredInfo(false)}
                title="Hover to see incident details"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 26, height: 26, flexShrink: 0,
                  background: hoveredInfo ? "rgba(59,130,246,0.15)" : "var(--color-bg-panel)",
                  color: hoveredInfo ? "var(--color-accent)" : "var(--color-text-muted)",
                  border: `1px solid ${hoveredInfo ? "rgba(59,130,246,0.4)" : "var(--color-border-soft)"}`,
                  borderRadius: 6, cursor: "default",
                  transition: "background 150ms ease, color 150ms ease",
                }}
              >
                <Info size={12} />
              </button>

              {/* Confirm/Cancel OR Deploy Bug */}
              {phase === "confirming" ? (
                <>
                  <button
                    onClick={handleConfirm}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                      background: "var(--color-critical)", color: "#fff", border: "none",
                      borderRadius: 6, padding: "5px 8px", fontSize: "0.75rem",
                      cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-mono)",
                    }}
                  >
                    <CheckCircle2 size={11} /> Confirm
                  </button>
                  <button
                    onClick={() => setPhase("idle")}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 26, height: 26, flexShrink: 0,
                      background: "var(--color-bg-panel)", color: "var(--color-text-muted)",
                      border: "1px solid var(--color-border-soft)",
                      borderRadius: 6, cursor: "pointer",
                    }}
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setPhase("confirming")}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    background: "var(--color-critical)", color: "#fff", border: "none",
                    borderRadius: 6, padding: "5px 10px", fontSize: "0.75rem",
                    cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-mono)",
                  }}
                >
                  <Syringe size={12} /> {injectLabel}
                </button>
              )}
            </div>
          )}

          {error && (
            <div style={{ color: "var(--color-critical)", fontSize: "var(--text-caption)", fontFamily: "var(--font-mono)", lineHeight: 1.4, marginTop: 6 }}>
              {error}
            </div>
          )}

          <div style={{ fontSize: "0.6875rem", color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", marginTop: 6 }}>{app.source_root}</div>
        </div>
      )}
    </div>
  );
}
