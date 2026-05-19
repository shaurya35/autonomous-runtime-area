import { StatusPill } from "../../../components/StatusPill";
import type { Status } from "../../../lib/api";

const STATUSES: Status[] = ["healthy", "watch", "critical", "recovering", "discharged"];

export default function PillsDevPage() {
  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>StatusPill variants</h1>
      {(["sm", "md", "lg"] as const).map(size => (
        <div key={size} style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", width: 24 }}>{size}</span>
          {STATUSES.map(s => (
            <StatusPill key={s} status={s} size={size} />
          ))}
        </div>
      ))}
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", marginBottom: "0.5rem" }}>With pulse</h2>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <StatusPill status="critical" pulse />
          <StatusPill status="watch" pulse />
        </div>
      </div>
    </div>
  );
}
