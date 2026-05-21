interface Props {
  appCount: number;
  activeIncidents: number;
}

export function WardHeader({ appCount, activeIncidents }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1.5rem" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-primary)" }}>
        sentinel
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {appCount} app{appCount !== 1 ? "s" : ""} · {activeIncidents} running
      </span>
    </div>
  );
}
