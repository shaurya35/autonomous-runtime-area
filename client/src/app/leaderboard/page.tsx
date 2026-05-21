import { getLeaderboard } from "../../lib/api";
import { ScoreboardStats } from "../../components/ScoreboardStats";
import { HardestUnsolved } from "../../components/HardestUnsolved";
import { LeaderboardClient } from "../../components/LeaderboardClient";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const data = await getLeaderboard().catch(() => ({
    rows: [], incident_ids: [],
    stats: { solved_easy: 0, total_easy: 0, solved_medium: 0, total_medium: 0, solved_hard: 0, total_hard: 0, avg_mttr_s: 0 }
  }));

  let hardestApp: string | null = null;
  let hardestId: string | null = null;
  let hardestScore: number | null | undefined = undefined;
  for (const row of data.rows) {
    for (const cell of row.cells) {
      const isWorse =
        hardestScore === undefined ||
        (cell.best_score === null && hardestScore !== null) ||
        (cell.best_score !== null && hardestScore !== null && cell.best_score < hardestScore);
      if (isWorse) {
        hardestApp = row.app;
        hardestId = cell.incident_id;
        hardestScore = cell.best_score;
      }
    }
  }
  const resolvedScore = hardestScore === undefined ? null : hardestScore;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>leaderboard</h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {data.incident_ids.length} incidents · {data.rows.length} apps
        </div>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <ScoreboardStats stats={data.stats} />
      </div>

      {hardestId && (
        <div style={{ marginBottom: "1.5rem" }}>
          <HardestUnsolved incidentId={hardestId} app={hardestApp} bestScore={resolvedScore} />
        </div>
      )}

      <div style={{ background: "var(--color-bg-panel)", border: "1px solid var(--color-border-soft)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border-soft)", fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "var(--text-caption)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Benchmark Results
        </div>
        <LeaderboardClient rows={data.rows} incidentIds={data.incident_ids} />
      </div>
    </div>
  );
}
