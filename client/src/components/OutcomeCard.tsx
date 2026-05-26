"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import type { IncidentRun } from "@/lib/api";
import { getReportUrl } from "@/lib/api";

interface Props {
  run: IncidentRun;
}

const PHASES = ["detecting", "diagnosing", "fixing", "verifying"] as const;

export function OutcomeCard({ run }: Props) {
  const [displayScore, setDisplayScore] = useState(0);
  const rafRef = useRef<number | null>(null);
  const targetScore = run.score ?? 0;
  const isSuccess = run.status === "done" && targetScore > 0;
  const error = (run as IncidentRun & { error?: string }).error;

  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setDisplayScore(eased * targetScore);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetScore]);

  const mttr = run.mttr_s ?? 0;
  const phases = run.phases_reached ?? [];

  return (
    <div style={{ padding: "1rem", borderBottom: "1px solid var(--color-border-soft)" }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-caption)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-text-muted)",
        display: "block",
        marginBottom: 16,
      }}>
        Outcome
      </span>

      {/* Score */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "2.75rem",
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: isSuccess ? "var(--color-accent)" : "var(--color-critical)",
        }}>
          {displayScore.toFixed(2)}
        </div>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginTop: 4,
        }}>
          Score
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {[
          { label: "MTTR", value: mttr > 0 ? `${mttr}s` : "—" },
          {
            label: "Status",
            value: run.status,
            color: run.status === "done" ? "var(--color-success)"
              : run.status === "failed" ? "var(--color-critical)"
              : "var(--color-warn)",
          },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {label}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: color ?? "var(--color-text-secondary)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Phase checkmarks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {PHASES.map(p => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 10,
              color: phases.includes(p) ? "var(--color-success)" : "var(--color-text-dim)",
            }}>
              {phases.includes(p) ? "✓" : "○"}
            </span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: phases.includes(p) ? "var(--color-text-secondary)" : "var(--color-text-dim)",
            }}>
              {p}
            </span>
          </div>
        ))}
      </div>

      {/* Download report — benchmark runs only (no workspace_id) */}
      {run.status === "done" && !run.workspace_id && (
        <a
          href={getReportUrl(run.run_id)}
          download={`report-${run.run_id.slice(0, 8)}.pdf`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            marginTop: 14,
            padding: "5px 10px",
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-soft)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            color: "var(--color-accent)",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <FileDown size={12} />
          Download Report
        </a>
      )}

      {/* Error message if failed */}
      {run.status === "failed" && error && (
        <div style={{
          marginTop: 14,
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          color: "var(--color-critical)",
          borderLeft: "2px solid var(--color-critical)",
          paddingLeft: 8,
          lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
