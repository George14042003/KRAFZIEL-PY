import type { CSSProperties } from "react";

const PALETTES: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#f1f5f9", color: "#475569" },
  open: { bg: "#dcfce7", color: "#15803d" },
  closed: { bg: "#f1f5f9", color: "#64748b" },
  filled: { bg: "#e0e7ff", color: "#4338ca" },
  pending: { bg: "#fef3c7", color: "#b45309" },
  reviewed: { bg: "#e0f2fe", color: "#0369a1" },
  interviewing: { bg: "#ede9fe", color: "#6d28d9" },
  offered: { bg: "#fee2e2", color: "#b91c1c" },
  hired: { bg: "#dcfce7", color: "#15803d" },
  rejected: { bg: "#f1f5f9", color: "#64748b" },
  accepted: { bg: "#dcfce7", color: "#15803d" },
  declined: { bg: "#f1f5f9", color: "#64748b" },
  withdrawn: { bg: "#f1f5f9", color: "#64748b" },
  scheduled: { bg: "#e0f2fe", color: "#0369a1" },
  completed: { bg: "#dcfce7", color: "#15803d" },
  cancelled: { bg: "#f1f5f9", color: "#64748b" },
  rescheduled: { bg: "#fef3c7", color: "#b45309" },
  no_show: { bg: "#fee2e2", color: "#b91c1c" },
  submitted: { bg: "#e0f2fe", color: "#0369a1" },
  under_review: { bg: "#fef3c7", color: "#b45309" },
  shortlisted: { bg: "#ede9fe", color: "#6d28d9" },
};

function labelFor(status: string): string {
  return status
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  const palette = PALETTES[status] ?? { bg: "#f1f5f9", color: "#475569" };
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    background: palette.bg,
    color: palette.color,
    whiteSpace: "nowrap",
  };
  return <span style={style}>{labelFor(status)}</span>;
}
