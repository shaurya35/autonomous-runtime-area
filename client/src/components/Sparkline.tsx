interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  thresholds?: { warn?: number; crit?: number };
  ariaLabel?: string;
}

export function Sparkline({ data, width = 80, height = 24, color = "#3b82f6", fill = false, thresholds, ariaLabel }: Props) {
  if (data.length === 0) {
    return (
      <svg width={width} height={height} aria-label={ariaLabel}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#4a536d" strokeWidth={1} strokeDasharray="4 2" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(" ");

  const lastVal = data[data.length - 1];
  const lineColor = thresholds?.crit && lastVal >= thresholds.crit ? "#ef4444"
    : thresholds?.warn && lastVal >= thresholds.warn ? "#f59e0b"
    : color;

  const ptArr = points.split(" ");
  const firstPt = ptArr[0];
  const lastX = ptArr.at(-1)?.split(",")[0];
  const fillPath = fill ? `M${firstPt} L${points} L${lastX},${height} L0,${height} Z` : undefined;

  return (
    <svg width={width} height={height} aria-label={ariaLabel} style={{ overflow: "visible" }}>
      {fill && fillPath && <path d={fillPath} fill={lineColor} opacity={0.15} />}
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
