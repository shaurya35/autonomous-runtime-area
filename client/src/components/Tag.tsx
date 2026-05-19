type Tone = "neutral" | "info" | "warn" | "critical";

interface Props {
  children: React.ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
}

const COLORS: Record<Tone, string> = {
  neutral:  "#6f7a98",
  info:     "#3b82f6",
  warn:     "#f59e0b",
  critical: "#ef4444",
};

export function Tag({ children, tone = "neutral", size = "sm" }: Props) {
  const c = COLORS[tone];
  return (
    <span style={{
      display: "inline-block",
      fontSize: size === "sm" ? "0.6875rem" : "0.75rem",
      padding: "1px 6px",
      borderRadius: 4,
      border: `1px solid ${c}33`,
      backgroundColor: `${c}1a`,
      color: c,
      fontFamily: "var(--font-mono)",
    }}>
      {children}
    </span>
  );
}
