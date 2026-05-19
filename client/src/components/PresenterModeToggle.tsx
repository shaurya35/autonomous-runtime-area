"use client";
import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";

export function PresenterModeToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(localStorage.getItem("presenterMode") === "1");
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("presenterMode", next ? "1" : "0");
    document.documentElement.style.setProperty("--transition-speed", next ? "1000ms" : "600ms");
  }

  return (
    <button onClick={toggle} title="Toggle presenter mode" style={{
      display: "flex", alignItems: "center", gap: 6,
      background: enabled ? "#3b82f622" : "transparent",
      border: `1px solid ${enabled ? "#3b82f6" : "var(--color-border-soft)"}`,
      borderRadius: 6, padding: "4px 10px", cursor: "pointer",
      color: enabled ? "var(--color-doctor)" : "var(--color-text-muted)",
      fontSize: "0.75rem",
    }}>
      <Monitor size={13} />
      {enabled ? "Presenter ON" : "Presenter"}
    </button>
  );
}
