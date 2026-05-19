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

export function TreatmentHistory({ runs }: Props) {
  if (runs.length === 0) {
    return <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", padding: "1rem 0" }}>No treatments yet.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {runs.slice(0, 10).map(r => (
        <a key={r.run_id} href={`/incidents/${r.run_id}`} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
          background: "var(--color-bg-subtle)", borderRadius: 6,
          border: "1px solid var(--color-border-soft)",
          textDecoration: "none",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-dim)" }}>{r.run_id.slice(0, 8)}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-doctor)" }}>{r.incident_id}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: scoreColor(r.score) }}>
            {r.score !== null ? r.score.toFixed(2) : "—"}
          </span>
          {r.mttr_s !== null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{r.mttr_s}s</span>
          )}
          <span style={{ fontSize: "0.75rem", color: r.status === "done" ? "var(--color-healthy)" : r.status === "failed" ? "var(--color-critical)" : "var(--color-watch)" }}>
            {r.status}
          </span>
        </a>
      ))}
    </div>
  );
}
