import type { CSSProperties } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
};

const DEFAULT_ACCENT = "#01617a";

export function StatCard({ label, value, hint, accent = DEFAULT_ACCENT }: StatCardProps) {
  const cardStyle: CSSProperties = {
    position: "relative",
    background: "#fff",
    border: "1px solid #eef1f5",
    borderRadius: "12px",
    padding: "14px 16px 14px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: 0,
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.05)",
  };

  return (
    <div style={cardStyle}>
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "4px",
          background: accent,
        }}
      />
      <span
        style={{
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          color: "#64748b",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
        {value}
      </span>
      {hint && (
        <span style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.3 }} title={hint}>
          {hint}
        </span>
      )}
    </div>
  );
}
