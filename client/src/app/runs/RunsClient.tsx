"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RunsClient() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <button
      onClick={() => router.refresh()}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.6875rem",
        color: "var(--color-text-muted)",
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-soft)",
        borderRadius: 6,
        padding: "5px 12px",
        cursor: "pointer",
      }}
    >
      ↻ refresh
    </button>
  );
}
