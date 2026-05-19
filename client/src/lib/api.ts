export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ChannelEvent {
  type: "thought" | "tool_call" | "tool_result" | "error" | "phase";
  phase?: string;
  content?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_result?: unknown;
  ts?: number;
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

export interface AppInfo {
  name: string;
  language: string;
  description: string;
  incidents: string[];
}

export interface LeaderboardEntry {
  run_id: string;
  app: string;
  incident_id: string;
  score: number;
  mttr_s: number;
  phases_reached: string[];
  created_at: string;
}

export async function getIncident(runId: string): Promise<IncidentRun> {
  const res = await fetch(`${API}/runs/${runId}`);
  if (!res.ok) throw new Error(`Failed to fetch run ${runId}`);
  return res.json();
}

export async function getAppIncidents(appName: string): Promise<string[]> {
  const res = await fetch(`${API}/apps/${appName}/incidents`);
  if (!res.ok) throw new Error(`Failed to fetch incidents for ${appName}`);
  return res.json();
}

export async function getAppVitals(appName: string): Promise<VitalSigns> {
  const res = await fetch(`${API}/apps/${appName}/vitals`);
  if (!res.ok) throw new Error(`Failed to fetch vitals for ${appName}`);
  return res.json();
}

export async function injectIncident(appName: string, incidentId: string): Promise<IncidentRun> {
  const res = await fetch(`${API}/apps/${appName}/inject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incident_id: incidentId }),
  });
  if (!res.ok) throw new Error(`Failed to inject incident`);
  return res.json();
}

export async function healPatient(appName: string): Promise<void> {
  await fetch(`${API}/apps/${appName}/heal`, { method: "POST" });
}

export async function startIncidentRun(appName: string, incidentId: string): Promise<IncidentRun> {
  const res = await fetch(`${API}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app: appName, incident_id: incidentId }),
  });
  if (!res.ok) throw new Error(`Failed to start run`);
  return res.json();
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API}/leaderboard`);
  if (!res.ok) throw new Error(`Failed to fetch leaderboard`);
  return res.json();
}

export async function seedDemo(): Promise<void> {
  await fetch(`${API}/seed`, { method: "POST" });
}

export type Status = "healthy" | "watch" | "critical" | "recovery";

export function deriveStatus(vitals: VitalSigns | null): Status {
  if (!vitals) return "healthy";
  const v = vitals.vitals;
  const errRate = v.error_rate_pct.at(-1) ?? 0;
  const p99 = v.p99_latency_ms.at(-1) ?? 0;
  if (errRate >= 5 || p99 >= 500) return "critical";
  if (errRate >= 0.5 || p99 >= 200) return "watch";
  return "healthy";
}
