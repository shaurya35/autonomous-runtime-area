"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "8rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-h2)", marginBottom: "1.5rem", color: "var(--color-text-primary)" }}>
        Login
      </h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && (
          <div style={{ color: "var(--color-critical)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)" }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? "Logging in…" : "Login →"}
        </button>
      </form>
      <p style={{ marginTop: "1.5rem", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-muted)" }}>
        No account?{" "}
        <Link href="/signup" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Sign up</Link>
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
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

const btnStyle: React.CSSProperties = {
  background: "var(--color-accent)",
  color: "#000",
  border: "none",
  borderRadius: 4,
  padding: "0.5rem 1rem",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  cursor: "pointer",
};
