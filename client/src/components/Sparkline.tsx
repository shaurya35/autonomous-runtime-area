"use client";

interface Thresholds {
  warn?: number;
  crit?: number;
}

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  thresholds?: Thresholds;
}

export function Sparkline({ data, width = 70, height = 18, color = "var(--color-doctor)", fill = false, thresholds = {} }: Props) {
  if (data.length < 2) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as [number, number];
  });

  const polyline = points.map(([x, y]) => `${x},${y}`).join(" ");

  const last = data.at(-1) ?? 0;
  let strokeColor = color;
  if (thresholds.crit !== undefined && last >= thresholds.crit) {
    strokeColor = "var(--color-critical)";
  } else if (thresholds.warn !== undefined && last >= thresholds.warn) {
    strokeColor = "var(--color-watch)";
  }

  const fillPath = fill
    ? `M${points[0][0]},${height} ` +
      points.map(([x, y]) => `L${x},${y}`).join(" ") +
      ` L${points.at(-1)![0]},${height} Z`
    : null;

  return (
    <svg width={width} height={height} style={{ overflow: "visible", flexShrink: 0 }}>
      {fill && fillPath && (
        <path d={fillPath} fill={`${strokeColor}20`} stroke="none" />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
