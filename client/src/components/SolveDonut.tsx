"use client";
import type { IncidentRun } from "../lib/api";

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  if (endDeg - startDeg >= 360) endDeg = startDeg + 359.99;
  const o1 = polarToCartesian(cx, cy, outerR, startDeg);
  const o2 = polarToCartesian(cx, cy, outerR, endDeg);
  const i1 = polarToCartesian(cx, cy, innerR, endDeg);
  const i2 = polarToCartesian(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function SolveDonut({ runs }: { runs: IncidentRun[] }) {
  const cx = 90, cy = 90, outerR = 72, innerR = 46;
  const total = runs.length;

  if (total === 0) {
    return (
      <div style={card}>
        <div style={label}>Solve Rate</div>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--color-bg-subtle)" strokeWidth={outerR - innerR} />
          <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--color-text-dim)" fontFamily="var(--font-mono)" fontSize="11">no data</text>
        </svg>
      </div>
    );
  }

  const solved  = runs.filter(r => (r.score ?? 0) >= 0.7).length;
  const partial = runs.filter(r => { const s = r.score ?? 0; return s >= 0.3 && s < 0.7; }).length;
  const failed  = total - solved - partial;
  const pct = Math.round((solved / total) * 100);

  const segments = [
    { count: solved,  color: "#10b981", label: "solved" },
    { count: partial, color: "#f59e0b", label: "partial" },
    { count: failed,  color: "#ef4444", label: "failed" },
  ].filter(s => s.count > 0);

  let cursor = 0;
  const arcs = segments.map(seg => {
    const sweep = (seg.count / total) * 360;
    const path = arcPath(cx, cy, outerR, innerR, cursor, cursor + sweep);
    cursor += sweep;
    return { ...seg, path };
  });

  return (
    <div style={card}>
      <div style={label}>Solve Rate</div>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--color-bg-subtle)" strokeWidth={outerR - innerR} />
        {arcs.map((arc, i) => (
          <path key={i} d={arc.path} fill={arc.color} opacity={0.88} />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--color-text-primary)" fontFamily="var(--font-mono)" fontSize="26" fontWeight="700">{pct}%</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--color-text-muted)" fontFamily="var(--font-mono)" fontSize="10">solve rate</text>
        <text x={cx} y={cy + 26} textAnchor="middle" fill="var(--color-text-dim)" fontFamily="var(--font-mono)" fontSize="9">{solved}/{total} runs</text>
      </svg>
      <div style={{ display: "flex", gap: 10, fontFamily: "var(--font-mono)", fontSize: "0.5625rem", flexWrap: "wrap", justifyContent: "center" }}>
        {arcs.map((arc, i) => (
          <span key={i} style={{ color: arc.color }}>● {arc.count} {arc.label}</span>
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

const label: React.CSSProperties = {
  fontSize: "0.5625rem",
  color: "var(--color-text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  fontFamily: "var(--font-mono)",
  marginBottom: 8,
};
