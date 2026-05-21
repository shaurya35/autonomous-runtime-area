"use client";

import { useEffect, useRef, useState } from "react";
import {
  createWorkspace,
  registerWorkspaceApp,
  setActiveWorkspaceId,
  type Workspace,
} from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardPage() {
  const [step, setStep] = useState<Step>(1);
  const [wsName, setWsName] = useState("");
  const [appName, setAppName] = useState("");
  const [healthUrl, setHealthUrl] = useState("http://your-app:8080/healthz");
  const [metricsUrl, setMetricsUrl] = useState("http://your-app:8080/metrics");
  const [logsService, setLogsService] = useState("app");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Step 5: SSE watching for agent_connected
  useEffect(() => {
    if (step !== 4 || !workspace) return;
    const es = new EventSource(`${API}/workspaces/${workspace.id}/events`, { withCredentials: true });
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.kind === "agent_connected") {
          setConnected(true);
          setStep(5);
          es.close();
        }
      } catch {}
    };
    return () => { es.close(); };
  }, [step, workspace]);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const ws = await createWorkspace(wsName);
      await registerWorkspaceApp(ws.id, {
        name: appName,
        health_url: healthUrl,
        metrics_url: metricsUrl,
        logs_service: logsService,
      });
      setWorkspace(ws);
      setActiveWorkspaceId(ws.id);
      setStep(3);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  }

  const composeSnippet = workspace
    ? `  sentinel-agent:
    image: ghcr.io/sentinel-sh/agent:latest
    environment:
      - SENTINEL_KEY=${workspace.api_key}
      - SENTINEL_API_URL=${API.replace("http://", "ws://").replace("https://", "wss://")}
      - HEALTH_URL=${healthUrl}
      - METRICS_URL=${metricsUrl}
      - LOGS_SERVICE=${logsService}
      - RESTART_TARGET=${logsService}
    volumes:
      - .:/workspace
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped`
    : "";

  function copySnippet() {
    navigator.clipboard.writeText(composeSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ maxWidth: 600, margin: "5rem auto", padding: "0 1.5rem", fontFamily: "var(--font-mono)" }}>
      <StepIndicator current={step} />

      {step === 1 && (
        <div>
          <h2 style={heading}>Name your workspace</h2>
          <form onSubmit={e => { e.preventDefault(); setStep(2); }} style={form}>
            <label style={label}>Workspace name</label>
            <input style={input} value={wsName} onChange={e => setWsName(e.target.value)} placeholder="acme-prod" required />
            <label style={label}>App name</label>
            <input style={input} value={appName} onChange={e => setAppName(e.target.value)} placeholder="api-server" required />
            <button type="submit" style={btn}>Next →</button>
          </form>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 style={heading}>Connect your app</h2>
          <form onSubmit={handleStep1} style={form}>
            <label style={label}>Health URL</label>
            <input style={input} value={healthUrl} onChange={e => setHealthUrl(e.target.value)} placeholder="http://app:8080/healthz" required />
            <label style={label}>Metrics URL (Prometheus)</label>
            <input style={input} value={metricsUrl} onChange={e => setMetricsUrl(e.target.value)} placeholder="http://app:8080/metrics" />
            <label style={label}>Docker service name (for logs)</label>
            <input style={input} value={logsService} onChange={e => setLogsService(e.target.value)} placeholder="app" required />
            {error && <div style={{ color: "var(--color-critical)", fontSize: "var(--text-caption)" }}>{error}</div>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={() => setStep(1)} style={{ ...btn, background: "transparent", border: "1px solid var(--color-border-soft)", color: "var(--color-text-muted)" }}>← Back</button>
              <button type="submit" disabled={loading} style={btn}>{loading ? "Saving…" : "Save & continue →"}</button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && workspace && (
        <div>
          <h2 style={heading}>Add the sidecar to your compose</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginBottom: "1rem", lineHeight: 1.6 }}>
            Paste this into your <code>docker-compose.yml</code> under <code>services:</code>, then run <code>docker compose up sentinel-agent</code>.
          </p>
          <div style={{ position: "relative" }}>
            <pre style={{
              background: "var(--color-bg-panel)",
              border: "1px solid var(--color-border-soft)",
              borderRadius: 4,
              padding: "1rem",
              fontSize: "var(--text-caption)",
              overflowX: "auto",
              margin: 0,
              color: "var(--color-text-secondary)",
            }}>
              {composeSnippet}
            </pre>
            <button onClick={copySnippet} style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-soft)",
              borderRadius: 3,
              padding: "3px 8px",
              fontSize: "0.65rem",
              cursor: "pointer",
              color: copied ? "var(--color-success)" : "var(--color-text-muted)",
            }}>
              {copied ? "copied!" : "copy"}
            </button>
          </div>
          <button onClick={() => setStep(4)} style={{ ...btn, marginTop: "1.5rem" }}>
            I&apos;ve added it →
          </button>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2 style={heading}>Waiting for agent…</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginBottom: "2rem", lineHeight: 1.6 }}>
            Run <code>docker compose up sentinel-agent</code> in your project. This page will update automatically when it connects.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--color-warn)", animation: "heartbeat 1.5s ease-in-out infinite" }} />
            listening for connection…
          </div>
        </div>
      )}

      {step === 5 && workspace && (
        <div>
          <h2 style={{ ...heading, color: "var(--color-success)" }}>✓ Connected</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginBottom: "2rem", lineHeight: 1.6 }}>
            Sentinel is now monitoring <strong style={{ color: "var(--color-text-primary)" }}>{appName || "your app"}</strong>. Head to your dashboard to see live vitals and manage incidents.
          </p>
          <a href="/dashboard" style={{ ...btn, display: "inline-block", textDecoration: "none" }}>
            Go to dashboard →
          </a>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps = ["Workspace", "App details", "Install sidecar", "Connecting", "Done"];
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2.5rem", alignItems: "center" }}>
      {steps.map((label, i) => {
        const n = (i + 1) as Step;
        const done = current > n;
        const active = current === n;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: done ? "var(--color-success)" : active ? "var(--color-accent)" : "var(--color-bg-elevated)",
              border: `1px solid ${done || active ? "transparent" : "var(--color-border-soft)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.6rem", color: done || active ? "#000" : "var(--color-text-dim)", fontWeight: 600,
            }}>
              {done ? "✓" : n}
            </div>
            <span style={{ fontSize: "var(--text-caption)", color: active ? "var(--color-text-primary)" : "var(--color-text-dim)" }}>
              {label}
            </span>
            {i < steps.length - 1 && <span style={{ color: "var(--color-border-strong)", marginLeft: 2 }}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

const heading: React.CSSProperties = {
  fontSize: "var(--text-h2)",
  fontWeight: 500,
  marginBottom: "1.25rem",
  color: "var(--color-text-primary)",
};

const form: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.625rem",
};

const label: React.CSSProperties = {
  fontSize: "var(--text-caption)",
  color: "var(--color-text-muted)",
  marginBottom: -4,
};

const input: React.CSSProperties = {
  background: "var(--color-bg-panel)",
  border: "1px solid var(--color-border-soft)",
  borderRadius: 4,
  padding: "0.5rem 0.75rem",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-sm)",
  color: "var(--color-text-primary)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const btn: React.CSSProperties = {
  background: "var(--color-accent)",
  color: "#000",
  border: "none",
  borderRadius: 4,
  padding: "0.5rem 1rem",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "0.5rem",
};
