import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ maxWidth: 640, margin: "8rem auto", padding: "0 1.5rem", fontFamily: "var(--font-mono)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-primary)" }}>
        sentinel
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-body)", marginBottom: "2.5rem", lineHeight: 1.6 }}>
        Autonomous SRE agent that detects, diagnoses, and fixes production incidents.<br />
        Connects to your own services — no code changes required.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link
          href="/signup"
          style={{
            background: "var(--color-accent)",
            color: "#000",
            padding: "0.5rem 1.25rem",
            borderRadius: 4,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Get early access
        </Link>
        <Link
          href="/demo"
          style={{
            border: "1px solid var(--color-border-strong)",
            color: "var(--color-text-secondary)",
            padding: "0.5rem 1.25rem",
            borderRadius: 4,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
          }}
        >
          Try the benchmark →
        </Link>
      </div>

      <div style={{ marginTop: "4rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
        {[
          { label: "Auto-detect", desc: "Monitors health + error rate; creates incidents automatically" },
          { label: "Diagnose", desc: "Reads logs, metrics, and source code to find the root cause" },
          { label: "Patch + approve", desc: "Proposes a fix inline; you click Approve before anything changes" },
        ].map(({ label, desc }) => (
          <div key={label}>
            <div style={{ color: "var(--color-accent)", fontSize: "var(--text-sm)", marginBottom: "0.4rem", fontWeight: 500 }}>{label}</div>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-caption)", lineHeight: 1.6 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
