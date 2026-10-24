"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CANDIDATE_NAV, DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalCandidate, type PortalInterview } from "@/lib/candidates";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  reviewed: "#0ea5e9",
  interviewing: "#8b5cf6",
  offered: "#dc2626",
  hired: "#22c55e",
  rejected: "#64748b",
};

function statusLabel(status: string): string {
  return status[0].toUpperCase() + status.slice(1);
}

function isUpcoming(interview: PortalInterview): boolean {
  return interview.status === "scheduled" && new Date(interview.scheduled_at).getTime() >= Date.now();
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CandidateApp() {
  const { user, loading } = useSession("candidate");
  const [candidate, setCandidate] = useState<PortalCandidate | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyPortal()
      .then((res) => setCandidate(res.candidate))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your info."))
      .finally(() => setDataLoading(false));
  }, [user]);

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontSize: "14px",
        }}
      >
        Loading…
      </div>
    );
  }

  const firstName = user.full_name.split(" ")[0];
  const upcomingInterviews = (candidate?.interviews ?? [])
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <DashboardShell user={user} nav={CANDIDATE_NAV}>
      <WelcomeBanner role="candidate" />

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            Welcome back, {firstName}
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>
            Here&apos;s where your interviews and offers show up.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div
          style={{
            background: "#0a1e2b",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
            maxWidth: "360px",
          }}
        >
          <div style={{ padding: "12px 14px 0" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7fd9c9" }}>
              Tutorial
            </span>
            <p style={{ fontSize: "12px", color: "#eaf6f4", margin: "4px 0 10px" }}>
              New here? Watch how the AI interview engine works before your interview.
            </p>
          </div>
          <video
            suppressHydrationWarning
            style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="auto"
            aria-label="Explainer video walking through how the NAIE AI interview engine works"
          >
            <source src="/videos/ai_interview_engine_explainer.mp4" type="video/mp4" />
          </video>
        </div>

        {!dataLoading && !candidate ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
              You&apos;re not in our pipeline yet
            </span>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0, maxWidth: "380px" }}>
              Once a recruiter adds you and schedules an interview, everything will show up here
              automatically &mdash; no extra steps needed.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "10px",
              }}
            >
              <StatCard
                label="Current Stage"
                value={candidate ? statusLabel(candidate.status) : "—"}
                hint="Where you are in the process"
                accent={candidate ? STATUS_COLORS[candidate.status] ?? "#64748b" : "#64748b"}
              />
              <StatCard
                label="Upcoming Interviews"
                value={upcomingInterviews.length}
                hint="Scheduled ahead"
                accent="#0ea5e9"
              />
              <StatCard
                label="Total Interviews"
                value={candidate?.interviews.length ?? 0}
                hint="All time"
                accent="#8b5cf6"
              />
              <StatCard
                label="Offers"
                value={candidate?.offers.length ?? 0}
                hint="Extended to you"
                accent="#22c55e"
              />
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #eef1f5",
                borderRadius: "16px",
                padding: "16px 18px",
                boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
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
                  marginBottom: "12px",
                  borderLeft: "3px solid #01617a",
                  paddingLeft: "10px",
                }}
              >
                Upcoming Interviews
              </span>

              {dataLoading ? (
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Loading…</p>
              ) : upcomingInterviews.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Nothing scheduled yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {upcomingInterviews.map((interview) => (
                    <div
                      key={interview.id}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
                          {interview.interview_type} interview with {interview.interviewer_name}
                        </span>
                        <div style={{ fontSize: "11px", color: "#01617a", fontWeight: 700, marginTop: "2px" }}>
                          {formatWhen(interview.scheduled_at)}
                        </div>
                      </div>
                      {interview.interview_type === "video" && (
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
                      {interview.interview_type === "bot" && (
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
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
