import { getApp, getIncidents, getAppIncidents } from "../../../lib/api";
import { PatientHeader } from "../../../components/PatientHeader";
import { ConditionList } from "../../../components/ConditionList";
import { TreatmentHistory } from "../../../components/TreatmentHistory";

export const dynamic = "force-dynamic";

export default async function PatientChartPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  const [app, allRuns, incidents] = await Promise.all([
    getApp(name).catch(() => null),
    getIncidents().catch(() => []),
    getAppIncidents(name).catch(() => []),
  ]);

  if (!app) {
    return <div style={{ padding: "2rem", color: "var(--color-text-muted)" }}>App &quot;{name}&quot; not found.</div>;
  }

  const appRuns = allRuns.filter(r => r.app === name);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <PatientHeader app={app} runCount={appRuns.length} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
            Known Conditions
          </h2>
          <ConditionList appName={name} incidents={incidents} />
        </div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
            Treatment History
          </h2>
          <TreatmentHistory runs={appRuns} />
        </div>
      </div>
    </div>
  );
}
