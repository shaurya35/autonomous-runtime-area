"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, logout, type User } from "@/lib/auth";

export function Nav() {
  const [user, setUser] = useState<User | null | "loading">("loading");

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await logout().catch(() => {});
    setUser(null);
    window.location.href = "/";
  };

  return (
    <nav style={{
      borderBottom: "1px solid var(--color-border-soft)",
      padding: "0 1.5rem",
      height: "3rem",
      display: "flex",
      alignItems: "center",
      gap: "1.5rem",
    }}>
      <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-primary)", textDecoration: "none" }}>
        sentinel
      </Link>

      {user && user !== "loading" ? (
        <>
          <Link href="/dashboard" style={navLink}>dashboard</Link>
          <Link href="/leaderboard" style={navLink}>leaderboard</Link>
          <Link href="/demo" style={navLink}>demo</Link>
          <Link href="/runs" style={navLink}>runs</Link>
          <Link href="/docs" style={navLink}>docs</Link>
          <span style={{ flex: 1 }} />
          <span style={{ ...navLink, color: "var(--color-text-dim)" }}>{user.email}</span>
          <button onClick={handleLogout} style={{ ...navLink, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            logout
          </button>
        </>
      ) : (
        <>
          <Link href="/demo" style={navLink}>benchmark</Link>
          <Link href="/leaderboard" style={navLink}>leaderboard</Link>
          <Link href="/runs" style={navLink}>runs</Link>
          <Link href="/docs" style={navLink}>docs</Link>
          <span style={{ flex: 1 }} />
          {user !== "loading" && (
            <>
              <Link href="/login" style={navLink}>login</Link>
              <Link href="/signup" style={{ ...navLink, color: "var(--color-accent)" }}>sign up</Link>
            </>
          )}
        </>
      )}
    </nav>
  );
}

const navLink: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-sm)",
  color: "var(--color-text-muted)",
  textDecoration: "none",
};
