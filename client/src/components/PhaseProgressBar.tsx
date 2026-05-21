"use client";

import type { ChannelEvent } from "@/lib/api";

const PHASES = ["detecting", "diagnosing", "fixing", "verifying"] as const;
type Phase = (typeof PHASES)[number];

interface Props {
  events: ChannelEvent[];
  status: string;
}

export function PhaseProgressBar({ events, status }: Props) {
  const phaseTimes: Partial<Record<Phase, number>> = {};
  for (const ev of events) {
    const p = ev.phase as Phase;
    if (PHASES.includes(p) && !phaseTimes[p]) {
      phaseTimes[p] = ev.ts;
    }
  }

  const latestPhase = [...PHASES].reverse().find(p => phaseTimes[p]);

  return (
    <div style={{
      display: "flex",
      height: 40,
      background: "var(--color-bg-panel)",
      borderBottom: "1px solid var(--color-border-soft)",
      flexShrink: 0,
    }}>
      {PHASES.map((phase, i) => {
        const reached = !!phaseTimes[phase];
        const isCurrent = latestPhase === phase && status === "running";
        const isDone = reached && !isCurrent;

        const color = isCurrent ? "var(--color-accent)"
          : isDone ? "var(--color-success)"
          : "var(--color-text-dim)";

        return (
          <div key={phase} style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRight: i < 3 ? "1px solid var(--color-border-soft)" : undefined,
            background: isCurrent ? "rgba(34,211,238,0.05)"
              : isDone ? "rgba(16,185,129,0.05)"
              : "transparent",
            transition: "background 400ms ease",
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: color,
              flexShrink: 0,
              animation: isCurrent ? "phasePulse 1.5s ease-in-out infinite" : undefined,
            }} />
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-caption)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color,
            }}>
              {phase}
            </span>
          </div>
        );
      })}
      <style>{`@keyframes phasePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
