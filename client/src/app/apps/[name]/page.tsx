import { getApps, getIncidents } from "@/lib/api";

export default async function AppPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const [apps, incidents] = await Promise.all([getApps(), getIncidents()]);
  const appInfo = apps.find((a) => a.name === name);
  const appIncidents = incidents.filter((r) => r.app === name);

  if (!appInfo) return <p className="text-zinc-500">App not found: {name}</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100 mb-1">{appInfo.name}</h1>
      <p className="text-zinc-500 text-sm font-mono mb-6">{appInfo.source_root} · {appInfo.language}</p>
      <h2 className="text-lg font-bold text-zinc-100 mb-3">Incident History</h2>
      {appIncidents.length === 0 ? (
        <p className="text-zinc-500 text-sm">No incidents run against this app yet.</p>
      ) : (
        <ul className="space-y-2">
          {appIncidents.map((r) => (
            <li key={r.run_id}>
              <a href={`/incidents/${r.run_id}`} className="text-green-400 hover:underline font-mono text-sm">
                {r.run_id} — {r.incident_id} — score: {r.score?.toFixed(3) ?? "?"} — {r.status}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
