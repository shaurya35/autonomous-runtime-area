"use client";

import { useAppVitals } from "@/lib/sse";
import { VitalsPanel } from "@/components/VitalsPanel";

interface Props {
  appName: string;
}

export function LiveVitals({ appName }: Props) {
  const vitals = useAppVitals(appName);
  return (
    <div>
      <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontFamily: "var(--font-display)" }}>
        Patient Vitals
      </div>
      <VitalsPanel vitals={vitals} variant="compact" />
    </div>
  );
}
