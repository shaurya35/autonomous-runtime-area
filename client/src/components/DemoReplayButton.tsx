"use client";

import { useState } from "react";
import { seedDemo } from "@/lib/api";

export function DemoReplayButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReplay() {
    setLoading(true);
    setError("");
    try {
      const seeded = await seedDemo();
      window.location.href = `/incidents/${seeded.run_id}?replay=1`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load replay");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
      <button
        onClick={loadReplay}
        disabled={loading}
        style={{
          background: "transparent",
          border: "1px solid var(--color-border-strong)",
          borderRadius: 6,
          color: "var(--color-text-secondary)",
          cursor: loading ? "wait" : "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          padding: "0.45rem 0.75rem",
        }}
      >
        {loading ? "Loading replay..." : "Load demo replay"}
      </button>
      {error && (
        <span style={{ color: "var(--color-critical)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
