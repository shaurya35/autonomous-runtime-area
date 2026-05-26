import { getAppsStrict, getIncidentsStrict, getAppIncidents, getAppVitals, deriveStatus } from "@/lib/api";
import { WardHeader } from "@/components/WardHeader";
import { PatientCard } from "@/components/PatientCard";
import { AdmissionsTable } from "@/components/AdmissionsTable";
import { DemoReplayButton } from "@/components/DemoReplayButton";

export const dynamic = "force-dynamic";


export default async function DemoPage() {
  const errors: string[] = [];
  const [apps, runs] = await Promise.all([
    getAppsStrict().catch((e) => {
      errors.push(`Could not load apps: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }),
    getIncidentsStrict().catch((e) => {
      errors.push(`Could not load recent runs: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }),
  ]);

  const appData = await Promise.all(
    apps.map(async (app) => {
      const [incidents, vitals] = await Promise.all([
        getAppIncidents(app.name).catch(() => []),
        getAppVitals(app.name, { since: 60, simulate: true }).catch(() => null),
      ]);
      const status = deriveStatus(vitals);
      return { app, incidents, vitals, status };
    })
  );

  const activeIncidents = runs.filter(r => r.status === "running").length;
  const sortedRuns = [...runs].sort((a, b) => (b.started_at ?? 0) - (a.started_at ?? 0));
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
      <WardHeader appCount={apps.length} activeIncidents={activeIncidents} />

      {/* Score formula + demo replay — merged single row */}
      <div style={{
        background: "var(--color-bg-panel)",
        border: "1px solid var(--color-border-soft)",
        borderLeft: "3px solid var(--color-accent)",
        borderRadius: 6, padding: "0.625rem 1rem",
        marginBottom: "1rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
            Score = <span style={{ color: "#60a5fa" }}>0.2</span> × detect +{" "}
            <span style={{ color: "#fbbf24" }}>0.3</span> × diagnose +{" "}
            <span style={{ color: "#34d399" }}>0.5</span> × fix{" "}
            <span style={{ color: "var(--color-text-dim)" }}>− time penalty</span>
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
            Solved if score ≥ <span style={{ color: "var(--color-success)" }}>0.70</span>
          </span>
        </div>
        <DemoReplayButton />
      </div>

      {errors.length > 0 && (
        <div style={{
          color: "var(--color-critical)", background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6,
          padding: "0.75rem 1rem", fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)", marginBottom: "1rem",
        }}>
          {errors.join(" ")}
        </div>
      )}

      {apps.length === 0 && (
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          No apps yet. Add a <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>sentinel.yaml</code> under <code style={{ fontFamily: "var(--font-mono)" }}>apps/</code> to register one.
        </div>
      )}

      {/* Patient cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {appData.map(({ app, incidents, vitals, status }) => (
          <PatientCard key={app.name} app={app} vitals={vitals} status={status} incidents={incidents} />
        ))}
      </div>

      {/* Recent runs */}
      <div style={{ background: "var(--color-bg-panel)", border: "1px solid var(--color-border-soft)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border-soft)", fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "var(--text-caption)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Recent Runs
        </div>
        <AdmissionsTable runs={sortedRuns} />
      </div>
    </div>
  );
}
