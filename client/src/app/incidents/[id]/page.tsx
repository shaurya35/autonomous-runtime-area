"use client";

import { useEffect, useRef, useState } from "react";
import { useIncidentStream } from "@/lib/sse";
import { getIncident } from "@/lib/api";
import type { IncidentRun, ChannelEvent } from "@/lib/api";
import { OrHeader } from "@/components/OrHeader";
import { ThoughtStream } from "@/components/ThoughtStream";
import { PhaseLane } from "@/components/PhaseLane";
import { LiveVitals } from "@/components/LiveVitals";
import { EvidencePanel } from "@/components/EvidencePanel";
import { DischargeCard } from "@/components/DischargeCard";

export default function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<IncidentRun | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ChannelEvent | null>(null);
  const [showDischarge, setShowDischarge] = useState(false);
  const events = useIncidentStream(runId);

  useEffect(() => {
    params.then(p => setRunId(p.id));
  }, [params]);

  // Initial fetch
  useEffect(() => {
    if (!runId) return;
    getIncident(runId).then(setRun).catch(() => {});
  }, [runId]);

  // Poll run state every 3s while not terminal
  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(() => {
      getIncident(runId).then(r => {
        setRun(r);
        if (r.status === "done" || r.status === "failed") {
          clearInterval(interval);
          if (r.status === "done") setShowDischarge(true);
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [runId]);

  const currentPhase = events.filter(e => e.phase && e.phase !== "done" && e.phase !== "failed").at(-1)?.phase;
  const phases = ["detecting", "diagnosing", "fixing", "verifying"] as const;
  const isRunning = run?.status === "running";

  if (!run) {
    return (
      <div style={{ padding: "2rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>
        {runId ? "Loading case…" : "No case ID provided."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 3rem)", overflow: "hidden" }}>
      <OrHeader run={run} currentPhase={currentPhase} />

      {isRunning && events.length === 0 && (
        <div style={{
          position: "absolute", top: "3.5rem", left: "50%", transform: "translateX(-50%)",
          background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-soft)",
          borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.75rem",
          color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", zIndex: 10,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ animation: "pulse 1.5s ease-in-out infinite", color: "var(--color-watch)" }}>●</span>
          Connecting to agent stream…
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px", gap: 0, flex: 1, overflow: "hidden" }}>
        <div style={{ borderRight: "1px solid var(--color-border-soft)", padding: "1rem", overflowY: "auto", background: "var(--color-bg-subtle)" }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "var(--font-display)" }}>
            Doctor&apos;s Thoughts
          </div>
          <ThoughtStream events={events} />
        </div>

        <div style={{ overflowY: "auto", padding: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {phases.map(phase => (
            <PhaseLane
              key={phase}
              phase={phase}
              events={events}
              isActive={currentPhase === phase}
              onEventClick={setSelectedEvent}
            />
          ))}
        </div>

        <div style={{ borderLeft: "1px solid var(--color-border-soft)", padding: "1rem", background: "var(--color-bg-subtle)" }}>
          <LiveVitals appName={run.app} />
        </div>
      </div>

      {run.status === "failed" && (
        <div style={{
          position: "fixed", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
          background: "var(--color-bg-elevated)", border: "1px solid var(--color-critical)",
          borderRadius: 8, padding: "0.75rem 1.25rem", fontSize: "0.8125rem",
          color: "var(--color-critical)", fontFamily: "var(--font-mono)", zIndex: 10,
        }}>
          ✗ Agent failed — {(run as IncidentRun & { error?: string }).error ?? "unknown error"}
        </div>
      )}

      {selectedEvent && (
        <EvidencePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {showDischarge && run.status === "done" && (
        <DischargeCard run={run} onDismiss={() => setShowDischarge(false)} />
      )}
    </div>
  );
}
