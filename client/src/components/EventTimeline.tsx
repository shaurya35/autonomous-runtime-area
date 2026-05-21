"use client";

import { useEffect, useRef, useState } from "react";
import type { ChannelEvent } from "@/lib/api";
import { ToolCallRow } from "@/components/ToolCallRow";

type DisplayItem =
  | { kind: "phase-divider"; phase: string; startTs: number; endTs?: number }
  | { kind: "thought"; event: ChannelEvent }
  | { kind: "tool-pair"; call: ChannelEvent; result?: ChannelEvent; isPatch: boolean }
  | { kind: "error"; event: ChannelEvent };

function buildDisplayItems(events: ChannelEvent[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let currentPhase: string | null = null;
  let lastDivider: Extract<DisplayItem, { kind: "phase-divider" }> | null = null;
  // key: tool_name → index of that tool-pair item in items array
  const pendingCalls = new Map<string, number>();

  for (const ev of events) {
    const p = ev.phase;
    // Phase transition
    if (p !== currentPhase && p !== "done" && p !== "failed" && p) {
      if (lastDivider) lastDivider.endTs = ev.ts;
      const divider: Extract<DisplayItem, { kind: "phase-divider" }> = {
        kind: "phase-divider", phase: p, startTs: ev.ts,
      };
      items.push(divider);
      lastDivider = divider;
      currentPhase = p;
    }

    if (ev.type === "thought") {
      items.push({ kind: "thought", event: ev });
    } else if (ev.type === "tool_call") {
      const isPatch = ev.tool_name === "propose_patch";
      const item: Extract<DisplayItem, { kind: "tool-pair" }> = {
        kind: "tool-pair", call: ev, result: undefined, isPatch,
      };
      pendingCalls.set(ev.tool_name ?? "_", items.length);
      items.push(item);
    } else if (ev.type === "tool_result") {
      const idx = pendingCalls.get(ev.tool_name ?? "_");
      if (idx !== undefined) {
        const item = items[idx];
        if (item?.kind === "tool-pair") {
          (item as Extract<DisplayItem, { kind: "tool-pair" }>).result = ev;
          pendingCalls.delete(ev.tool_name ?? "_");
        }
      }
    } else if (ev.type === "error") {
      items.push({ kind: "error", event: ev });
    }
  }

  return items;
}

function fmtRelTs(ts: number, baseTs: number): string {
  const s = Math.max(0, Math.round(ts - baseTs));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function fmtDuration(start: number, end?: number): string {
  if (!end) return "";
  const s = Math.max(0, Math.round(end - start));
  return `${s}s`;
}

interface Props {
  events: ChannelEvent[];
  isRunning: boolean;
}

export function EventTimeline({ events, isRunning }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);

  const baseTs = events[0]?.ts ?? 0;

  useEffect(() => {
    if (autoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    autoScrollRef.current = atBottom;
    setAutoScroll(atBottom);
  }

  function backToLive() {
    autoScrollRef.current = true;
    setAutoScroll(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const items = buildDisplayItems(events);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem" }}
      >
        {events.length === 0 && isRunning && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            color: "var(--color-text-dim)", fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)", padding: "0.5rem 0",
          }}>
            <span style={{ animation: "tlPulse 1.5s ease-in-out infinite", color: "var(--color-warn)", fontSize: 8 }}>●</span>
            waiting for first signal…
          </div>
        )}

        {events.length === 0 && !isRunning && (
          <div style={{ color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", padding: "0.5rem 0" }}>
            No events recorded.
          </div>
        )}

        {items.map((item, i) => {
          if (item.kind === "phase-divider") {
            const dur = fmtDuration(item.startTs, item.endTs);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                margin: "1.25rem 0 0.75rem",
              }}>
                <div style={{ flex: 1, height: 1, background: "var(--color-border-soft)" }} />
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                }}>
                  {item.phase}
                  {dur && (
                    <span style={{ color: "var(--color-text-dim)", marginLeft: 6 }}>{dur}</span>
                  )}
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--color-border-soft)" }} />
              </div>
            );
          }

          if (item.kind === "thought") {
            return (
              <div key={i} style={{ display: "flex", gap: 14, padding: "3px 0" }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6875rem",
                  color: "var(--color-text-dim)",
                  flexShrink: 0,
                  paddingTop: 2,
                  width: 36,
                  textAlign: "right",
                }}>
                  {item.event.ts ? fmtRelTs(item.event.ts, baseTs) : ""}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-muted)",
                  fontStyle: "italic",
                  lineHeight: 1.6,
                  flex: 1,
                }}>
                  {item.event.content ?? ""}
                </span>
              </div>
            );
          }

          if (item.kind === "tool-pair") {
            return (
              <div key={i} style={{ display: "flex", gap: 14, padding: "3px 0" }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6875rem",
                  color: "var(--color-text-dim)",
                  flexShrink: 0,
                  paddingTop: 8,
                  width: 36,
                  textAlign: "right",
                }}>
                  {item.call.ts ? fmtRelTs(item.call.ts, baseTs) : ""}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ToolCallRow call={item.call} result={item.result} isPatch={item.isPatch} />
                </div>
              </div>
            );
          }

          if (item.kind === "error") {
            return (
              <div key={i} style={{ display: "flex", gap: 14, padding: "3px 0" }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6875rem",
                  color: "var(--color-text-dim)",
                  flexShrink: 0,
                  paddingTop: 2,
                  width: 36,
                  textAlign: "right",
                }}>
                  {item.event.ts ? fmtRelTs(item.event.ts, baseTs) : ""}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-critical)",
                  borderLeft: "2px solid var(--color-critical)",
                  paddingLeft: 10,
                  lineHeight: 1.6,
                  flex: 1,
                }}>
                  {item.event.content ?? JSON.stringify(item.event.payload ?? {})}
                </span>
              </div>
            );
          }

          return null;
        })}

        <div ref={bottomRef} style={{ height: 24 }} />
      </div>

      {/* Back to live pill */}
      {!autoScroll && isRunning && (
        <button
          onClick={backToLive}
          style={{
            position: "absolute",
            bottom: 16, right: 16,
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 20,
            padding: "5px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            color: "var(--color-accent)",
            cursor: "pointer",
            zIndex: 5,
            boxShadow: "none",
          }}
        >
          ↓ back to live
        </button>
      )}
      <style>{`@keyframes tlPulse { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  );
}
