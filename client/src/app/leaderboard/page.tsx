import { getLeaderboard } from "../../lib/api";
import { LeaderboardClient } from "../../components/LeaderboardClient";
import { ScoreChart } from "../../components/ScoreChart";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const data = await getLeaderboard().catch(() => ({
    rows: [], incident_ids: [],
    stats: { solved_easy: 0, total_easy: 0, solved_medium: 0, total_medium: 0, solved_hard: 0, total_hard: 0, avg_mttr_s: 0 },
  }));

  const allCells = data.rows.flatMap(row => row.cells.map(c => ({ ...c, app: row.app })));

  const unsolvedCell = allCells
    .filter(c => c.best_score === null || c.best_score < 0.7)
    .sort((a, b) => {
      if (a.best_score === null && b.best_score !== null) return -1;
      if (a.best_score !== null && b.best_score === null) return 1;
      if (a.best_score !== null && b.best_score !== null) return a.best_score - b.best_score;
      return 0;
    })[0] ?? null;

  const allSolved = data.rows.length > 0 && !unsolvedCell;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>
          leaderboard
        </h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {data.incident_ids.length} incident{data.incident_ids.length !== 1 ? "s" : ""} · {data.rows.length} app{data.rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* All solved banner */}
      {allSolved && (
        <div style={{
          background: "#10b98110", border: "1px solid #10b98133",
          borderRadius: 8, padding: "0.875rem 1.25rem",
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: "1.25rem",
        }}>
          <span style={{ fontSize: "1.25rem" }}>✓</span>
          <div>
            <div style={{ fontSize: "0.6875rem", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
              All Incidents Solved
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
              Every attempted incident has a score ≥ 0.70. Run more incidents to expand the benchmark.
            </div>
          </div>
        </div>
      )}

      {/* Hardest unsolved */}
      {unsolvedCell && (
        <div style={{
          background: "#ef444410", border: "1px solid #ef444433",
          borderRadius: 8, padding: "0.875rem 1.25rem",
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: "1.25rem",
        }}>
          <span style={{ fontSize: "1.25rem" }}>🔥</span>
          <div>
            <div style={{ fontSize: "0.6875rem", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
              Hardest Unsolved
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--color-text-primary)" }}>
              {unsolvedCell.incident_id} on <span style={{ color: "var(--color-accent)" }}>{unsolvedCell.app}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 2 }}>
              Best attempt:{" "}
              <span style={{ fontFamily: "var(--font-mono)", color: unsolvedCell.best_score !== null ? "#ef4444" : "var(--color-text-dim)" }}>
                {unsolvedCell.best_score !== null ? unsolvedCell.best_score.toFixed(2) : "never attempted"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Score chart — per-incident best scores */}
      {data.rows.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <ScoreChart rows={data.rows} incidentIds={data.incident_ids} />
        </div>
      )}

      {/* Benchmark grid */}
      <div style={{ background: "var(--color-bg-panel)", border: "1px solid var(--color-border-soft)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border-soft)", fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "var(--text-caption)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Benchmark Results
        </div>
        <LeaderboardClient rows={data.rows} incidentIds={data.incident_ids} />
      </div>

    </div>
  );
}
