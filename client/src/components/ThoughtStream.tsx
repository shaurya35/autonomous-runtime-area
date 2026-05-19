"use client";

import type { ChannelEvent } from "@/lib/api";

interface Props {
  events: ChannelEvent[];
  maxItems?: number;
}

export function ThoughtStream({ events, maxItems = 8 }: Props) {
  const thoughts = events.filter(e => e.type === "thought").slice(-maxItems);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {thoughts.length === 0 && (
        <div style={{ color: "var(--color-text-dim)", fontSize: "0.75rem", fontStyle: "italic" }}>Waiting for doctor's thoughts…</div>
      )}
      {[...thoughts].reverse().map((ev, i) => (
        <div key={i} style={{
          padding: "8px 10px",
          background: "var(--color-bg-subtle)",
          borderRadius: 8,
          borderLeft: "2px solid var(--color-doctor)",
          animation: i === 0 ? "slideDown 400ms ease-out" : undefined,
        }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--color-text-dim)", marginBottom: 2 }}>
            {ev.ts ? `${Math.round(Date.now() / 1000 - ev.ts)}s ago` : ""}
          </div>
          <div style={{ fontSize: "0.8125rem", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", fontStyle: "italic" }}>
            {(ev.content ?? "").slice(0, 120)}{(ev.content?.length ?? 0) > 120 ? "…" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
