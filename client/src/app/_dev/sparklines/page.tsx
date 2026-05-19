import { Sparkline } from "../../../components/Sparkline";

const flat = [10, 10, 10, 10, 10, 10, 10, 10];
const rising = [1, 3, 5, 8, 12, 20, 35, 60, 90];
const noisy = [5, 12, 3, 18, 7, 22, 4, 15, 9, 25, 6, 11];
const critSpike = [5, 5, 5, 5, 6, 8, 15, 30];
const empty: number[] = [];

export default function SparklinesDevPage() {
  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>Sparkline variants</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Row label="Empty (flatline)" node={<Sparkline data={empty} ariaLabel="empty" />} />
        <Row label="Flat" node={<Sparkline data={flat} color="#3b82f6" />} />
        <Row label="Rising" node={<Sparkline data={rising} color="#10b981" />} />
        <Row label="Noisy" node={<Sparkline data={noisy} color="#f59e0b" />} />
        <Row label="Crit spike (thresholds)" node={<Sparkline data={critSpike} thresholds={{ warn: 10, crit: 20 }} />} />
        <Row label="With fill" node={<Sparkline data={rising} color="#3b82f6" fill />} />
        <Row label="Large (200×40)" node={<Sparkline data={noisy} width={200} height={40} color="#34d399" fill />} />
      </div>
    </div>
  );
}

function Row({ label, node }: { label: string; node: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", width: 200 }}>{label}</span>
      {node}
    </div>
  );
}
