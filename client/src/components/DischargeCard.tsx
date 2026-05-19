"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck } from "lucide-react";
import type { IncidentRun } from "@/lib/api";

interface Props {
  run: IncidentRun;
  onDismiss: () => void;
}

const PHASES = ["detecting", "diagnosing", "fixing", "verifying"] as const;
const HUMAN_BASELINE = "~30 min";

export function DischargeCard({ run, onDismiss }: Props) {
  const [displayScore, setDisplayScore] = useState(0);
  const [visible, setVisible] = useState(true);
  const rafRef = useRef<number | null>(null);
  const targetScore = run.score ?? 0;

  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      setDisplayScore(t * targetScore);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    if (targetScore >= 0.8) {
      import("canvas-confetti").then(m => {
        m.default({ particleCount: 120, spread: 70, origin: { y: 0.4 }, colors: ["#10b981", "#34d399", "#3b82f6"] });
      });
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetScore]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleDismiss(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 400);
  }

  const mttr = run.mttr_s ?? 0;
  const speedup = Math.round(30 * 60 / Math.max(mttr, 1));

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "var(--color-bg-primary)e6",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: visible ? 1 : 0, transition: "opacity 400ms ease",
        cursor: "pointer",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: 16,
          padding: "2.5rem",
          textAlign: "center",
          minWidth: 360,
          animation: "springIn 800ms cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
      >
        <style>{`@keyframes springIn { from { transform: scale(0.6); opacity:0; } to { transform: scale(1); opacity:1; } }`}</style>
        <BadgeCheck size={48} color="var(--color-healthy)" style={{ margin: "0 auto 1rem" }} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Patient Discharged
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "3.5rem", fontWeight: 700, color: "var(--color-healthy)", lineHeight: 1, marginBottom: "0.5rem" }}>
          {displayScore.toFixed(2)}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>Recovery rate</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: "1.5rem" }}>
          {PHASES.map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem" }}>
              <span style={{ color: run.phases_reached.includes(p) ? "var(--color-healthy)" : "var(--color-text-dim)" }}>
                {run.phases_reached.includes(p) ? "✓" : "○"}
              </span>
              <span style={{ color: "var(--color-text-secondary)", textTransform: "capitalize" }}>{p}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
          Resolved in <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>{mttr}s</span>
          {" · "}Human baseline {HUMAN_BASELINE} · <span style={{ color: "var(--color-healthy)" }}>{speedup}× faster</span>
        </div>

        <div style={{ marginTop: "1rem", fontSize: "0.6875rem", color: "var(--color-text-dim)" }}>Click anywhere or press Esc to dismiss</div>
      </div>
    </div>
  );
}
