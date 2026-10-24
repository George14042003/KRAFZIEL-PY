"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CANDIDATE_NAV, DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cardStyle } from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalInterview } from "@/lib/candidates";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isUpcoming(interview: PortalInterview): boolean {
  return interview.status === "scheduled" && new Date(interview.scheduled_at).getTime() >= Date.now();
}

export function InterviewsClient() {
  const { user, loading } = useSession("candidate");
  const [interviews, setInterviews] = useState<PortalInterview[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyPortal()
      .then((res) => setInterviews(res.candidate?.interviews ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your interviews."))
      .finally(() => setDataLoading(false));
  }, [user]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  const sorted = [...interviews].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  const upcoming = sorted.filter(isUpcoming);
  const past = sorted.filter((i) => !isUpcoming(i));

  function renderRow(interview: PortalInterview) {
    return (
      <div
        key={interview.id}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          padding: "14px 16px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
              {interview.interview_type} interview
            </span>
            <StatusBadge status={interview.status} />
          </div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>with {interview.interviewer_name}</div>
          <div style={{ fontSize: "12px", color: "#01617a", fontWeight: 700, marginTop: "2px" }}>
            {formatWhen(interview.scheduled_at)} · {interview.duration_minutes} min
          </div>
        </div>
        {interview.interview_type === "video" && interview.status === "scheduled" && (
          <Link
            href={`/call/${interview.id}`}
            target="_blank"
            style={{
              padding: "8px 16px",
              background: "#01617a",
              color: "#fff",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "12px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Join Call
          </Link>
        )}
        {interview.interview_type === "bot" && interview.status === "scheduled" && (
          <Link
            href={`/bot-interview/${interview.id}`}
            target="_blank"
            style={{
              padding: "8px 16px",
              background: "#01617a",
              color: "#fff",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "12px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Take Interview
          </Link>
        )}
      </div>
    );
  }

  return (
    <DashboardShell user={user} nav={CANDIDATE_NAV}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            My Interviews
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>
            Every interview scheduled for you, past and upcoming.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div style={cardStyle}>
          <span
            style={{
              display: "block",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: "14px",
              borderLeft: "3px solid #01617a",
              paddingLeft: "10px",
            }}
          >
            Upcoming
          </span>
          {dataLoading ? (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Loading…</p>
          ) : upcoming.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Nothing scheduled yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{upcoming.map(renderRow)}</div>
          )}
        </div>

        <div style={cardStyle}>
          <span
            style={{
              display: "block",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: "14px",
              borderLeft: "3px solid #94a3b8",
              paddingLeft: "10px",
            }}
          >
            Past
          </span>
          {dataLoading ? (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Loading…</p>
          ) : past.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No past interviews.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{past.map(renderRow)}</div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
