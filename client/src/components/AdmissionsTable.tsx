"use client";
import type { IncidentRun } from "../lib/api";

interface Props {
  runs: IncidentRun[];
}

function scoreColor(score: number | null): string {
  if (score === null) return "var(--color-text-muted)";
  if (score >= 0.7) return "var(--color-healthy)";
  if (score >= 0.3) return "var(--color-watch)";
  return "var(--color-critical)";
}

export function AdmissionsTable({ runs }: Props) {
  if (runs.length === 0) return (
    <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", padding: "1.5rem", textAlign: "center" }}>
      No incidents yet. Inject one from a patient card.
    </div>
  );
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
          {["Case ID", "App", "Incident", "Score", "Time", "Status"].map(h => (
            <th key={h} style={{ padding: "6px 12px", textAlign: "left", color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "var(--font-display)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {runs.slice(0, 20).map(r => (
          <tr key={r.run_id} style={{ borderBottom: "1px solid var(--color-border-soft)22", cursor: "pointer" }}
              onClick={() => window.location.href = `/incidents/${r.run_id}`}>
            <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-doctor)" }}>{r.run_id.slice(0, 8)}</td>
            <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>{r.app}</td>
            <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{r.incident_id}</td>
            <td style={{ padding: "8px 12px", color: scoreColor(r.score), fontWeight: 600, fontFamily: "var(--font-mono)" }}>{r.score !== null ? r.score.toFixed(2) : "—"}</td>
            <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{r.mttr_s !== null ? `${r.mttr_s}s` : "—"}</td>
            <td style={{ padding: "8px 12px" }}>
              <span style={{ color: r.status === "done" ? "var(--color-healthy)" : r.status === "failed" ? "var(--color-critical)" : "var(--color-watch)", fontSize: "0.75rem" }}>
                {r.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
