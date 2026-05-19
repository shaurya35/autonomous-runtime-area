import { getIncidents } from "@/lib/api";

export default async function LeaderboardPage() {
  const incidents = await getIncidents();
  const sorted = [...incidents].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100 mb-4">Leaderboard</h1>
      {sorted.length === 0 ? (
        <p className="text-zinc-500 text-sm">No runs yet.</p>
      ) : (
        <table className="w-full text-sm font-mono border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="text-left py-2 pr-4">Run ID</th>
              <th className="text-left py-2 pr-4">App</th>
              <th className="text-left py-2 pr-4">Incident</th>
              <th className="text-left py-2 pr-4">Score</th>
              <th className="text-left py-2 pr-4">MTTR</th>
              <th className="text-left py-2">Phases</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.run_id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="py-2 pr-4"><a href={`/incidents/${r.run_id}`} className="text-green-400 hover:underline">{r.run_id}</a></td>
                <td className="py-2 pr-4 text-zinc-300">{r.app}</td>
                <td className="py-2 pr-4 text-zinc-300">{r.incident_id}</td>
                <td className="py-2 pr-4 font-bold text-green-400">{r.score?.toFixed(3) ?? "—"}</td>
                <td className="py-2 pr-4 text-zinc-300">{r.mttr_s?.toFixed(1) ?? "—"}s</td>
                <td className="py-2 text-zinc-500 text-xs">{r.phases_reached?.join(", ") ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
