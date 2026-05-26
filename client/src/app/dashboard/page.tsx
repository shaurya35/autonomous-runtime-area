"use client";

import { useEffect, useState } from "react";
import { getMe, listWorkspaceApps, listWorkspaces, setActiveWorkspaceId, type Workspace } from "@/lib/auth";
import { WardHeader } from "@/components/WardHeader";
import { AdmissionsTable } from "@/components/AdmissionsTable";
import { getIncidents } from "@/lib/api";
import type { IncidentRun } from "@/lib/api";

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [connectedWorkspaces, setConnectedWorkspaces] = useState<Set<number>>(new Set());
  const [runs, setRuns] = useState<IncidentRun[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getMe()
      .then(() => setAuthed(true))
      .catch(() => { setAuthed(false); window.location.href = "/login"; });
  }, []);

  useEffect(() => {
    if (!authed) return;
    listWorkspaces().then(ws => {
      setWorkspaces(ws);
      if (ws.length > 0) {
        setActiveWs(ws[0]);
        setActiveWorkspaceId(ws[0].id);
        Promise.all(
          ws.map(async w => {
            const apps = await listWorkspaceApps(w.id).catch(() => []);
            return [w.id, apps.some(a => a.connected_at != null)] as const;
          })
        ).then(results => {
          setConnectedWorkspaces(new Set(results.filter(([, connected]) => connected).map(([id]) => id)));
        });
      }
    }).catch(() => {});
    getIncidents().then(setRuns).catch(() => {});
  }, [authed]);

  if (authed === null) {
    return <div style={{ padding: "2rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>Loading…</div>;
  }

  if (workspaces.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "6rem auto", padding: "0 1.5rem", fontFamily: "var(--font-mono)" }}>
        <div style={{ color: "var(--color-text-primary)", fontSize: "var(--text-h2)", marginBottom: "0.75rem" }}>No workspaces yet</div>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginBottom: "1.5rem" }}>
          Set up Sentinel to monitor your first app.
        </p>
        <a href="/onboard" style={{
          background: "var(--color-accent)", color: "#000", textDecoration: "none",
          padding: "0.5rem 1rem", borderRadius: 4, fontSize: "var(--text-sm)", fontWeight: 600,
        }}>
          Start onboarding →
        </a>
      </div>
    );
  }

  const activeIncidents = runs.filter(r => r.status === "running").length;
  const wsConnected = activeWs ? connectedWorkspaces.has(activeWs.id) : false;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
      {/* Workspace selector */}
      {workspaces.length > 1 && (
        <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-muted)" }}>workspace:</span>
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => { setActiveWs(ws); setActiveWorkspaceId(ws.id); }}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                background: activeWs?.id === ws.id ? "var(--color-bg-elevated)" : "transparent",
                border: `1px solid ${activeWs?.id === ws.id ? "var(--color-border-strong)" : "transparent"}`,
                borderRadius: 3,
                padding: "2px 8px",
                color: activeWs?.id === ws.id ? "var(--color-text-primary)" : "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              {ws.name}
            </button>
          ))}
        </div>
      )}

      {/* Agent status banner */}
      {activeWs && (
        <div style={{
          background: "var(--color-bg-panel)",
          border: "1px solid var(--color-border-soft)",
          borderRadius: 6,
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-sm)",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: wsConnected ? "var(--color-success)" : "var(--color-warn)",
            display: "inline-block", flexShrink: 0,
          }} />
          <span style={{ color: "var(--color-text-secondary)" }}>
            {activeWs.name}
          </span>
          <span style={{ color: "var(--color-text-dim)" }}>·</span>
          <span style={{ color: "var(--color-text-muted)" }}>
            fix mode: <strong style={{ color: "var(--color-text-secondary)" }}>{activeWs.fix_mode}</strong>
          </span>
          <span style={{ flex: 1 }} />
          {!wsConnected && (
            <a href="/onboard" style={{ color: "var(--color-accent)", fontSize: "var(--text-caption)", textDecoration: "none" }}>
              install agent →
            </a>
          )}
        </div>
      )}

      <WardHeader appCount={0} activeIncidents={activeIncidents} />

      <div style={{ background: "var(--color-bg-panel)", border: "1px solid var(--color-border-soft)", borderRadius: 6, overflow: "hidden", marginTop: "1.5rem" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border-soft)", fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "var(--text-caption)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Recent Incidents
        </div>
        <AdmissionsTable runs={runs} />
      </div>
    </div>
  );
}
