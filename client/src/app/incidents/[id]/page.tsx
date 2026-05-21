"use client";

import { useEffect, useState } from "react";
import { useIncidentStream, useAppVitals } from "@/lib/sse";
import { getIncident } from "@/lib/api";
import type { IncidentRun } from "@/lib/api";
import { OrHeader } from "@/components/OrHeader";
import { PhaseProgressBar } from "@/components/PhaseProgressBar";
import { EventTimeline } from "@/components/EventTimeline";
import { IncidentContext } from "@/components/IncidentContext";
import { VitalsPanel } from "@/components/VitalsPanel";
import { OutcomeCard } from "@/components/OutcomeCard";

export default function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<IncidentRun | null>(null);

  const events = useIncidentStream(runId);
  const vitals = useAppVitals(run?.app ?? null);

  useEffect(() => {
    params.then(p => setRunId(p.id));
  }, [params]);

  // Initial fetch
  useEffect(() => {
    if (!runId) return;
    getIncident(runId).then(setRun).catch(() => {});
  }, [runId]);

  // Poll every 3s while not terminal
  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(() => {
      getIncident(runId).then(r => {
        setRun(r);
        if (r.status === "done" || r.status === "failed") {
          clearInterval(interval);
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [runId]);

  const currentPhase = events.filter(e => e.phase && e.phase !== "done" && e.phase !== "failed").at(-1)?.phase;
  const isRunning = run?.status === "running";
  const isTerminal = run?.status === "done" || run?.status === "failed";

  if (!run) {
    return (
      <div style={{ padding: "2rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
        {runId ? "Loading…" : "No run ID."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 3rem)", overflow: "hidden" }}>
      {/* Header */}
      <OrHeader run={run} currentPhase={currentPhase} />

      {/* Phase progress bar */}
      <PhaseProgressBar events={events} status={run.status} />

      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Event timeline — the centerpiece */}
        <EventTimeline events={events} isRunning={isRunning} />

        {/* Right rail */}
        <div style={{
          width: 268,
          flexShrink: 0,
          borderLeft: "1px solid var(--color-border-soft)",
          background: "var(--color-bg-subtle)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}>
          <IncidentContext run={run} />

          {/* Vitals */}
          <div style={{ padding: "1rem", borderBottom: "1px solid var(--color-border-soft)" }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-caption)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-text-muted)",
              display: "block",
              marginBottom: 14,
            }}>
              Live Metrics
            </span>
            <VitalsPanel vitals={vitals} variant="large" />
          </div>

          {/* Outcome — only shown when terminal */}
          {isTerminal && <OutcomeCard run={run} />}
        </div>
      </div>
    </div>
  );
}
