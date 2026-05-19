import { CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw, BadgeCheck } from "lucide-react";
import type { Status } from "../lib/api";

const CONFIG: Record<Status, { label: string; icon: React.ReactNode; color: string }> = {
  healthy:    { label: "Healthy",    icon: <CheckCircle2 size={12} />,  color: "#10b981" },
  watch:      { label: "Watch",      icon: <AlertTriangle size={12} />, color: "#f59e0b" },
  critical:   { label: "Critical",   icon: <AlertOctagon size={12} />,  color: "#ef4444" },
  recovering: { label: "Recovering", icon: <RefreshCw size={12} />,     color: "#34d399" },
  discharged: { label: "Discharged", icon: <BadgeCheck size={12} />,    color: "#3b82f6" },
};

interface Props {
  status: Status;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  label?: string;
}

const SIZE_STYLES = {
  sm: { fontSize: "0.6875rem", padding: "1px 6px" },
  md: { fontSize: "0.75rem", padding: "2px 8px" },
  lg: { fontSize: "0.875rem", padding: "3px 10px" },
};

export function StatusPill({ status, size = "md", pulse, label }: Props) {
  const cfg = CONFIG[status];
  const shouldPulse = pulse ?? status === "critical";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      borderRadius: 999, border: `1px solid ${cfg.color}33`,
      backgroundColor: `${cfg.color}1a`, color: cfg.color,
      animation: shouldPulse ? "pulse 1.5s ease-in-out infinite" : undefined,
      ...SIZE_STYLES[size],
    }}>
      {cfg.icon}{label ?? cfg.label}
    </span>
  );
}
