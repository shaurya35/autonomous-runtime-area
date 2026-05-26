"use client";
import type { IncidentRun } from "../../lib/api";

function formatMttr(s: number | null | undefined): string {
  if (s == null || s <= 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function formatTime(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const day = d.getDate();
  const month = d.toLocaleString("default", { month: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} · ${hh}:${mm}`;
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "var(--color-text-dim)";
  if (score >= 0.7) return "#10b981";
  if (score >= 0.3) return "#f59e0b";
  return "#ef4444";
}

const PHASE_KEYS = ["detecting", "diagnosing", "fixing", "verifying"] as const;
const PHASE_SHORT: Record<string, string> = {
  detecting: "D", diagnosing: "Dx", fixing: "F", verifying: "V",
};

export function RunsTable({ runs }: { runs: IncidentRun[] }) {
  if (runs.length === 0) {
    return (
      <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
        No completed runs yet. Inject an incident from the Demo page.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
            {["Time", "App", "Incident", "Phases", "Score", "MTTR", "Status"].map(h => (
              <th key={h} style={{
                padding: "8px 14px", textAlign: "left",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)", fontSize: "0.625rem",
                textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 500,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => {
            const phases = r.phases_reached ?? [];
            return (
              <tr
                key={r.run_id}
                style={{
                  borderBottom: i < runs.length - 1 ? "1px solid var(--color-border-soft)" : "none",
                  cursor: "pointer",
                  transition: "background 120ms ease",
                }}
                onClick={() => { window.location.href = `/incidents/${r.run_id}`; }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                  {formatTime(r.started_at)}
                </td>
                <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                  {r.app}
                </td>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-accent)" }}>
                  {r.incident_id}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {PHASE_KEYS.map(p => {
                      const reached = phases.includes(p);
                      return (
                        <span key={p} style={{
                          fontSize: "0.5625rem",
                          fontFamily: "var(--font-mono)",
                          padding: "1px 4px",
                          borderRadius: 3,
                          background: reached ? "rgba(59,130,246,0.15)" : "var(--color-bg-subtle)",
                          color: reached ? "var(--color-accent)" : "var(--color-text-dim)",
                          border: `1px solid ${reached ? "rgba(59,130,246,0.3)" : "transparent"}`,
                        }}>
                          {PHASE_SHORT[p]}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.8125rem",
                    fontWeight: 700, color: scoreColor(r.score),
                  }}>
                    {r.score != null ? r.score.toFixed(2) : "—"}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  {formatMttr(r.mttr_s)}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    fontSize: "0.5625rem",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: r.status === "done" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                    color: r.status === "done" ? "#10b981" : "#ef4444",
                    border: `1px solid ${r.status === "done" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                  }}>
                    {r.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
