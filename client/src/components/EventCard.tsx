"use client";

import { Wrench } from "lucide-react";
import type { ChannelEvent } from "@/lib/api";

interface Props {
  event: ChannelEvent;
  onClick: () => void;
}

export function EventCard({ event, onClick }: Props) {
  const isToolCall = event.type === "tool_call";
  const isToolResult = event.type === "tool_result";
  const isError = event.type === "error";

  const borderColor = isError ? "var(--color-critical)" : isToolCall ? "var(--color-doctor)" : "var(--color-border-soft)";

  let preview = "";
  if (isToolCall) {
    const inp = typeof event.tool_input === "string" ? event.tool_input : JSON.stringify(event.tool_input ?? {});
    preview = `${event.tool_name}(${inp.slice(0, 50)}${inp.length > 50 ? "…" : ""})`;
  } else if (isToolResult) {
    const r = typeof event.tool_result === "string" ? event.tool_result : JSON.stringify(event.tool_result ?? {});
    preview = `← ${event.tool_name}: ${r.slice(0, 60)}${r.length > 60 ? "…" : ""}`;
  } else {
    preview = (event.content ?? "").slice(0, 80);
  }

  return (
    <div onClick={onClick} style={{
      padding: "6px 8px",
      background: "var(--color-bg-subtle)",
      borderRadius: 6,
      borderLeft: `2px solid ${borderColor}`,
      cursor: "pointer",
      fontSize: "0.75rem",
      fontFamily: "var(--font-mono)",
      color: isError ? "var(--color-critical)" : "var(--color-text-secondary)",
    }}>
      {isToolCall && <Wrench size={10} style={{ marginRight: 4, display: "inline", color: "var(--color-doctor)" }} />}
      {preview}
    </div>
  );
}
