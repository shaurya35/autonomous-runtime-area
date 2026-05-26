interface Cell {
  incident_id: string;
  best_score: number | null;
  runs: number;
}

interface Props {
  rows: { app: string; cells: Cell[] }[];
  incidentIds: string[];
}

function scoreColor(s: number | null) {
  if (s === null) return "var(--color-text-dim)";
  if (s >= 0.7) return "#10b981";
  if (s >= 0.3) return "#f59e0b";
  return "#ef4444";
}

function scoreBarColor(s: number | null) {
  if (s === null) return "transparent";
  if (s >= 0.7) return "#10b981";
  if (s >= 0.3) return "#f59e0b";
  return "#ef4444";
}

export function ScoreChart({ rows, incidentIds }: Props) {
  if (incidentIds.length === 0 || rows.length === 0) return null;

  const multi = rows.length > 1;

  return (
    <div style={{
      background: "var(--color-bg-panel)",
      border: "1px solid var(--color-border-soft)",
      borderRadius: 6,
      padding: "1rem 1.25rem",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.6875rem",
        color: "var(--color-text-dim)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: "1rem",
      }}>
        Score by Incident
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {incidentIds.map(id => {
          const appScores = rows.map(row => ({
            app: row.app,
            score: row.cells.find(c => c.incident_id === id)?.best_score ?? null,
            runs: row.cells.find(c => c.incident_id === id)?.runs ?? 0,
          }));

          return (
            <div key={id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{
                width: 86, paddingTop: multi ? 3 : 5,
                fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                color: "var(--color-accent)", flexShrink: 0,
              }}>
                {id}
              </span>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                {appScores.map(({ app, score, runs }) => (
                  <div key={app} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {multi && (
                      <span style={{
                        width: 72, fontSize: "0.6875rem",
                        color: "var(--color-text-muted)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontFamily: "var(--font-mono)", flexShrink: 0,
                      }}>
                        {app}
                      </span>
                    )}

                    <div style={{
                      flex: 1, height: 18,
                      background: "var(--color-bg-subtle)",
                      borderRadius: 3, overflow: "hidden", position: "relative",
                    }}>
                      {score !== null ? (
                        <div style={{
                          position: "absolute", left: 0, top: 0, bottom: 0,
                          width: `${score * 100}%`,
                          background: scoreBarColor(score),
                          borderRadius: 3,
                          opacity: 0.85,
                        }} />
                      ) : (
                        <div style={{
                          position: "absolute", inset: 0, display: "flex", alignItems: "center",
                          paddingLeft: 8, fontSize: "0.625rem",
                          color: "var(--color-text-dim)", fontFamily: "var(--font-mono)",
                        }}>
                          no runs
                        </div>
                      )}
                    </div>

                    <span style={{
                      width: 34, fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                      color: scoreColor(score), textAlign: "right", flexShrink: 0,
                    }}>
                      {score !== null ? score.toFixed(2) : "—"}
                    </span>

                    {runs > 0 && (
                      <span style={{
                        width: 22, fontSize: "0.625rem",
                        color: "var(--color-text-dim)",
                        textAlign: "right", flexShrink: 0,
                        fontFamily: "var(--font-mono)",
                      }}>
                        {runs}×
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis ticks */}
      <div style={{
        display: "flex", marginTop: 10,
        paddingLeft: 86 + 12 + (multi ? 72 + 8 : 0),
        paddingRight: 34 + 8 + 22 + 8,
      }}>
        {[0, 0.25, 0.5, 0.70, 1.0].map((v, i) => (
          <span
            key={v}
            style={{
              flex: i === 0 ? 0 : 1,
              fontSize: "0.5625rem",
              color: v === 0.70 ? "var(--color-text-muted)" : "var(--color-text-dim)",
              fontFamily: "var(--font-mono)",
              textAlign: i === 0 ? "left" : "center",
            }}
          >
            {v.toFixed(2)}{v === 0.70 ? " ✓" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
