import { Activity } from "lucide-react";

interface Props {
  appCount: number;
  activeIncidents: number;
}

export function WardHeader({ appCount, activeIncidents }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Activity size={20} color="var(--color-doctor)" />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>Sentinel Ward</h1>
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
        {appCount} patient{appCount !== 1 ? "s" : ""} · {activeIncidents} active incident{activeIncidents !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
