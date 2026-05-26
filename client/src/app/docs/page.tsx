export const dynamic = "force-static";

const API = "http://localhost:8000";
const APP = "shop-api";

interface Incident {
  id: string;
  title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  description: string;
}

const INCIDENTS: Incident[] = [
  {
    id: "SRE-0001",
    title: "Login crashes on missing password",
    category: "code",
    difficulty: "easy",
    description: ".unwrap() on Option<String> panics when password field is omitted. POST /auth/login returns 500.",
  },
  {
    id: "SRE-0003",
    title: "Wrong port in config",
    category: "config",
    difficulty: "easy",
    description: "PORT changed to 8081 but load balancer and health checks target 8080. Service starts but is unreachable.",
  },
  {
    id: "SRE-0006",
    title: "/products pagination off-by-one",
    category: "code",
    difficulty: "easy",
    description: "Offset uses page x per_page instead of (page-1) x per_page. First page of results is always skipped.",
  },
  {
    id: "SRE-0013",
    title: "Connection pool exhausted under load",
    category: "resource",
    difficulty: "medium",
    description: "POOL_MAX_CONNECTIONS reduced to 2. Concurrent requests exhaust the pool and time out with 500s.",
  },
  {
    id: "SRE-0020",
    title: "Async task starvation",
    category: "resource",
    difficulty: "hard",
    description: "std::thread::sleep blocks a tokio thread for 10s in a spawn loop, starving all async tasks. Periodic latency spikes across every endpoint.",
  },
];

const DIFF_COLOR: Record<string, string> = {
  easy: "#10b981", medium: "#f59e0b", hard: "#ef4444",
};
const CAT_COLOR: Record<string, string> = {
  code: "#3b82f6", config: "#8b5cf6", resource: "#f59e0b",
};

function Code({ children }: { children: string }) {
  return (
    <pre style={{
      background: "var(--color-bg-primary)",
      border: "1px solid var(--color-border-soft)",
      borderRadius: 6,
      padding: "0.875rem 1rem",
      fontFamily: "var(--font-mono)",
      fontSize: "0.75rem",
      color: "var(--color-text-secondary)",
      overflowX: "auto",
      lineHeight: 1.8,
      margin: 0,
    }}>
      {children}
    </pre>
  );
}

export default function DocsPage() {
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "1.25rem", color: "var(--color-text-primary)", marginBottom: "0.375rem" }}>
        Incident Reference
      </h1>
      <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: "1rem" }}>
        Five reproducible faults targeting <code style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)" }}>{APP}</code>.
        Use the <a href="/demo" style={{ color: "var(--color-accent)", textDecoration: "none" }}>benchmark page</a> for one-click injection, or call the API directly.
      </p>

      {/* How it actually works */}
      <div style={{
        background: "var(--color-bg-panel)",
        border: "1px solid var(--color-border-soft)",
        borderLeft: "3px solid #34d399",
        borderRadius: 6, padding: "1rem 1.25rem", marginBottom: "2rem",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "#34d399", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.625rem" }}>
          This is a real agent, not a simulation
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div><span style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)" }}>Inject</span>: applies a real git diff to the Rust source. The code is literally broken. The container rebuilds.</div>
          <div><span style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)" }}>Start</span>: launches Claude Sonnet 4.6 in a ReAct loop with no knowledge of the fault or its fix. The agent reads real Docker logs, greps real source files, writes a real patch, applies it, rebuilds, and runs the actual test suite.</div>
          <div><span style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)" }}>Score</span>: measured from real test pass/fail. The 14s MTTR for SRE-0001 is wall-clock time from inject to green tests.</div>
        </div>
      </div>

      {/* Terminal quick-ref */}
      <div style={{
        background: "var(--color-bg-panel)",
        border: "1px solid var(--color-border-soft)",
        borderLeft: "3px solid var(--color-accent)",
        borderRadius: 6, padding: "1rem 1.25rem", marginBottom: "2rem",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.625rem" }}>
          Run from terminal (repo root)
        </div>
        <Code>{`# Inject fault + dispatch Sentinel (replace SRE-0001 with any ID)
make run-incident APP=shop-api ID=SRE-0001

# Check score of a completed run
make score RUN=<run_id>

# Reset — clear all evidence and results
make reset`}</Code>
      </div>

      {/* Incident table */}
      <div style={{
        background: "var(--color-bg-panel)",
        border: "1px solid var(--color-border-soft)",
        borderRadius: 6, overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "7rem 1fr 5rem",
          padding: "6px 16px",
          borderBottom: "1px solid var(--color-border-soft)",
          background: "var(--color-bg-subtle)",
        }}>
          {["Incident", "What breaks", "Difficulty"].map(h => (
            <span key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
          ))}
        </div>
        {INCIDENTS.map((inc, i) => (
          <div
            key={inc.id}
            style={{
              display: "grid",
              gridTemplateColumns: "7rem 1fr 5rem",
              padding: "12px 16px",
              borderBottom: i < INCIDENTS.length - 1 ? "1px solid var(--color-border-soft)" : "none",
              alignItems: "start",
              gap: "0.5rem",
            }}
          >
            {/* ID + category */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.8125rem", color: "var(--color-accent)" }}>{inc.id}</span>
              <span style={{
                fontSize: "0.625rem", padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-mono)",
                background: `${CAT_COLOR[inc.category] ?? "#6f7a98"}18`,
                color: CAT_COLOR[inc.category] ?? "var(--color-text-muted)",
                border: `1px solid ${CAT_COLOR[inc.category] ?? "#6f7a98"}35`,
                width: "fit-content",
              }}>{inc.category}</span>
            </div>

            {/* Description */}
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-text-primary)", marginBottom: 4, fontWeight: 500 }}>{inc.title}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.55 }}>{inc.description}</div>
            </div>

            {/* Difficulty */}
            <div>
              <span style={{
                fontSize: "0.625rem", padding: "2px 7px", borderRadius: 4, fontFamily: "var(--font-mono)",
                background: `${DIFF_COLOR[inc.difficulty]}18`,
                color: DIFF_COLOR[inc.difficulty],
                border: `1px solid ${DIFF_COLOR[inc.difficulty]}40`,
              }}>{inc.difficulty}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Scoring note */}
      <div style={{ marginTop: "1.5rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-text-dim)", lineHeight: 1.7 }}>
        Score = <span style={{ color: "#60a5fa" }}>0.2</span> × detect + <span style={{ color: "#fbbf24" }}>0.3</span> × diagnose + <span style={{ color: "#34d399" }}>0.5</span> × fix - time penalty.
        Solved if score ≥ <span style={{ color: "var(--color-success)" }}>0.70</span>.
      </div>
    </div>
  );
}
