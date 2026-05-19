import type { AppSummary } from "../lib/api";

const LANG_EMOJI: Record<string, string> = {
  rust: "🦀", python: "🐍", go: "🐹", node: "🟢", java: "☕", ruby: "💎",
};

interface Props {
  app: AppSummary;
  runCount: number;
}

export function PatientHeader({ app, runCount }: Props) {
  const lang = app.language?.toLowerCase() ?? "unknown";
  const emoji = LANG_EMOJI[lang] ?? "📦";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: "1.5rem" }}>
      <span style={{ fontSize: "3rem" }}>{emoji}</span>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
          {app.name}
        </h1>
        <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: 2 }}>
          {lang} · {runCount} treatment{runCount !== 1 ? "s" : ""} recorded
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-dim)", marginTop: 4 }}>
          {app.source_root}
        </div>
      </div>
    </div>
  );
}
