"use client";
import type { IncidentRun } from "../lib/api";

interface Props {
  runs: IncidentRun[];
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "var(--color-text-muted)";
  if (score >= 0.7) return "var(--color-success)";
  if (score >= 0.3) return "var(--color-warn)";
  return "var(--color-critical)";
}

const HEADERS = ["Run ID", "App", "Incident", "Score", "MTTR", "Status"];

export function AdmissionsTable({ runs }: Props) {
  if (runs.length === 0) return (
    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", padding: "1.5rem", textAlign: "center", fontFamily: "var(--font-mono)" }}>
      No runs yet. Inject an incident from an app card.
    </div>
  );

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
          {HEADERS.map(h => (
            <th key={h} style={{
              padding: "8px 16px",
              textAlign: "left",
              color: "var(--color-text-muted)",
              fontWeight: 500,
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-caption)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {runs.slice(0, 20).map(r => (
          <tr
            key={r.run_id}
            style={{ borderBottom: "1px solid var(--color-border-soft)", cursor: "pointer", transition: "background 120ms ease" }}
            onClick={() => window.location.href = `/incidents/${r.run_id}`}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-accent)" }}>
              {r.run_id.slice(0, 8)}
            </td>
            <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)" }}>{r.app}</td>
            <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              {r.incident_id}
            </td>
            <td style={{ padding: "12px 16px", color: scoreColor(r.score), fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {r.score != null ? r.score.toFixed(2) : "—"}
            </td>
            <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              {r.mttr_s != null ? `${r.mttr_s}s` : "—"}
            </td>
            <td style={{ padding: "12px 16px" }}>
              <span style={{
                color: r.status === "done" ? "var(--color-success)" : r.status === "failed" ? "var(--color-critical)" : "var(--color-warn)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>
                {r.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
