"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ChannelEvent } from "@/lib/api";

interface Props {
  event: ChannelEvent;
  onClose: () => void;
}

export function EvidencePanel({ event, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isToolCall = event.type === "tool_call";
  const isToolResult = event.type === "tool_result";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "stretch",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-strong)",
          borderBottom: "none",
          borderRadius: "12px 12px 0 0",
          width: "100%",
          maxHeight: "60vh",
          overflow: "auto",
          padding: "1.25rem 1.5rem",
          animation: "slideUp 300ms ease-out",
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
              {event.type}
            </span>
            {(isToolCall || isToolResult) && event.tool_name && (
              <span style={{ fontSize: "0.8125rem", color: "var(--color-doctor)", fontFamily: "var(--font-mono)" }}>
                {event.tool_name}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {isToolCall && event.tool_input !== undefined && (
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--color-text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Input</div>
            <pre style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--color-text-secondary)",
              background: "var(--color-bg-subtle)",
              borderRadius: 6,
              padding: "0.75rem",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {typeof event.tool_input === "string"
                ? event.tool_input
                : JSON.stringify(event.tool_input, null, 2)}
            </pre>
          </div>
        )}

        {isToolResult && event.tool_result !== undefined && (
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--color-text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Result</div>
            <pre style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--color-text-secondary)",
              background: "var(--color-bg-subtle)",
              borderRadius: 6,
              padding: "0.75rem",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {typeof event.tool_result === "string"
                ? event.tool_result
                : JSON.stringify(event.tool_result, null, 2)}
            </pre>
          </div>
        )}

        {event.type === "thought" && event.content && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.8125rem",
            color: "var(--color-text-secondary)",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}>
            {event.content}
          </div>
        )}

        {event.type === "error" && event.content && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.8125rem",
            color: "var(--color-critical)",
            lineHeight: 1.6,
          }}>
            {event.content}
          </div>
        )}
      </div>
    </div>
  );
}
