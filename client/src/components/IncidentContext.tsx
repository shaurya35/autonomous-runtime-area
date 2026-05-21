import type { IncidentRun } from "@/lib/api";

interface Props {
  run: IncidentRun;
}

function LabelValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-caption)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-text-muted)",
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-sm)",
        color: "var(--color-text-secondary)",
      }}>
        {children}
      </span>
    </div>
  );
}

export function IncidentContext({ run }: Props) {
  return (
    <div style={{
      padding: "1rem",
      borderBottom: "1px solid var(--color-border-soft)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-caption)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-text-muted)",
      }}>
        Context
      </span>
      <LabelValue label="Run">{run.run_id.slice(0, 8)}</LabelValue>
      <LabelValue label="App">{run.app}</LabelValue>
      <LabelValue label="Incident">{run.incident_id}</LabelValue>
      <LabelValue label="Agent">claude-sonnet-4.6</LabelValue>
    </div>
  );
}
