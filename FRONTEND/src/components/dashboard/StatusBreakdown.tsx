import type { Candidate, CandidateStatus } from "@/lib/candidates";

const ORDER: CandidateStatus[] = ["pending", "reviewed", "interviewing", "offered", "hired", "rejected"];

const COLORS: Record<CandidateStatus, string> = {
  pending: "#f59e0b",
  reviewed: "#0ea5e9",
  interviewing: "#00B4FF",
  offered: "#dc2626",
  hired: "#22c55e",
  rejected: "#64748b",
};

function labelFor(status: CandidateStatus): string {
  return status[0].toUpperCase() + status.slice(1);
}

type StatusBreakdownProps = {
  candidates: Candidate[];
  compact?: boolean;
};

export function StatusBreakdown({ candidates, compact = false }: StatusBreakdownProps) {
  const counts = ORDER.map((status) => ({
    status,
    count: candidates.filter((c) => c.status === status).length,
  })).filter((row) => row.count > 0 || candidates.length === 0);

  const max = Math.max(1, ...counts.map((row) => row.count));

  const rows = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))",
        rowGap: compact ? "10px" : "16px",
        columnGap: "32px",
      }}
    >
      {counts.map((row) => (
        <div key={row.status} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: COLORS[row.status],
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "13px", color: "#334155", width: "92px", flexShrink: 0 }}>
            {labelFor(row.status)}
          </span>
          <div style={{ flex: 1, height: "6px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(row.count / max) * 100}%`,
                background: COLORS[row.status],
                borderRadius: "999px",
              }}
            />
          </div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", width: "28px", textAlign: "right" }}>
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );

  if (compact) {
    return (
      <>
        <span
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#94a3b8",
            marginBottom: "12px",
            borderLeft: "3px solid #01617a",
            paddingLeft: "10px",
          }}
        >
          Candidates by Status
        </span>
        {rows}
      </>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "24px",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#94a3b8",
          marginBottom: "18px",
          borderLeft: "3px solid #01617a",
          paddingLeft: "10px",
        }}
      >
        Candidates by Status
      </span>
      {rows}
    </div>
  );
}
