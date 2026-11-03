import styles from "@/components/aurora/aurora.module.css";

export const JOB_STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280",
  open: "#007C8A",
  closed: "#6B7280",
  filled: "#0B7A4B",
};

export function JobStatusChip({ status }: { status: string }) {
  const c = JOB_STATUS_COLORS[status] ?? "#6B7280";
  return (
    <span className={styles.chip} style={{ color: c, background: `${c}29` }}>
      <span className={styles.dot} style={{ background: c }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export { AuroraLoading } from "@/components/aurora/AuroraLoading";
