"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBreakdown } from "@/components/dashboard/StatusBreakdown";
import { useSession } from "@/hooks/useSession";
import { SparklesIcon } from "@/components/auth/icons";
import { listCandidates, listAllInterviews, listAllOffers, type Candidate, type Interview, type Offer } from "@/lib/candidates";

function isUpcoming(interview: Interview): boolean {
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

const SOURCE_COLORS = ["#dc2626", "#ea580c", "#7c3aed", "#0d9488", "#4338ca", "#059669", "#be185d", "#0f172a"];

function sourceColor(source: string): string {
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  return SOURCE_COLORS[hash % SOURCE_COLORS.length];
}

const INTERVIEW_TYPE_COLORS: Record<string, string> = {
  phone: "#0ea5e9",
  video: "#dc2626",
  onsite: "#8b5cf6",
  technical: "#f59e0b",
  final: "#22c55e",
  bot: "#64748b",
};

const panelCardStyle = {
  background: "#fff",
  border: "1px solid #eef1f5",
  borderRadius: "16px",
  padding: "16px 18px",
  boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
} as const;

const panelLabelStyle = {
  display: "block" as const,
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#94a3b8",
  marginBottom: "12px",
  borderLeft: "3px solid #01617a",
  paddingLeft: "10px",
};

function renderBarRows(rows: { label: string; count: number; color: string }[]) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: row.color, flexShrink: 0 }} />
          <span
            style={{
              fontSize: "12px",
              color: "#334155",
              width: "132px",
              flexShrink: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textTransform: "capitalize",
            }}
            title={row.label}
          >
            {row.label}
          </span>
          <div style={{ flex: 1, height: "6px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(row.count / max) * 100}%`,
                background: row.color,
                borderRadius: "999px",
              }}
            />
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", width: "22px", textAlign: "right" }}>
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EmployerApp() {
  const { user, loading } = useSession("employer");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCandidates(), listAllInterviews(), listAllOffers()])
      .then(([candidatesData, interviewsData, offersData]) => {
        setCandidates(candidatesData);
        setInterviews(interviewsData);
        setOffers(offersData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your insights."))
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
  const upcomingInterviews = interviews.filter(isUpcoming).sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  const now = new Date();
  const activeInPipeline = candidates.filter((c) => c.status !== "hired" && c.status !== "rejected").length;
  const activePct = candidates.length ? Math.round((activeInPipeline / candidates.length) * 100) : 0;
  const interviewsToday = interviews.filter((i) => {
    const d = new Date(i.scheduled_at);
    return d.toDateString() === now.toDateString();
  }).length;
  const addedThisMonth = candidates.filter((c) => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const pendingReview = candidates.filter((c) => c.status === "pending").length;
  const hiredCount = candidates.filter((c) => c.status === "hired").length;
  const rejectedCount = candidates.filter((c) => c.status === "rejected").length;

  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const interviewsThisWeek = interviews.filter((i) => {
    const d = new Date(i.scheduled_at);
    return i.status === "scheduled" && d.getTime() >= now.getTime() && d.getTime() <= sevenDaysOut.getTime();
  }).length;

  const offersExtended = offers.length;
  const offersAccepted = offers.filter((o) => o.status === "accepted").length;
  const offersDecided = offers.filter((o) => o.status === "accepted" || o.status === "declined").length;
  const acceptanceRate = offersDecided ? Math.round((offersAccepted / offersDecided) * 100) : 0;

  const sourceCounts = (() => {
    const map = new Map<string, number>();
    candidates.forEach((c) => {
      const key = c.source?.trim() || "Unspecified";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count, color: sourceColor(label) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  })();

  const interviewTypeCounts = (() => {
    const map = new Map<string, number>();
    interviews.forEach((i) => {
      map.set(i.interview_type, (map.get(i.interview_type) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count, color: INTERVIEW_TYPE_COLORS[label] ?? "#64748b" }))
      .sort((a, b) => b.count - a.count);
  })();

  return (
    <DashboardShell user={user}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "16px",
            padding: "14px 18px",
            background: "linear-gradient(135deg, #3f3f46 0%, #18181b 55%, #0a275f 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "-60px",
              right: "-40px",
              width: "160px",
              height: "160px",
              borderRadius: "50%",
              background: "#01617a",
              filter: "blur(70px)",
              opacity: 0.3,
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 10px",
                borderRadius: "999px",
                background: "rgba(8,145,178,0.22)",
                border: "1px solid rgba(103,232,249,0.35)",
                color: "#a5f3fc",
                fontSize: "9.5px",
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              <SparklesIcon size={9} color="#a5f3fc" />
              AI-Powered Interview Scheduling
            </span>
            <h1 style={{ fontSize: "17px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
              Welcome back, {firstName}
              <span style={{ color: "#a1a1aa" }}> — </span>
              <span
                style={{
                  background: "linear-gradient(90deg, #67e8f9, #22d3ee)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Hire Smarter with Nextenti
              </span>
            </h1>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", margin: "3px 0 0" }}>
              Your hiring pipeline at a glance
            </p>
          </div>
          <Link
            href="/employer/candidates"
            style={{
              position: "relative",
              zIndex: 1,
              padding: "9px 18px",
              background: "#01617a",
              color: "#fff",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "12px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            View Candidate Pool →
          </Link>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          <StatCard label="Total Candidates" value={candidates.length} hint="In the shared pool" accent="#6366f1" />
          <StatCard
            label="Active in Pipeline"
            value={`${activePct}%`}
            hint={`${activeInPipeline} not yet closed`}
            accent="#0ea5e9"
          />
          <StatCard label="Interviews Today" value={interviewsToday} hint="Scheduled today" accent="#0a275f" />
          <StatCard label="Added This Month" value={addedThisMonth} hint="New to the pool" accent="#8b5cf6" />
          <StatCard label="Pending Review" value={pendingReview} hint="Awaiting first look" accent="#f59e0b" />
          <StatCard label="Hired" value={hiredCount} hint={`${rejectedCount} rejected`} accent="#22c55e" />
          <StatCard label="Interviews This Week" value={interviewsThisWeek} hint="Next 7 days" accent="#0a275f" />
          <StatCard
            label="Offers Extended"
            value={offersExtended}
            hint={offersDecided ? `${acceptanceRate}% accepted` : "No decisions yet"}
            accent="#22c55e"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
            gap: "14px",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #eef1f5",
              borderRadius: "16px",
              padding: "18px 20px",
              boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
            }}
          >
            <StatusBreakdown candidates={candidates} compact />
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #eef1f5",
              borderRadius: "16px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#94a3b8",
                marginBottom: "10px",
                borderLeft: "3px solid #01617a",
                paddingLeft: "10px",
                flexShrink: 0,
              }}
            >
              Upcoming Interviews
            </span>

            <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {dataLoading ? (
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Loading…</p>
              ) : upcomingInterviews.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Nothing scheduled yet.</p>
              ) : (
                upcomingInterviews.map((interview) => {
                  const candidate = candidates.find((c) => c.id === interview.candidate_id);
                  return (
                    <Link
                      key={interview.id}
                      href={`/employer/candidates/${interview.candidate_id}`}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "9px 12px",
                        textDecoration: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                        {candidate?.applicant_name ?? "Candidate"}
                      </span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {interview.interview_type} with {interview.interviewer_name}
                      </span>
                      <span style={{ fontSize: "11px", color: "#01617a", fontWeight: 700 }}>
                        {formatWhen(interview.scheduled_at)}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: "14px",
          }}
        >
          <div style={panelCardStyle}>
            <span style={panelLabelStyle}>Candidates by Source</span>
            {sourceCounts.length === 0 ? (
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No candidates yet.</p>
            ) : (
              renderBarRows(sourceCounts)
            )}
          </div>

          <div style={panelCardStyle}>
            <span style={panelLabelStyle}>Interviews by Type</span>
            {interviewTypeCounts.length === 0 ? (
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No interviews yet.</p>
            ) : (
              renderBarRows(interviewTypeCounts)
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
