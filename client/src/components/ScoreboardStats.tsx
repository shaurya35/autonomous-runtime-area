interface Stats {
  solved_easy: number; total_easy: number;
  solved_medium: number; total_medium: number;
  solved_hard: number; total_hard: number;
  avg_mttr_s: number;
  total_runs?: number;
  best_mttr_s?: number;
}

interface Props { stats: Stats }

function Tile({ label, value, sub, color, children }: {
  label: string; value: string; sub?: string; color: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)",
      border: "1px solid var(--color-border-soft)",
      borderRadius: 8,
      padding: "0.875rem 1.125rem",
      flex: "1 1 140px",
      minWidth: 120,
    }}>
      <div style={{
        fontSize: "0.5625rem", color: "var(--color-text-dim)",
        textTransform: "uppercase", letterSpacing: "0.09em",
        fontFamily: "var(--font-mono)", marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "1.375rem",
        fontWeight: 700, color, lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: "0.625rem", color: "var(--color-text-dim)",
          fontFamily: "var(--font-mono)", marginTop: 3,
        }}>
          {sub}
        </div>
      )}
      {children}
    </div>
  );
}

function MiniBar({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
      <span style={{ fontSize: "0.5rem", color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", width: 30 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: "var(--color-bg-subtle)", borderRadius: 2 }}>
        <div style={{
          height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`,
          background: color, borderRadius: 2,
        }} />
      </div>
      <span style={{ fontSize: "0.5rem", color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", width: 24, textAlign: "right" }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function formatMttr(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function ScoreboardStats({ stats }: Props) {
  const totalSolved = stats.solved_easy + stats.solved_medium + stats.solved_hard;
  const totalAll    = stats.total_easy + stats.total_medium + stats.total_hard;
  const solveRate   = totalAll > 0 ? (totalSolved / totalAll) * 100 : 0;

  const easyPct = stats.total_easy   > 0 ? (stats.solved_easy   / stats.total_easy)   * 100 : 0;
  const medPct  = stats.total_medium > 0 ? (stats.solved_medium / stats.total_medium) * 100 : 0;
  const hardPct = stats.total_hard   > 0 ? (stats.solved_hard   / stats.total_hard)   * 100 : 0;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

      {/* Solve Rate */}
      <Tile
        label="Solve Rate"
        value={`${totalSolved}/${totalAll}`}
        sub={`${Math.round(solveRate)}% of incidents resolved`}
        color={totalAll === 0 ? "var(--color-text-dim)" : solveRate >= 70 ? "#10b981" : solveRate >= 40 ? "#f59e0b" : "#ef4444"}
      >
        {totalAll > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 4, background: "var(--color-bg-subtle)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${solveRate}%`, background: "#10b981", borderRadius: 2 }} />
            </div>
            <div style={{ marginTop: 6 }}>
              {stats.total_easy   > 0 && <MiniBar pct={easyPct}  color="#10b981" label="easy" />}
              {stats.total_medium > 0 && <MiniBar pct={medPct}   color="#f59e0b" label="med"  />}
              {stats.total_hard   > 0 && <MiniBar pct={hardPct}  color="#ef4444" label="hard" />}
            </div>
          </div>
        )}
      </Tile>

      {/* Avg MTTR */}
      <Tile
        label="Avg MTTR"
        value={stats.avg_mttr_s > 0 ? formatMttr(stats.avg_mttr_s) : "—"}
        sub="mean time to resolve"
        color="#34d399"
      />

      {/* Best MTTR */}
      <Tile
        label="Best MTTR"
        value={stats.best_mttr_s != null && stats.best_mttr_s > 0 ? formatMttr(stats.best_mttr_s) : "—"}
        sub="fastest resolution"
        color="var(--color-accent)"
      />

      {/* Difficulty spread */}
      <Tile
        label="Difficulty"
        value={`${stats.solved_easy + stats.solved_medium + stats.solved_hard}`}
        sub="incidents solved"
        color="var(--color-text-secondary)"
      >
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          {[
            { label: "E", solved: stats.solved_easy,   total: stats.total_easy,   color: "#10b981" },
            { label: "M", solved: stats.solved_medium, total: stats.total_medium, color: "#f59e0b" },
            { label: "H", solved: stats.solved_hard,   total: stats.total_hard,   color: "#ef4444" },
          ].map(({ label, solved, total, color }) => (
            <div key={label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                fontSize: "0.6875rem", fontFamily: "var(--font-mono)",
                fontWeight: 700, color: total > 0 ? color : "var(--color-text-dim)",
              }}>
                {solved}/{total}
              </div>
              <div style={{
                fontSize: "0.5rem", color: "var(--color-text-dim)",
                fontFamily: "var(--font-mono)", marginTop: 1,
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </Tile>

    </div>
  );
}
