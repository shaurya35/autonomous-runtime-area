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
  const fetchingRef = useRef(false);
  const events = useIncidentStream(runId);

  useEffect(() => {
    params.then(p => setRunId(p.id));
  }, [params]);

  useEffect(() => {
    if (!runId) return;
    getIncident(runId).then(setRun).catch(() => {});
  }, [runId]);

  // Poll for final run state when stream signals completion. Guard against duplicate fetches.
  useEffect(() => {
    if (!run || run.status === "done" || fetchingRef.current) return;
    const latest = events.at(-1);
    if (latest?.phase === "done") {
      fetchingRef.current = true;
      getIncident(run.run_id).then(r => {
        setRun(r);
        if (r.status === "done") setShowDischarge(true);
      }).finally(() => { fetchingRef.current = false; });
    }
  }, [events, run]);

  useEffect(() => {
    if (run?.status === "done") setShowDischarge(true);
  }, [run?.status]);

  const currentPhase = events.filter(e => e.phase && e.phase !== "done" && e.phase !== "failed").at(-1)?.phase;
  const phases = ["detecting", "diagnosing", "fixing", "verifying"] as const;

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

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px", gap: 0, flex: 1, overflow: "hidden" }}>
        <div style={{ borderRight: "1px solid var(--color-border-soft)", padding: "1rem", overflowY: "auto", background: "var(--color-bg-subtle)" }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "var(--font-display)" }}>
            Doctor's Thoughts
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

      {selectedEvent && (
        <EvidencePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {showDischarge && run.status === "done" && (
        <DischargeCard run={run} onDismiss={() => setShowDischarge(false)} />
      )}
    </div>
  );
}
