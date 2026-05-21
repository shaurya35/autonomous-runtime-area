"use client";

import { Sparkline } from "@/components/Sparkline";
import type { VitalSigns } from "@/lib/api";

interface Props {
  vitals: VitalSigns | null;
  variant?: "compact" | "full" | "large";
}

const VITAL_ROWS = [
  { label: "req/s",  key: "req_per_sec" as const,    color: "var(--color-accent)",    thresholds: {} },
  { label: "p99 ms", key: "p99_latency_ms" as const, color: "var(--color-warn)",      thresholds: { warn: 200, crit: 500 } },
  { label: "err %",  key: "error_rate_pct" as const,  color: "var(--color-critical)",  thresholds: { warn: 0.5, crit: 5 } },
  { label: "cpu %",  key: "cpu_pct" as const,         color: "#a78bfa",               thresholds: { warn: 70, crit: 90 } },
];

export function VitalsPanel({ vitals, variant = "compact" }: Props) {
  const v = vitals?.vitals;

  if (variant === "large") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {VITAL_ROWS.map(row => {
          const data = v?.[row.key] ?? [];
          const last = data.at(-1) ?? 0;
          const threshold = row.thresholds as { warn?: number; crit?: number };
          const isCrit = threshold.crit && last >= threshold.crit;
          const isWarn = !isCrit && threshold.warn && last >= threshold.warn;
          const valueColor = isCrit ? "var(--color-critical)" : isWarn ? "var(--color-warn)" : "var(--color-text-primary)";

          return (
            <div key={row.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-text-muted)",
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "1.125rem",
                  fontWeight: 500,
                  color: valueColor,
                  letterSpacing: "-0.01em",
                }}>
                  {last.toFixed(row.key === "error_rate_pct" ? 2 : 1)}
                </span>
              </div>
              <Sparkline data={data} width={232} height={36} color={row.color} fill thresholds={row.thresholds} />
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {VITAL_ROWS.map(row => {
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

  // full (2x2 grid)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {VITAL_ROWS.map(row => {
        const data = v?.[row.key] ?? [];
        const last = data.at(-1) ?? 0;
        return (
          <div key={row.key} style={{ background: "var(--color-bg-subtle)", borderRadius: 6, padding: "0.75rem" }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{row.label}</div>
            <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>{last.toFixed(1)}</div>
            <Sparkline data={data} width={120} height={32} color={row.color} fill thresholds={row.thresholds} />
          </div>
        );
      })}
    </div>
  );
}
