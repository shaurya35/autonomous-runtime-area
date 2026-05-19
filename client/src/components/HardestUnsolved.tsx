interface Props {
  incidentId: string | null;
  app: string | null;
  bestScore: number | null;
}

export function HardestUnsolved({ incidentId, app, bestScore }: Props) {
  if (!incidentId) return null;
  return (
    <div style={{
      background: "#ef444410", border: "1px solid #ef444433", borderRadius: 10,
      padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontSize: "1.5rem" }}>🔥</span>
      <div>
        <div style={{ fontSize: "0.6875rem", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Hardest Unsolved</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--color-text-primary)" }}>
          {incidentId} on <span style={{ color: "var(--color-doctor)" }}>{app}</span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 2 }}>
          Best attempt: <span style={{ fontFamily: "var(--font-mono)", color: bestScore !== null ? "#ef4444" : "var(--color-text-dim)" }}>{bestScore !== null ? bestScore.toFixed(2) : "never attempted"}</span>
        </div>
      </div>
    </div>
  );
}
