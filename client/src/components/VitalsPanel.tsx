"use client";

import { Sparkline } from "@/components/Sparkline";
import type { VitalSigns } from "@/lib/api";

interface Props {
  vitals: VitalSigns | null;
  variant?: "compact" | "full";
}

const VITAL_ROWS = [
  { label: "req/s",  key: "req_per_sec" as const,    color: "var(--color-doctor)",   thresholds: {} },
  { label: "p99 ms", key: "p99_latency_ms" as const, color: "var(--color-watch)",    thresholds: { warn: 200, crit: 500 } },
  { label: "err %",  key: "error_rate_pct" as const,  color: "var(--color-critical)", thresholds: { warn: 0.5, crit: 5 } },
  { label: "cpu %",  key: "cpu_pct" as const,         color: "#a78bfa",               thresholds: { warn: 70, crit: 90 } },
];

export function VitalsPanel({ vitals, variant = "compact" }: Props) {
  const v = vitals?.vitals;
  const rows = VITAL_ROWS;

  if (variant === "compact") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(row => {
          const data = v?.[row.key] ?? [];
          const last = data.at(-1) ?? 0;
          return (
            <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", width: 40, fontFamily: "var(--font-mono)" }}>{row.label}</span>
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", width: 50 }}>{last.toFixed(1)}</span>
              <Sparkline data={data} width={70} height={18} color={row.color} thresholds={row.thresholds} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {rows.map(row => {
        const data = v?.[row.key] ?? [];
        const last = data.at(-1) ?? 0;
        return (
          <div key={row.key} style={{ background: "var(--color-bg-subtle)", borderRadius: 8, padding: "0.75rem" }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.label}</div>
            <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>{last.toFixed(1)}</div>
            <Sparkline data={data} width={120} height={32} color={row.color} fill thresholds={row.thresholds} />
          </div>
        );
      })}
    </div>
  );
}
