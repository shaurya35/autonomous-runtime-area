"use client";
interface Cell {
  incident_id: string;
  best_score: number | null;
  runs: number;
}

interface Props {
  rows: { app: string; cells: Cell[] }[];
  incidentIds: string[];
  onCellClick: (app: string, incidentId: string) => void;
}

function cellBg(score: number | null): string {
  if (score === null) return "var(--color-bg-subtle)";
  if (score >= 0.7) return "#10b98120";
  if (score >= 0.3) return "#f59e0b20";
  return "#ef444420";
}

function cellColor(score: number | null): string {
  if (score === null) return "var(--color-text-dim)";
  if (score >= 0.7) return "#10b981";
  if (score >= 0.3) return "#f59e0b";
  return "#ef4444";
}

export function ScoreboardGrid({ rows, incidentIds, onCellClick }: Props) {
  if (rows.length === 0) {
    return <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", padding: "2rem", textAlign: "center" }}>No benchmark results yet. Run some incidents to populate the scoreboard.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
            <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--color-text-muted)", fontFamily: "var(--font-display)", position: "sticky", left: 0, background: "var(--color-bg-panel)" }}>App</th>
            {incidentIds.map(id => (
              <th key={id} style={{ padding: "8px 10px", textAlign: "center", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", whiteSpace: "nowrap" }}>{id}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const cellMap = Object.fromEntries(row.cells.map(c => [c.incident_id, c]));
            return (
              <tr key={row.app} style={{ borderBottom: "1px solid var(--color-border-soft)33" }}>
                <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", position: "sticky", left: 0, background: "var(--color-bg-panel)", color: "var(--color-text-secondary)" }}>
                  {row.app}
                </td>
                {incidentIds.map(id => {
                  const cell = cellMap[id];
                  const score = cell?.best_score ?? null;
                  return (
                    <td key={id} style={{ padding: "6px 10px", textAlign: "center", cursor: score !== null ? "pointer" : "default" }}
                        onClick={() => score !== null && onCellClick(row.app, id)}>
                      <div style={{
                        display: "inline-block", minWidth: 48, padding: "4px 8px", borderRadius: 6,
                        background: cellBg(score), color: cellColor(score),
                        fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: score !== null ? 700 : 400,
                        transition: "background 150ms ease",
                      }}>
                        {score !== null ? score.toFixed(2) : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
