import { getIncident } from "@/lib/api";
import { IncidentScore } from "@/components/IncidentScore";
import { PhaseTimeline } from "@/components/PhaseTimeline";

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getIncident(id);

  return (
    <div>
      <IncidentScore run={run} />
      <PhaseTimeline runId={id} />
    </div>
  );
}
