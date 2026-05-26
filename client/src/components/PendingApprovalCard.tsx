"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  workspaceId: number;
  runId: string;
  diffId: string;
  file: string;
  diff: string;
}

export function PendingApprovalCard({ workspaceId, runId, diffId, file, diff }: Props) {
  const [status, setStatus] = useState<"pending" | "approving" | "rejecting" | "approved" | "rejected" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState("");

  async function act(action: "approve" | "reject") {
    setStatus(action === "approve" ? "approving" : "rejecting");
    try {
      const r = await fetch(
        `${API}/workspaces/${workspaceId}/incidents/${runId}/${action}`,
        { method: "POST", credentials: "include" },
      );
      if (!r.ok) throw new Error(await r.text());
      setStatus(action === "approve" ? "approved" : "rejected");
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  }

  return (
    <div style={{
      border: `1px solid ${status === "approved" ? "var(--color-success)" : status === "rejected" ? "var(--color-border-strong)" : "var(--color-warn)"}`,
      borderRadius: 6,
      overflow: "hidden",
      background: "var(--color-bg-panel)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.625rem 0.875rem",
        borderBottom: "1px solid var(--color-border-soft)",
        background: "var(--color-bg-elevated)",
      }}>
        <span style={{ fontSize: 10, color: "var(--color-warn)" }}>⬤</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", fontWeight: 500 }}>
          Proposed patch
        </span>
        <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--color-text-dim)" }}>
          {diffId.slice(0, 8)}
        </code>
        <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-muted)", flex: 1 }}>
          {file}
        </code>
        {status === "pending" && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => act("reject")}
              style={{
                background: "transparent",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 3,
                padding: "3px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                color: "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              Reject
            </button>
            <button
              onClick={() => act("approve")}
              style={{
                background: "var(--color-success)",
                border: "none",
                borderRadius: 3,
                padding: "3px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                color: "#000",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Approve
            </button>
          </div>
        )}
        {status === "approving" && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-success)" }}>applying…</span>}
        {status === "rejecting" && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-muted)" }}>rejecting…</span>}
        {status === "approved" && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-success)" }}>✓ approved</span>}
        {status === "rejected" && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-muted)" }}>✗ rejected</span>}
        {status === "error" && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-critical)" }}>error</span>}
      </div>

      {/* Diff */}
      <pre style={{
        margin: 0,
        padding: "0.75rem 0.875rem",
        fontFamily: "var(--font-mono)",
        fontSize: "0.6875rem",
        lineHeight: 1.6,
        overflowX: "auto",
        color: "var(--color-text-secondary)",
        maxHeight: 320,
        overflowY: "auto",
      }}>
        {diff.split("\n").map((line, i) => (
          <span
            key={i}
            style={{
              display: "block",
              color: line.startsWith("+") && !line.startsWith("+++")
                ? "var(--color-success)"
                : line.startsWith("-") && !line.startsWith("---")
                  ? "var(--color-critical)"
                  : line.startsWith("@@")
                    ? "var(--color-accent)"
                    : undefined,
              background: line.startsWith("+") && !line.startsWith("+++")
                ? "rgba(16,185,129,0.06)"
                : line.startsWith("-") && !line.startsWith("---")
                  ? "rgba(239,68,68,0.06)"
                  : undefined,
            }}
          >
            {line || " "}
          </span>
        ))}
      </pre>

      {errorMsg && (
        <div style={{ padding: "0.5rem 0.875rem", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-critical)" }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}
