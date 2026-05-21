"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Auth API calls ─────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  plan: string;
}

export interface Workspace {
  id: number;
  name: string;
  api_key: string;
  fix_mode: "approve" | "auto";
  threshold: number;
  created_at: number;
}

export interface WorkspaceApp {
  id: number;
  workspace_id: number;
  name: string;
  health_url: string;
  metrics_url: string;
  logs_service: string;
  connected_at: number | null;
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    ...opts,
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw { status: r.status, message: body.detail ?? "Request failed" };
  }
  return r.json();
}

export const getMe = () => apiFetch<User>("/auth/me");

export const signup = (email: string, password: string) =>
  apiFetch<User>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });

export const login = (email: string, password: string) =>
  apiFetch<User>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const logout = () =>
  apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });

// ── Workspaces ─────────────────────────────────────────────────────────────────

export const createWorkspace = (name: string) =>
  apiFetch<Workspace>("/workspaces", { method: "POST", body: JSON.stringify({ name }) });

export const listWorkspaces = () =>
  apiFetch<Workspace[]>("/workspaces");

export const getWorkspace = (id: number) =>
  apiFetch<Workspace>(`/workspaces/${id}`);

export const updateWorkspace = (id: number, fields: { fix_mode?: string; threshold?: number }) =>
  apiFetch<Workspace>(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(fields) });

export const registerWorkspaceApp = (
  wsId: number,
  app: { name: string; health_url: string; metrics_url: string; logs_service?: string },
) =>
  apiFetch<WorkspaceApp>(`/workspaces/${wsId}/apps`, {
    method: "POST",
    body: JSON.stringify(app),
  });

export const listWorkspaceApps = (wsId: number) =>
  apiFetch<WorkspaceApp[]>(`/workspaces/${wsId}/apps`);

// ── Active workspace (localStorage) ───────────────────────────────────────────

export function getActiveWorkspaceId(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem("activeWorkspace");
  return v ? Number(v) : null;
}

export function setActiveWorkspaceId(id: number): void {
  if (typeof window !== "undefined") localStorage.setItem("activeWorkspace", String(id));
}
