interface Props {
  bpm: number;
  size?: number;
  color?: string;
  flatline?: boolean;
}

export function HeartbeatIcon({ bpm, size = 14, color = "#ef4444", flatline = false }: Props) {
  const period = bpm > 0 ? `${60 / bpm}s` : undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={flatline ? "none" : color}
      stroke={flatline ? color : "none"} strokeWidth={flatline ? 2 : 0}
      style={{ animation: bpm > 0 && !flatline ? `heartbeat ${period} ease-in-out infinite` : undefined, display: "inline-block" }}>
      {flatline
        ? <polyline points="2,12 8,12 10,6 12,18 14,12 22,12" />
        : <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
      }
    </svg>
  );
}
