import type { IncidentRun } from "../lib/api";

interface Props {
  runs: IncidentRun[];
  incidentIds: string[];
}

const CHART_H = 110;

export function MttrChart({ runs, incidentIds }: Props) {
  const mttrMap: Record<string, number[]> = {};
  for (const run of runs) {
    if ((run.status === "done") && run.mttr_s !== null) {
      if (!mttrMap[run.incident_id]) mttrMap[run.incident_id] = [];
      mttrMap[run.incident_id].push(run.mttr_s);
    }
  }

  const hasData = Object.values(mttrMap).some(a => a.length > 0);
  if (!hasData) return null;

  const allValues = Object.values(mttrMap).flat();
  const maxMttr = Math.max(...allValues, 1);

  const bars = incidentIds.map(id => {
    const arr = mttrMap[id] ?? [];
    const avg = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const min = arr.length > 0 ? Math.min(...arr) : null;
    const max = arr.length > 0 ? Math.max(...arr) : null;
    return { id, avg, min, max, n: arr.length };
  });

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
        Mean Time to Resolve
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        {/* Y axis label */}
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          height: CHART_H, paddingBottom: 2,
        }}>
          {[maxMttr, maxMttr / 2, 0].map(v => (
            <span key={v} style={{
              fontSize: "0.5625rem", fontFamily: "var(--font-mono)",
              color: "var(--color-text-dim)", lineHeight: 1, textAlign: "right",
              width: 32,
            }}>
              {v > 0 ? `${Math.round(v)}s` : "0"}
            </span>
          ))}
        </div>

        {/* Bars */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, height: CHART_H }}>
          {bars.map(({ id, avg, min, max, n }) => {
            const barH = avg !== null ? Math.max(4, (avg / maxMttr) * CHART_H) : 0;
            const minH = min !== null ? (min / maxMttr) * CHART_H : 0;
            const maxH = max !== null ? (max / maxMttr) * CHART_H : 0;

            return (
              <div
                key={id}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: CHART_H, justifyContent: "flex-end" }}
                title={avg !== null ? `${id}: avg ${avg.toFixed(0)}s (${n} run${n !== 1 ? "s" : ""})` : `${id}: no data`}
              >
                {avg !== null && (
                  <span style={{
                    fontSize: "0.625rem", fontFamily: "var(--font-mono)",
                    color: "var(--color-text-secondary)", marginBottom: 3,
                  }}>
                    {avg.toFixed(0)}s
                  </span>
                )}

                <div style={{ width: "100%", height: CHART_H, position: "relative", display: "flex", alignItems: "flex-end" }}>
                  {/* Range line (min→max) */}
                  {min !== null && max !== null && min !== max && (
                    <div style={{
                      position: "absolute",
                      bottom: minH,
                      left: "50%", transform: "translateX(-50%)",
                      width: 2,
                      height: maxH - minH,
                      background: "rgba(59,130,246,0.3)",
                      borderRadius: 1,
                    }} />
                  )}

                  {/* Main bar */}
                  <div style={{
                    width: "100%",
                    height: barH || 0,
                    background: avg !== null ? "var(--color-accent)" : "var(--color-bg-subtle)",
                    borderRadius: "3px 3px 0 0",
                    opacity: avg !== null ? 0.85 : 0.4,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* X axis — incident labels */}
      <div style={{ display: "flex", gap: 6, marginTop: 6, paddingLeft: 32 + 8 }}>
        {bars.map(({ id, n }) => (
          <div key={id} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              fontSize: "0.625rem", fontFamily: "var(--font-mono)",
              color: "var(--color-accent)", lineHeight: 1.3,
            }}>
              {id}
            </div>
            <div style={{
              fontSize: "0.5625rem", color: "var(--color-text-dim)",
              fontFamily: "var(--font-mono)",
            }}>
              {n > 0 ? `${n} run${n !== 1 ? "s" : ""}` : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
