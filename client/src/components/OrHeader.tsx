"use client";

import { useEffect, useState } from "react";
import type { IncidentRun } from "@/lib/api";

interface Props {
  run: IncidentRun;
  currentPhase?: string;
}

const STATUS_COLOR: Record<string, string> = {
  running: "var(--color-warn)",
  done:    "var(--color-success)",
  failed:  "var(--color-critical)",
};

export function OrHeader({ run, currentPhase }: Props) {
  const [elapsed, setElapsed] = useState(() => {
    if (run.started_at) return Math.floor(Date.now() / 1000 - run.started_at);
    return 0;
  });

  useEffect(() => {
    if (run.status !== "running") return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [run.status]);

  const displayTime = run.mttr_s ?? elapsed;
  const mm = String(Math.floor(displayTime / 60)).padStart(2, "0");
  const ss = String(displayTime % 60).padStart(2, "0");

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 1.5rem", height: 52,
      background: "var(--color-bg-panel)",
      borderBottom: "1px solid var(--color-border-soft)",
      flexShrink: 0,
    }}>
      {/* Left: run meta */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)",
      }}>
        <span style={{ color: "var(--color-accent)" }}>{run.run_id.slice(0, 8)}</span>
        <span style={{ color: "var(--color-text-dim)" }}>·</span>
        <span style={{ color: "var(--color-text-secondary)" }}>{run.app}</span>
        <span style={{ color: "var(--color-text-dim)" }}>·</span>
        <span style={{ color: "var(--color-text-muted)" }}>{run.incident_id}</span>
      </div>

      {/* Right: phase + timer + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {currentPhase && (
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--color-accent)",
            padding: "2px 8px",
            border: "1px solid rgba(34,211,238,0.35)",
            borderRadius: 4,
          }}>
            {currentPhase}
          </span>
        )}
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "1rem",
          fontWeight: 600,
          color: run.status === "running" ? "var(--color-warn)" : "var(--color-text-primary)",
          letterSpacing: "0.04em",
        }}>
          {mm}:{ss}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: STATUS_COLOR[run.status] ?? "var(--color-text-muted)",
        }}>
          {run.status}
        </span>
      </div>
    </div>
  );
}
