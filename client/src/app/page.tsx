import { getApps, getIncidents, getAppIncidents, getAppVitals, deriveStatus } from "../lib/api";
import { WardHeader } from "../components/WardHeader";
import { PatientCard } from "../components/PatientCard";
import { AdmissionsTable } from "../components/AdmissionsTable";

export const dynamic = "force-dynamic";

export default async function WardPage() {
  const [apps, runs] = await Promise.all([
    getApps().catch(() => []),
    getIncidents().catch(() => []),
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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
      <WardHeader appCount={apps.length} activeIncidents={activeIncidents} />

      {apps.length === 0 && (
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          No patients yet. Add a <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>srebench.yaml</code> under <code style={{ fontFamily: "var(--font-mono)" }}>apps/</code> to admit one.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {appData.map(({ app, incidents, vitals, status }) => (
          <PatientCard key={app.name} app={app} vitals={vitals} status={status} incidents={incidents} />
        ))}
      </div>

      <div style={{ background: "var(--color-bg-panel)", border: "1px solid var(--color-border-soft)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border-soft)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem" }}>Recent Cases</div>
        <AdmissionsTable runs={runs} />
      </div>
    </div>
  );
}
