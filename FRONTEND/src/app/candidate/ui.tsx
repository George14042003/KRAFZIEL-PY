import aurora from "@/components/aurora/aurora.module.css";

export const STATUS_COLORS: Record<string, string> = {
  pending: "#FFB020",
  reviewed: "#38BDF8",
  interviewing: "#00B4FF",
  offered: "#FB7185",
  hired: "#34D399",
  rejected: "#8B93A7",
  accepted: "#34D399",
  declined: "#FB7185",
  withdrawn: "#8B93A7",
  scheduled: "#38BDF8",
  completed: "#34D399",
  cancelled: "#8B93A7",
  rescheduled: "#FFB020",
  no_show: "#FB7185",
  submitted: "#38BDF8",
  under_review: "#FFB020",
  shortlisted: "#00B4FF",
};

export function labelize(value: string): string {
  return value
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Status chip: coloured text on a ~16% tint with a dot. */
export function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? "#8B93A7";
  return (
    <span className={aurora.chip} style={{ color: c, background: `${c}29` }}>
      <span className={aurora.dot} style={{ background: c }} />
      {labelize(status)}
    </span>
  );
}

export function ArrowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7 M8 7h9v9" />
    </svg>
  );
}

export function CalendarIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4" />
    </svg>
  );
}
