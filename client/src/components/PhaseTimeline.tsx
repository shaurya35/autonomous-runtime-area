"use client";
import { useState } from "react";
import type { ChannelEvent, Phase } from "@/lib/api";
import { EvidencePanel } from "./EvidencePanel";
import { useIncidentStream } from "@/lib/sse";

const PHASES: Phase[] = ["detecting", "diagnosing", "fixing", "verifying"];

const PHASE_COLORS: Record<string, string> = {
  detecting: "border-blue-500/30 bg-blue-950/20",
  diagnosing: "border-yellow-500/30 bg-yellow-950/20",
  fixing: "border-orange-500/30 bg-orange-950/20",
  verifying: "border-green-500/30 bg-green-950/20",
};

function EventCard({ event, onClick }: { event: ChannelEvent; onClick: () => void }) {
  const isError = event.type === "tool_result" && (event.payload as Record<string, unknown> & { result?: { error?: unknown } })?.result?.error;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2 rounded border text-xs font-mono mb-1 hover:brightness-110 transition-all ${
        event.type === "thought" ? "border-zinc-700 bg-zinc-900 text-zinc-300" :
        event.type === "tool_call" ? "border-blue-800 bg-blue-950/40 text-blue-300" :
        isError ? "border-red-800 bg-red-950/40 text-red-300" :
        "border-green-800 bg-green-950/40 text-green-300"
      }`}
    >
      <span className="text-zinc-500">{event.type}</span>
      {event.type === "tool_call" && <span className="ml-1 text-blue-400">{String((event.payload as Record<string, unknown>).tool ?? "")}</span>}
      {event.type === "thought" && <span className="ml-1 truncate">{String((event.payload as Record<string, unknown>).text ?? "").slice(0, 60)}</span>}
    </button>
  );
}

export function PhaseTimeline({ runId }: { runId: string }) {
  const events = useIncidentStream(runId);
  const [selected, setSelected] = useState<ChannelEvent | null>(null);

  const byPhase = PHASES.reduce((acc, p) => {
    acc[p] = events.filter((e) => e.phase === p);
    return acc;
  }, {} as Record<Phase, ChannelEvent[]>);

  const activePhase = events.length > 0 ? events[events.length - 1].phase : null;

  return (
    <div className="grid grid-cols-4 gap-3">
      {PHASES.map((phase) => (
        <div key={phase} className={`border rounded-lg p-3 ${PHASE_COLORS[phase] ?? ""}`}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-mono text-sm text-zinc-300 capitalize">{phase}</h3>
            {activePhase === phase && (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
          </div>
          <div className="space-y-1">
            {byPhase[phase].map((ev, i) => (
              <EventCard key={i} event={ev} onClick={() => setSelected(ev)} />
            ))}
            {byPhase[phase].length === 0 && (
              <p className="text-xs text-zinc-600 font-mono italic">waiting...</p>
            )}
          </div>
        </div>
      ))}
      {selected && <EvidencePanel event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
