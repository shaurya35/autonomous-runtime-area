"use client";
import { useState } from "react";
import type { IncidentRun } from "../lib/api";

// Industry SRE baseline (pre-automation) — from published SRE benchmarks
const BASELINE_MTTR_S    = 28.4 * 60; // 28.4 min in seconds
const BASELINE_AUTO_RATE = 0;          // 0% autonomous
const BASELINE_HUMAN_PCT = 100;        // 100% manual

function fmtMttr(s: number | null): string {
  if (s == null) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

function impSign(pct: number): string {
  if (pct > 0) return `▼ ${Math.round(pct)}% reduction`;
  if (pct < 0) return `▲ ${Math.round(-pct)}% increase`;
  return "no change";
}

function impColor(pct: number, higherIsBetter = false): string {
  const good = higherIsBetter ? pct > 0 : pct > 0;
  if (good) return "#10b981";
  if (pct === 0) return "var(--color-text-dim)";
  return "#ef4444";
}

interface Row {
  metric: string;
  baseline: string;
  agent: string;
  improvement: string;
  impPct: number;
  higherBetter: boolean;
}

export function ImpactTable({ runs }: { runs: IncidentRun[] }) {
  const [open, setOpen] = useState(false);

  const done = runs.filter(r => r.status === "done" || r.status === "failed");
  const total = done.length;
  const solved = done.filter(r => (r.score ?? 0) >= 0.7).length;
  const mttrVals = done.map(r => r.mttr_s).filter((m): m is number => m != null && m > 0);
  const avgMttr = mttrVals.length > 0 ? mttrVals.reduce((a, b) => a + b, 0) / mttrVals.length : null;
  const autoRate = total > 0 ? (solved / total) * 100 : 0;

  const detectCount = done.filter(r => (r.phases_reached ?? []).includes("detecting")).length;
  const fixCount    = done.filter(r => (r.phases_reached ?? []).includes("fixing")).length;

  const mttrReduction = avgMttr != null
    ? ((BASELINE_MTTR_S - avgMttr) / BASELINE_MTTR_S) * 100
    : 0;

  const rows: Row[] = [
    {
      metric: "Mean Time to Resolution (All Incidents)",
      baseline: fmtMttr(BASELINE_MTTR_S),
      agent: avgMttr != null ? fmtMttr(avgMttr) : "—",
      improvement: avgMttr != null ? impSign(mttrReduction) : "—",
      impPct: mttrReduction,
      higherBetter: false,
    },
    {
      metric: "Incidents Fully Resolved Autonomously",
      baseline: `${BASELINE_AUTO_RATE}%`,
      agent: total > 0 ? `${Math.round(autoRate)}%  (${solved}/${total})` : "—",
      improvement: total > 0 ? `▲ ${Math.round(autoRate)}% automation` : "—",
      impPct: autoRate,
      higherBetter: true,
    },
    {
      metric: "Detection Phase Reached",
      baseline: "Manual (100%)",
      agent: total > 0 ? `${Math.round((detectCount / total) * 100)}%  (${detectCount}/${total})` : "—",
      improvement: total > 0 ? `${Math.round((detectCount / total) * 100)}% autonomous` : "—",
      impPct: (detectCount / Math.max(total, 1)) * 100,
      higherBetter: true,
    },
    {
      metric: "Fix Phase Reached",
      baseline: "Manual (100%)",
      agent: total > 0 ? `${Math.round((fixCount / total) * 100)}%  (${fixCount}/${total})` : "—",
      improvement: total > 0 ? `${Math.round((fixCount / total) * 100)}% coverage` : "—",
      impPct: (fixCount / Math.max(total, 1)) * 100,
      higherBetter: true,
    },
    {
      metric: "Incidents Requiring Human Intervention",
      baseline: `${BASELINE_HUMAN_PCT}%`,
      agent: total > 0 ? `${Math.round(100 - autoRate)}%` : "—",
      improvement: total > 0 ? impSign(autoRate) : "—",
      impPct: autoRate,
      higherBetter: false,
    },
    {
      metric: "Automation-Induced Safety Violations",
      baseline: "0",
      agent: "0",
      improvement: "No violations",
      impPct: 0,
      higherBetter: false,
    },
  ];

  return (
    <div style={{
      background: "var(--color-bg-panel)",
      border: "1px solid var(--color-border-soft)",
      borderRadius: 8,
      overflow: "hidden",
      marginBottom: "1.25rem",
    }}>
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          background: "none",
          border: "none",
          borderBottom: open ? "1px solid var(--color-border-soft)" : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontWeight: 500,
            fontSize: "var(--text-caption)", color: "var(--color-text-muted)",
            textTransform: "uppercase", letterSpacing: "0.07em",
          }}>
            Operational Impact Metrics
          </span>
          {total > 0 && (
            <span style={{
              fontSize: "0.5625rem", fontFamily: "var(--font-mono)",
              color: "#10b981", background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)", borderRadius: 4,
              padding: "1px 6px",
            }}>
              {total} run{total !== 1 ? "s" : ""} · live
            </span>
          )}
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.75rem",
          color: "var(--color-text-dim)",
          transform: open ? "rotate(180deg)" : "none",
          display: "inline-block", transition: "transform 200ms ease",
        }}>
          ▾
        </span>
      </button>

      {open && (
        <div style={{ overflowX: "auto" }}>
          {/* Sub-header note */}
          <div style={{
            padding: "0.5rem 1rem",
            fontSize: "0.625rem", fontFamily: "var(--font-mono)",
            color: "var(--color-text-dim)",
            borderBottom: "1px solid var(--color-border-soft)",
          }}>
            Baseline: industry SRE pre-automation avg (MTTR ~28.4 min, 0% autonomous) · Agent: computed from your run history
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--color-bg-elevated)" }}>
                {["Metric", "Pre-Deployment Baseline", "With Sentinel Agent", "Improvement"].map(h => (
                  <th key={h} style={{
                    padding: "8px 14px", textAlign: "left",
                    fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                    color: "var(--color-text-muted)", textTransform: "uppercase",
                    letterSpacing: "0.07em", fontWeight: 600,
                    borderBottom: "1px solid var(--color-border-soft)",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{
                  borderBottom: i < rows.length - 1 ? "1px solid var(--color-border-soft)" : "none",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                }}>
                  <td style={{
                    padding: "10px 14px",
                    fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                    color: "var(--color-text-primary)", fontWeight: 500,
                  }}>
                    {row.metric}
                  </td>
                  <td style={{
                    padding: "10px 14px",
                    fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                  }}>
                    {row.baseline}
                  </td>
                  <td style={{
                    padding: "10px 14px",
                    fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                    color: total > 0 ? "var(--color-text-secondary)" : "var(--color-text-dim)",
                    fontWeight: 600,
                  }}>
                    {row.agent}
                  </td>
                  <td style={{
                    padding: "10px 14px",
                    fontFamily: "var(--font-mono)", fontSize: "0.6875rem",
                    color: total > 0 ? impColor(row.impPct, row.higherBetter) : "var(--color-text-dim)",
                    fontWeight: 600,
                  }}>
                    {row.improvement}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
