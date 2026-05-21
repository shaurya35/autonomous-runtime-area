"use client";

import { useState } from "react";
import type { ChannelEvent } from "@/lib/api";

interface Props {
  call: ChannelEvent;
  result?: ChannelEvent;
  isPatch: boolean;
}

function renderDiff(diffText: string) {
  return diffText.split("\n").map((line, i) => {
    let bg = "transparent";
    let color = "var(--color-text-secondary)";
    if (line.startsWith("+") && !line.startsWith("+++")) {
      bg = "rgba(16,185,129,0.08)"; color = "var(--color-success)";
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      bg = "rgba(239,68,68,0.08)"; color = "var(--color-critical)";
    } else if (line.startsWith("@@")) {
      bg = "rgba(34,211,238,0.06)"; color = "var(--color-accent)";
    }
    return (
      <div key={i} style={{ background: bg, color, padding: "1px 10px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", whiteSpace: "pre" }}>
        {line || " "}
      </div>
    );
  });
}

function argsPreview(input: unknown): string {
  if (!input || typeof input !== "object") return String(input ?? "");
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  const val = String(obj[keys[0]] ?? "").split("\n")[0].slice(0, 48);
  return keys.length === 1
    ? `${keys[0]}="${val}"`
    : `${keys[0]}="${val}"  +${keys.length - 1}`;
}

function resultSummary(result: unknown): { ok: boolean; text: string } {
  if (!result || typeof result !== "object") return { ok: true, text: String(result ?? "") };
  const obj = result as Record<string, unknown>;
  if ("error" in obj && obj.error) return { ok: false, text: String(obj.error).slice(0, 80) };
  if ("success" in obj && !obj.success) return { ok: false, text: String(obj.error ?? "failed").slice(0, 80) };
  if ("content" in obj && typeof obj.content === "string") {
    const lines = obj.content.split("\n").length;
    return { ok: true, text: `${lines} lines` };
  }
  if ("logs" in obj && Array.isArray(obj.logs)) return { ok: true, text: `${obj.logs.length} log lines` };
  if ("output" in obj) return { ok: true, text: String(obj.output).slice(0, 60) };
  if ("passed" in obj) return { ok: Boolean(obj.passed), text: `tests ${obj.passed ? "passed" : "failed"}` };
  if ("success" in obj && obj.success) return { ok: true, text: "success" };
  return { ok: true, text: Object.keys(obj).slice(0, 3).join(", ") };
}

export function ToolCallRow({ call, result, isPatch }: Props) {
  const [expanded, setExpanded] = useState(false);

  const input = call.tool_input as Record<string, unknown> | null;
  const res = result?.tool_result;
  const inFlight = !result;

  const patchDiff = isPatch
    ? ((input as Record<string, string> | null)?.unified_diff ?? "")
    : "";
  const patchFile = isPatch
    ? ((input as Record<string, string> | null)?.file ?? "unknown")
    : "";
  const addCount = patchDiff.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++")).length;
  const delCount = patchDiff.split("\n").filter(l => l.startsWith("-") && !l.startsWith("---")).length;

  const preview = argsPreview(input);
  const resInfo = res !== undefined ? resultSummary(res) : null;

  const headerBg = isPatch ? "var(--color-bg-elevated)" : "var(--color-bg-elevated)";

  return (
    <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid var(--color-border-soft)" }}>
      {/* Header row */}
      <div
        onClick={isPatch ? undefined : () => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px",
          background: headerBg,
          cursor: isPatch ? "default" : "pointer",
          fontSize: "var(--text-sm)",
          fontFamily: "var(--font-mono)",
          userSelect: "none",
        }}
      >
        <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>→</span>
        <span style={{ color: "var(--color-accent)", flexShrink: 0 }}>{call.tool_name}</span>
        <span style={{
          color: "var(--color-text-dim)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          flex: 1, minWidth: 0,
        }}>
          ({preview})
        </span>
        {inFlight ? (
          <span style={{ color: "var(--color-warn)", fontSize: 10, animation: "tcPulse 1.2s ease-in-out infinite", flexShrink: 0 }}>⟳</span>
        ) : resInfo ? (
          <>
            <span style={{ color: resInfo.ok ? "var(--color-success)" : "var(--color-critical)", fontSize: 11, flexShrink: 0 }}>
              {resInfo.ok ? "✓" : "✗"}
            </span>
            <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
              {resInfo.text}
            </span>
          </>
        ) : null}
        {!isPatch && (
          <span style={{ color: "var(--color-text-dim)", fontSize: 9, marginLeft: 2, flexShrink: 0 }}>
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>

      {/* Patch diff — always visible for propose_patch */}
      {isPatch && (
        <div style={{ background: "var(--color-bg-subtle)" }}>
          <div style={{
            padding: "4px 10px",
            borderBottom: "1px solid var(--color-border-soft)",
            display: "flex", gap: 10,
            fontSize: "0.75rem", fontFamily: "var(--font-mono)",
          }}>
            <span style={{ color: "var(--color-text-muted)" }}>{patchFile}</span>
            <span style={{ color: "var(--color-success)" }}>+{addCount}</span>
            <span style={{ color: "var(--color-critical)" }}>-{delCount}</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {patchDiff ? renderDiff(patchDiff) : (
              <div style={{ padding: "8px 10px", color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                no diff content
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expandable detail for non-patch calls */}
      {!isPatch && expanded && (
        <div style={{ background: "var(--color-bg-subtle)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
              Input
            </div>
            <pre style={{
              margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.75rem",
              color: "var(--color-text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all",
              maxHeight: 160, overflowY: "auto",
            }}>
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {res !== undefined && (
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                Result
              </div>
              <pre style={{
                margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                color: "var(--color-text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all",
                maxHeight: 200, overflowY: "auto",
              }}>
                {JSON.stringify(res, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes tcPulse { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  );
}
