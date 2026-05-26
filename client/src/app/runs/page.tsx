import { getIncidents } from "../../lib/api";
import { MttrTrendChart } from "../../components/MttrTrendChart";
import { SolveDonut } from "../../components/SolveDonut";
import { PhaseRadar } from "../../components/PhaseRadar";
import { ImpactTable } from "../../components/ImpactTable";
import { RunsClient } from "./RunsClient";
import { RunsTable } from "./RunsTable";

export const dynamic = "force-dynamic";

function formatMttr(s: number | null | undefined): string {
  if (s == null || s <= 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export default async function RunsPage() {
  const allRuns = await getIncidents().catch(() => []);
  const runs = allRuns
    .filter(r => r.status === "done" || r.status === "failed")
    .sort((a, b) => (b.started_at ?? 0) - (a.started_at ?? 0));

  const total = runs.length;
  const mttrValues = runs.map(r => r.mttr_s).filter((m): m is number => m != null && m > 0);
  const avgMttr  = mttrValues.length > 0 ? mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length : null;
  const bestMttr = mttrValues.length > 0 ? Math.min(...mttrValues) : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>
            run history
          </h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-muted)", marginTop: 2 }}>
            {total} completed run{total !== 1 ? "s" : ""} · auto-refreshes every 30s
          </div>
        </div>
        <RunsClient />
      </div>

      {/* Charts row: donut + radar + metric tiles */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <SolveDonut runs={runs} />
        <PhaseRadar runs={runs} />

        {/* Compact metric tiles stacked on the right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 160px" }}>
          {[
            { label: "Total Runs",  value: String(total),          color: "var(--color-accent)" },
            { label: "Avg MTTR",    value: formatMttr(avgMttr),    color: "#34d399" },
            { label: "Best MTTR",   value: formatMttr(bestMttr),   color: "#10b981" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-soft)",
              borderRadius: 8, padding: "0.75rem 1rem",
            }}>
              <div style={{ fontSize: "0.5625rem", color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.09em", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, color }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smooth MTTR trend chart */}
      {runs.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <MttrTrendChart runs={[...runs].reverse()} />
        </div>
      )}

      {/* Collapsible Operational Impact Table */}
      <ImpactTable runs={runs} />

      {/* Runs Table */}
      <div style={{ background: "var(--color-bg-panel)", border: "1px solid var(--color-border-soft)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border-soft)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "var(--text-caption)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            All Runs
          </span>
        </div>
        <RunsTable runs={runs} />
      </div>
    </div>
  );
}
