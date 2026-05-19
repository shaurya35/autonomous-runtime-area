"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import type { IncidentRun } from "@/lib/api";

interface Props {
  run: IncidentRun;
  currentPhase?: string;
}

const PHASE_COLORS: Record<string, string> = {
  detecting:  "var(--color-phase-detect)",
  diagnosing: "var(--color-phase-diagnose)",
  fixing:     "var(--color-phase-treat)",
  verifying:  "var(--color-phase-verify)",
};

export function OrHeader({ run, currentPhase }: Props) {
  const [elapsed, setElapsed] = useState(0);

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
      padding: "0.75rem 1.5rem",
      background: "var(--color-bg-panel)",
      borderBottom: "1px solid var(--color-border-soft)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Activity size={16} color="var(--color-doctor)" />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>CASE</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-doctor)" }}>{run.run_id.slice(0, 8)}</span>
        <span style={{ color: "var(--color-border-strong)" }}>·</span>
        <span style={{ color: "var(--color-text-secondary)", fontSize: "0.8125rem" }}>{run.app}</span>
        <span style={{ color: "var(--color-border-strong)" }}>·</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{run.incident_id}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {currentPhase && (
          <span style={{
            fontSize: "0.75rem", padding: "2px 8px", borderRadius: 999,
            background: `${PHASE_COLORS[currentPhase] ?? "#6f7a98"}22`,
            color: PHASE_COLORS[currentPhase] ?? "#6f7a98",
            border: `1px solid ${PHASE_COLORS[currentPhase] ?? "#6f7a98"}44`,
            textTransform: "capitalize",
          }}>{currentPhase}</span>
        )}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: run.status === "running" ? "var(--color-watch)" : "var(--color-text-primary)" }}>
          {mm}:{ss}
        </span>
        <span style={{ fontSize: "0.75rem", color: run.status === "done" ? "var(--color-healthy)" : run.status === "failed" ? "var(--color-critical)" : "var(--color-watch)" }}>
          {run.status}
        </span>
      </div>
    </div>
  );
}
