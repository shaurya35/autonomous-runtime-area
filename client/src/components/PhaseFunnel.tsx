import type { IncidentRun } from "../lib/api";

interface Props {
  runs: IncidentRun[];
}

const PHASES = [
  { key: "detecting",  label: "Detect",   color: "#3b82f6" },
  { key: "diagnosing", label: "Diagnose", color: "#8b5cf6" },
  { key: "fixing",     label: "Fix",      color: "#f59e0b" },
  { key: "verifying",  label: "Verify",   color: "#10b981" },
] as const;

export function PhaseFunnel({ runs }: Props) {
  const completed = runs.filter(r => r.status === "done" || r.status === "failed");
  if (completed.length === 0) return null;

  const total = completed.length;
  const counts = PHASES.map(p => ({
    ...p,
    n: completed.filter(r => (r.phases_reached ?? []).includes(p.key)).length,
  }));

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
        Phase Completion  <span style={{ color: "var(--color-text-muted)", marginLeft: 6 }}>({total} run{total !== 1 ? "s" : ""})</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {counts.map(({ key, label, color, n }) => {
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 60, fontFamily: "var(--font-mono)",
                fontSize: "0.6875rem", color: "var(--color-text-muted)",
                textAlign: "right", flexShrink: 0,
              }}>
                {label}
              </span>
              <div style={{
                flex: 1, height: 16,
                background: "var(--color-bg-subtle)",
                borderRadius: 3, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: color,
                  borderRadius: 3,
                  opacity: 0.8,
                  minWidth: pct > 0 ? 3 : 0,
                }} />
              </div>
              <span style={{
                width: 36, fontFamily: "var(--font-mono)",
                fontSize: "0.6875rem", color,
                textAlign: "right", flexShrink: 0,
              }}>
                {Math.round(pct)}%
              </span>
              <span style={{
                width: 28, fontFamily: "var(--font-mono)",
                fontSize: "0.625rem", color: "var(--color-text-dim)",
                flexShrink: 0,
              }}>
                {n}/{total}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 10,
        fontSize: "0.625rem",
        color: "var(--color-text-dim)",
        fontFamily: "var(--font-mono)",
      }}>
        score = 0.2×detect + 0.3×diagnose + 0.5×fix — time penalty
      </div>
    </div>
  );
}
