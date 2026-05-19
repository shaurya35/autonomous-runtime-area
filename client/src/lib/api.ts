const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  phases_reached: string[];
  stream_url: string;
}

export type Phase = "detecting" | "diagnosing" | "fixing" | "verifying" | "done" | "failed";

export interface ChannelEvent {
  ts: number;
  run_id: string;
  incident_id: string;
  phase: Phase;
  type: "thought" | "tool_call" | "tool_result" | "error" | "score" | "summary";
  payload: Record<string, unknown>;
  // Convenience fields extracted from payload for component use
  content?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_result?: unknown;
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

export function deriveStatus(vitals: VitalSigns | null): Status {
  if (!vitals) return "healthy";
  const v = vitals.vitals;
  const errLast = v.error_rate_pct.at(-1) ?? 0;
  const p99Last = v.p99_latency_ms.at(-1) ?? 0;
  if (errLast >= 5 || p99Last >= 500) return "critical";
  if (errLast >= 0.5 || p99Last >= 200) return "watch";
  return "healthy";
}

async function fetchJSON<T>(path: string): Promise<T> {
  try {
    const r = await fetch(`${API}${path}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  } catch {
    return [] as unknown as T;
  }
}

export const getApps = () => fetchJSON<AppSummary[]>("/apps");
export const getIncidents = () => fetchJSON<IncidentRun[]>("/incidents");
export const getIncident = (id: string) => fetchJSON<IncidentRun>(`/incidents/${id}`);

export async function startIncident(app: string, incident_id: string): Promise<IncidentRun> {
  const r = await fetch(`${API}/incidents/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ app, incident_id }),
  });
  return r.json();
}

export const getApp = (name: string) =>
  fetchJSON<AppSummary>(`/apps/${name}`);

export const getAppIncidents = (name: string) =>
  fetchJSON<IncidentMeta[]>(`/apps/${name}/incidents`);

export const getAppVitals = (name: string, opts: { since?: number; simulate?: boolean } = {}) => {
  const qs = new URLSearchParams({
    since: String(opts.since ?? 60),
    simulate: String(opts.simulate ?? true),
  });
  return fetchJSON<VitalSigns>(`/apps/${name}/vitals?${qs}`);
};

export const injectIncident = (name: string, incidentId: string) =>
  fetch(`${API}/apps/${name}/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ incident_id: incidentId }),
  }).then(r => r.json());

export const healPatient = (name: string, incidentId: string) =>
  fetch(`${API}/apps/${name}/heal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ incident_id: incidentId }),
  }).then(r => r.json());

export const startIncidentRun = (app: string, incidentId: string) =>
  startIncident(app, incidentId);

export const getLeaderboard = () =>
  fetchJSON<LeaderboardData>(`/leaderboard`);

export const seedDemo = () =>
  fetch(`${API}/demo/seed`, { method: "POST" }).then(r => r.json());
