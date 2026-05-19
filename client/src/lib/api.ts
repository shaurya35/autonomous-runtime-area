const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

export interface AppSummary {
  name: string;
  language: string;
  source_root: string;
}

export interface IncidentRun {
  run_id: string;
  app: string;
  incident_id: string;
  status: "running" | "done" | "failed";
  score: number | null;
  mttr_s: number | null;
}

export interface IncidentMeta {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category: "code" | "config" | "resource" | "network" | "integration";
}

export interface VitalSigns {
  ts_end: number;
  samples_per_second: number;
  vitals: {
    req_per_sec: number[];
    p99_latency_ms: number[];
    error_rate_pct: number[];
    cpu_pct: number[];
  };
}

export interface LeaderboardData {
  rows: { app: string; cells: { incident_id: string; best_score: number | null; runs: number }[] }[];
  incident_ids: string[];
  stats: {
    solved_easy: number; total_easy: number;
    solved_medium: number; total_medium: number;
    solved_hard: number; total_hard: number;
    avg_mttr_s: number;
  };
}

export type Status = "healthy" | "watch" | "critical" | "recovering" | "discharged";

export const getApps = () => fetchJSON<AppSummary[]>("/apps");
export const getApp = (name: string) => fetchJSON<AppSummary>(`/apps/${name}`);
export const getIncidents = () => fetchJSON<IncidentRun[]>("/incidents");

export const getAppIncidents = (name: string) => fetchJSON<IncidentMeta[]>(`/apps/${name}/incidents`);

export const getAppVitals = (name: string, opts: { since?: number; simulate?: boolean } = {}) => {
  const qs = new URLSearchParams({ since: String(opts.since ?? 60), simulate: String(opts.simulate ?? true) });
  return fetchJSON<VitalSigns>(`/apps/${name}/vitals?${qs}`);
};

export const getLeaderboard = () => fetchJSON<LeaderboardData>("/leaderboard");

export const startIncidentRun = (app: string, incidentId: string) =>
  fetch(`${API}/incidents/start`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ app, incident_id: incidentId }),
  }).then(r => r.json());

export function deriveStatus(vitals: VitalSigns | null): Status {
  if (!vitals) return "healthy";
  const v = vitals.vitals;
  const errLast = v.error_rate_pct.at(-1) ?? 0;
  const p99Last = v.p99_latency_ms.at(-1) ?? 0;
  if (errLast >= 5 || p99Last >= 500) return "critical";
  if (errLast >= 0.5 || p99Last >= 200) return "watch";
  return "healthy";
}
