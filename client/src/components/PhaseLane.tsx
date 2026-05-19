"use client";

import { Search, Stethoscope, Wrench, ClipboardCheck } from "lucide-react";
import type { ChannelEvent } from "@/lib/api";
import { EventCard } from "@/components/EventCard";
import { PatchView } from "@/components/PatchView";

type Phase = "detecting" | "diagnosing" | "fixing" | "verifying";

interface Props {
  phase: Phase;
  events: ChannelEvent[];
  isActive: boolean;
  onEventClick: (event: ChannelEvent) => void;
}

const PHASE_CONFIG: Record<Phase, { icon: React.ReactNode; color: string; label: string }> = {
  detecting:  { icon: <Search size={14} />,         color: "var(--color-phase-detect)",   label: "Detecting" },
  diagnosing: { icon: <Stethoscope size={14} />,    color: "var(--color-phase-diagnose)", label: "Diagnosing" },
  fixing:     { icon: <Wrench size={14} />,          color: "var(--color-phase-treat)",    label: "Treating" },
  verifying:  { icon: <ClipboardCheck size={14} />,  color: "var(--color-phase-verify)",   label: "Verifying" },
};

export function PhaseLane({ phase, events, isActive, onEventClick }: Props) {
  const cfg = PHASE_CONFIG[phase];
  const filtered = events.filter(e => e.phase === phase && (e.type === "thought" || e.type === "tool_call" || e.type === "tool_result" || e.type === "error"));

  return (
    <div style={{
      background: "var(--color-bg-panel)",
      border: `1px solid ${isActive ? cfg.color : "var(--color-border-soft)"}`,
      borderRadius: 10,
      overflow: "hidden",
      transition: "border-color 600ms cubic-bezier(0.4,0,0.2,1)",
      boxShadow: isActive ? `0 0 24px ${cfg.color}33` : undefined,
    }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-border-soft)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
        {filtered.length > 0 && (
          <span style={{ marginLeft: "auto", fontSize: "0.6875rem", background: `${cfg.color}22`, color: cfg.color, borderRadius: 999, padding: "1px 6px" }}>{filtered.length}</span>
        )}
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4, minHeight: 60 }}>
        {filtered.length === 0 && (
          <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", fontStyle: "italic", padding: "4px 0" }}>
            <span style={{ animation: isActive ? "pulse 1.5s ease-in-out infinite" : undefined }}>waiting…</span>
          </div>
        )}
        {filtered.map((ev, i) => (
          ev.type === "tool_call" && ev.tool_name === "propose_patch"
            ? <PatchView key={i} event={ev} />
            : <EventCard key={i} event={ev} onClick={() => onEventClick(ev)} />
        ))}
      </div>
    </div>
  );
}
