"use client";
import { useState } from "react";
import { Syringe } from "lucide-react";
import type { IncidentMeta } from "../lib/api";
import { startIncidentRun } from "../lib/api";

interface Props {
  appName: string;
  incidents: IncidentMeta[];
}

const DIFF_COLORS = { easy: "#10b981", medium: "#f59e0b", hard: "#ef4444" };

export function ConditionList({ appName, incidents }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAdmit(incidentId: string) {
    setLoading(incidentId);
    try {
      const run = await startIncidentRun(appName, incidentId);
      if (run.run_id) window.location.href = `/incidents/${run.run_id}`;
    } finally {
      setLoading(null);
    }
  }

  if (incidents.length === 0) {
    return <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", padding: "1rem 0" }}>No known conditions.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {incidents.map(inc => (
        <div key={inc.id} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 12px",
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-soft)",
          borderRadius: 8,
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-doctor)", minWidth: 70 }}>{inc.id}</span>
          <span style={{
            fontSize: "0.6875rem", padding: "1px 6px", borderRadius: 4,
            background: `${DIFF_COLORS[inc.difficulty]}1a`, color: DIFF_COLORS[inc.difficulty],
            border: `1px solid ${DIFF_COLORS[inc.difficulty]}33`,
          }}>{inc.difficulty}</span>
          <span style={{ fontSize: "0.6875rem", padding: "1px 6px", borderRadius: 4, background: "#6f7a981a", color: "#6f7a98", border: "1px solid #6f7a9833", fontFamily: "var(--font-mono)" }}>{inc.category}</span>
          <span style={{ flex: 1, fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{inc.title}</span>
          <button
            onClick={() => handleAdmit(inc.id)}
            disabled={loading === inc.id}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: loading === inc.id ? "var(--color-bg-panel)" : "var(--color-critical)",
              color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px",
              fontSize: "0.75rem", cursor: loading === inc.id ? "wait" : "pointer", fontWeight: 600,
            }}
          >
            <Syringe size={11} />{loading === inc.id ? "…" : "Admit"}
          </button>
        </div>
      ))}
    </div>
  );
}
