"use client";
import { useRouter } from "next/navigation";
import { ScoreboardGrid } from "./ScoreboardGrid";

interface Props {
  rows: { app: string; cells: { incident_id: string; best_score: number | null; runs: number }[] }[];
  incidentIds: string[];
}

export function LeaderboardClient({ rows, incidentIds }: Props) {
  const router = useRouter();
  return (
    <ScoreboardGrid
      rows={rows}
      incidentIds={incidentIds}
      onCellClick={(app, _incidentId) => {
        router.push(`/apps/${app}`);
      }}
    />
  );
}
