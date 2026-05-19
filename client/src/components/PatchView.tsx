"use client";

import { useState } from "react";
import type { ChannelEvent } from "@/lib/api";

interface Props {
  event: ChannelEvent;
  expanded?: boolean;
}

function renderDiff(patch: string) {
  return patch.split("\n").map((line, i) => {
    let bg = "transparent", color = "var(--color-text-secondary)";
    if (line.startsWith("+") && !line.startsWith("+++")) { bg = "color-mix(in srgb, var(--color-healthy) 8%, transparent)"; color = "var(--color-healthy)"; }
    else if (line.startsWith("-") && !line.startsWith("---")) { bg = "color-mix(in srgb, var(--color-critical) 8%, transparent)"; color = "var(--color-critical)"; }
    else if (line.startsWith("@@")) { bg = "color-mix(in srgb, var(--color-recovery) 8%, transparent)"; color = "var(--color-recovery)"; }
    return (
      <div key={i} style={{ background: bg, color, padding: "0 8px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", whiteSpace: "pre" }}>
        {line}
      </div>
    );
  });
}

export function PatchView({ event, expanded: initialExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const input = event.tool_input as Record<string, string> | null;
  const patch = input?.patch ?? input?.content ?? "";
  const file = input?.file_path ?? input?.path ?? "patch";
  const lines = patch.split("\n");
  const adds = lines.filter(l => l.startsWith("+") && !l.startsWith("+++")).length;
  const dels = lines.filter(l => l.startsWith("-") && !l.startsWith("---")).length;

  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-border-soft)" }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: "6px 10px", background: "var(--color-bg-elevated)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem" }}
      >
        <span>📄</span>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{file}</span>
        <span style={{ color: "var(--color-healthy)" }}>+{adds}</span>
        <span style={{ color: "var(--color-critical)" }}>-{dels}</span>
        <span style={{ marginLeft: "auto", color: "var(--color-text-dim)" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ background: "var(--color-bg-subtle)", maxHeight: 300, overflow: "auto" }}>
          {renderDiff(patch)}
        </div>
      )}
    </div>
  );
}
