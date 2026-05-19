interface Stats {
  solved_easy: number; total_easy: number;
  solved_medium: number; total_medium: number;
  solved_hard: number; total_hard: number;
  avg_mttr_s: number;
}

interface Props {
  stats: Stats;
}

export function ScoreboardStats({ stats }: Props) {
  const items = [
    { label: "Easy solved",   value: `${stats.solved_easy}/${stats.total_easy}`,     color: "#10b981" },
    { label: "Medium solved", value: `${stats.solved_medium}/${stats.total_medium}`, color: "#f59e0b" },
    { label: "Hard solved",   value: `${stats.solved_hard}/${stats.total_hard}`,     color: "#ef4444" },
    { label: "Avg MTTR",      value: `${stats.avg_mttr_s.toFixed(0)}s`,              color: "var(--color-doctor)" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {items.map(item => (
        <div key={item.label} style={{
          background: "var(--color-bg-elevated)", borderRadius: 10, padding: "0.75rem 1rem",
          border: "1px solid var(--color-border-soft)", minWidth: 100,
        }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700, color: item.color }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
