"use client";
import type { IncidentRun } from "../lib/api";

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "var(--color-text-dim)";
  if (score >= 0.7) return "#10b981";
  if (score >= 0.3) return "#f59e0b";
  return "#ef4444";
}

function fmt(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const t = 0.3;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function smoothAreaPath(pts: { x: number; y: number }[], baseY: number): string {
  if (pts.length < 2) return "";
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${smoothPath(pts)} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
}

export function MttrTrendChart({ runs }: { runs: IncidentRun[] }) {
  const valid = runs.filter((r): r is IncidentRun & { mttr_s: number } =>
    r.mttr_s != null && r.mttr_s > 0
  );
  if (valid.length === 0) return null;

  const W = 680, H = 180;
  const padL = 52, padR = 24, padT = 28, padB = 38;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxM = Math.max(...valid.map(r => r.mttr_s));
  const minM = Math.min(...valid.map(r => r.mttr_s));
  const range = maxM - minM || maxM * 0.2 || 1;
  const avg   = valid.reduce((s, r) => s + r.mttr_s, 0) / valid.length;

  const toX = (i: number) =>
    padL + (valid.length === 1 ? chartW / 2 : (i / (valid.length - 1)) * chartW);
  const toY = (m: number) =>
    padT + chartH - ((m - (minM - range * 0.1)) / (range * 1.2)) * chartH;

  const pts  = valid.map((r, i) => ({ x: toX(i), y: toY(r.mttr_s), r }));
  const avgY = toY(avg);
  const baseY = padT + chartH;

  const yTicks = [minM, avg, maxM].map(v => ({ v, y: toY(v) }));

  return (
    <div style={{
      background: "var(--color-bg-elevated)",
      border: "1px solid var(--color-border-soft)",
      borderRadius: 10,
      padding: "0.875rem 0.75rem 0.5rem",
    }}>
      <div style={{
        fontSize: "0.5625rem", color: "var(--color-text-dim)",
        textTransform: "uppercase", letterSpacing: "0.09em",
        fontFamily: "var(--font-mono)", marginBottom: 6, paddingLeft: 4,
      }}>
        MTTR Trend — {valid.length} run{valid.length !== 1 ? "s" : ""}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {yTicks.map(({ v, y }, i) => (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y}
              stroke="var(--color-border-soft)" strokeWidth={0.8} strokeDasharray="3,5" opacity={0.45} />
            <text x={padL - 8} y={y + 4} textAnchor="end"
              fill="var(--color-text-dim)" fontFamily="var(--font-mono)" fontSize="9">
              {fmt(v)}
            </text>
          </g>
        ))}

        <line x1={padL} y1={avgY} x2={W - padR} y2={avgY}
          stroke="#34d399" strokeWidth={1} strokeDasharray="5,4" opacity={0.65} />
        <text x={W - padR + 4} y={avgY + 4} fill="#34d399" fontFamily="var(--font-mono)" fontSize="8.5">avg</text>

        {valid.length > 1 && (
          <path d={smoothAreaPath(pts, baseY)} fill="rgba(59,130,246,0.07)" />
        )}
        {valid.length > 1 && (
          <path d={smoothPath(pts)} fill="none" stroke="rgba(59,130,246,0.55)" strokeWidth={2.25}
            strokeLinejoin="round" strokeLinecap="round" />
        )}

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={10} fill={scoreColor(p.r.score)} opacity={0.1} />
            <circle cx={p.x} cy={p.y} r={4.5} fill={scoreColor(p.r.score)} />
            <text x={p.x} y={p.y - 12} textAnchor="middle"
              fill="var(--color-text-muted)" fontFamily="var(--font-mono)" fontSize="8.5">
              {fmt(p.r.mttr_s)}
            </text>
            <text x={p.x} y={H - padB + 16} textAnchor="middle"
              fill="var(--color-text-dim)" fontFamily="var(--font-mono)" fontSize="8">
              #{i + 1}
            </text>
          </g>
        ))}

        <line x1={padL} y1={padT} x2={padL} y2={baseY}
          stroke="var(--color-border-soft)" strokeWidth={1} />
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY}
          stroke="var(--color-border-soft)" strokeWidth={1} />
      </svg>
    </div>
  );
}
