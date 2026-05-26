"use client";
import type { IncidentRun } from "../lib/api";

const PHASES = [
  { key: "detecting",  label: "Detect",   color: "#3b82f6" },
  { key: "diagnosing", label: "Diagnose", color: "#8b5cf6" },
  { key: "fixing",     label: "Fix",      color: "#f59e0b" },
  { key: "verifying",  label: "Verify",   color: "#10b981" },
] as const;

// 4 axes: top, right, bottom, left
const ANGLES = [0, 90, 180, 270];

export function PhaseRadar({ runs }: { runs: IncidentRun[] }) {
  const cx = 90, cy = 90, R = 62;
  const done = runs.filter(r => r.status === "done" || r.status === "failed");
  const total = done.length;

  if (total === 0) {
    return (
      <div style={card}>
        <div style={labelStyle}>Phase Radar</div>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--color-text-dim)" fontFamily="var(--font-mono)" fontSize="11">no data</text>
        </svg>
      </div>
    );
  }

  const values = PHASES.map(p => {
    const count = done.filter(r => (r.phases_reached ?? []).includes(p.key as string)).length;
    return count / total;
  });

  function pt(angleIdx: number, value: number) {
    const rad = (ANGLES[angleIdx] - 90) * Math.PI / 180;
    return {
      x: cx + value * R * Math.cos(rad),
      y: cy + value * R * Math.sin(rad),
    };
  }

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  function gridPoly(level: number) {
    return ANGLES.map((_, i) => {
      const p = pt(i, level);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(" ");
  }

  const dataPoly = values.map((v, i) => {
    const p = pt(i, Math.max(v, 0.04));
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" ");

  const labelPad = 1.28;

  return (
    <div style={card}>
      <div style={labelStyle}>Phase Radar</div>
      <svg width="180" height="180" viewBox="0 0 180 180">
        {/* Grid rings */}
        {gridLevels.map((level, li) => (
          <polygon key={li} points={gridPoly(level)}
            fill="none" stroke="var(--color-border-soft)" strokeWidth={0.8} opacity={0.6} />
        ))}
        {/* Axis lines */}
        {ANGLES.map((_, i) => {
          const end = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={end.x.toFixed(2)} y2={end.y.toFixed(2)}
            stroke="var(--color-border-soft)" strokeWidth={0.8} opacity={0.5} />;
        })}
        {/* Filled polygon */}
        <polygon points={dataPoly} fill="rgba(59,130,246,0.18)" stroke="#3b82f6" strokeWidth={1.75} />
        {/* Phase dots */}
        {values.map((v, i) => {
          const p = pt(i, Math.max(v, 0.04));
          return <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={4} fill={PHASES[i].color} />;
        })}
        {/* Labels */}
        {PHASES.map((phase, i) => {
          const lp = pt(i, labelPad);
          const dy = i === 0 ? -2 : i === 2 ? 10 : 4;
          return (
            <text key={i} x={lp.x.toFixed(2)} y={(lp.y + dy).toFixed(2)}
              textAnchor="middle"
              fill={phase.color}
              fontFamily="var(--font-mono)"
              fontSize="8.5"
              fontWeight="500"
            >
              {phase.label}
            </text>
          );
        })}
        <circle cx={cx} cy={cy} r={2.5} fill="var(--color-text-dim)" />
      </svg>
      <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-mono)", fontSize: "0.5625rem", flexWrap: "wrap", justifyContent: "center" }}>
        {PHASES.map((p, i) => (
          <span key={p.key} style={{ color: p.color }}>
            {p.label} {Math.round(values[i] * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border-soft)",
  borderRadius: 10,
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minWidth: 200,
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.5625rem",
  color: "var(--color-text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  fontFamily: "var(--font-mono)",
  marginBottom: 8,
};
