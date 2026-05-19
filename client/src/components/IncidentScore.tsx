"use client";
import { useEffect, useState } from "react";
import type { IncidentRun } from "@/lib/api";

const PHASES = ["detecting", "diagnosing", "fixing", "verifying"] as const;

export function IncidentScore({ run }: { run: IncidentRun }) {
  const [elapsed, setElapsed] = useState(run.mttr_s ?? 0);

  useEffect(() => {
    if (run.status !== "running") return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [run.status]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-zinc-400 text-sm font-mono">{run.app}</span>
          <h2 className="text-zinc-100 font-mono font-bold text-lg">{run.incident_id}</h2>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-green-400">
            {run.score != null ? run.score.toFixed(3) : "—"}
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            {run.status === "running" ? `${elapsed.toFixed(0)}s` : `${(run.mttr_s ?? 0).toFixed(1)}s`}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {PHASES.map((p) => (
          <div key={p} className={`flex-1 h-1.5 rounded-full ${run.phases_reached?.includes(p) ? "bg-green-500" : "bg-zinc-700"}`} />
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        {PHASES.map((p) => (
          <div key={p} className="flex-1 text-center text-xs text-zinc-600 font-mono">{p.slice(0, 4)}</div>
        ))}
      </div>
    </div>
  );
}
