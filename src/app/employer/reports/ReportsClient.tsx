"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { cardStyle } from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import {
  listAllInterviews,
  listAllOffers,
  listCandidates,
  type Candidate,
  type CandidateStatus,
  type Interview,
  type Offer,
} from "@/lib/candidates";
import { listJobs, type Job, type JobStatus } from "@/lib/jobs";

const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  interviewing: "Interviewing",
  offered: "Offered",
  hired: "Hired",
  rejected: "Rejected",
};

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  filled: "Filled",
};

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", color: "#94a3b8", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", margin: "6px 0 2px" }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: "#64748b" }}>{sub}</div>}
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; count: number; color: string }[];
  total: number;
}) {
  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
      <h2 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", margin: 0 }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rows.map((r) => {
          const pct = total === 0 ? 0 : Math.round((r.count / total) * 100);
          return (
            <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#334155" }}>
                <span>{r.label}</span>
                <span style={{ fontWeight: 700 }}>
                  {r.count} <span style={{ color: "#94a3b8", fontWeight: 500 }}>({pct}%)</span>
                </span>
              </div>
              <div style={{ height: "6px", borderRadius: "999px", background: "#f1f5f9", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: r.color, borderRadius: "999px" }} />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No data yet.</p>}
      </div>
    </div>
  );
}

const PALETTE = ["#0891b2", "#7c3aed", "#ea580c", "#dc2626", "#15803d", "#4338ca", "#b45309"];

export function ReportsClient() {
  const { user, loading } = useSession("employer");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCandidates(), listAllInterviews(), listAllOffers(), listJobs()])
      .then(([candidatesData, interviewsData, offersData, jobsData]) => {
        setCandidates(candidatesData);
        setInterviews(interviewsData);
        setOffers(offersData);
        setJobs(jobsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load report data."))
      .finally(() => setDataLoading(false));
  }, [user]);

  const candidateBreakdown = useMemo(() => {
    const counts = new Map<CandidateStatus, number>();
    for (const c of candidates) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
    return Object.keys(CANDIDATE_STATUS_LABELS).map((status, i) => ({
      label: CANDIDATE_STATUS_LABELS[status as CandidateStatus],
      count: counts.get(status as CandidateStatus) ?? 0,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [candidates]);

  const jobBreakdown = useMemo(() => {
    const counts = new Map<JobStatus, number>();
    for (const j of jobs) counts.set(j.status, (counts.get(j.status) ?? 0) + 1);
    return Object.keys(JOB_STATUS_LABELS).map((status, i) => ({
      label: JOB_STATUS_LABELS[status as JobStatus],
      count: counts.get(status as JobStatus) ?? 0,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [jobs]);

  const upcomingInterviews = useMemo(
    () => interviews.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at).getTime() > Date.now()).length,
    [interviews]
  );

  const acceptedOffers = useMemo(() => offers.filter((o) => o.status === "accepted").length, [offers]);
  const hireRate = candidates.length === 0 ? 0 : Math.round((candidates.filter((c) => c.status === "hired").length / candidates.length) * 100);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  return (
    <DashboardShell user={user}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
          Dashboard <span style={{ color: "var(--text-faint)" }}>/</span> Reports &amp; Analytics
        </p>

        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            Reports &amp; Analytics
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            A snapshot of your hiring pipeline across every job and candidate.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        {dataLoading ? (
          <div style={{ color: "#94a3b8", fontSize: "13px" }}>Crunching the numbers…</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
              <KpiCard label="Candidates" value={candidates.length} sub="in your pool" />
              <KpiCard label="Open Jobs" value={jobs.filter((j) => j.status === "open").length} sub={`of ${jobs.length} total`} />
              <KpiCard label="Upcoming Interviews" value={upcomingInterviews} sub={`${interviews.length} total scheduled`} />
              <KpiCard label="Accepted Offers" value={acceptedOffers} sub={`of ${offers.length} extended`} />
              <KpiCard label="Hire Rate" value={`${hireRate}%`} sub="of all candidates" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              <BreakdownCard title="Candidates by Status" rows={candidateBreakdown} total={candidates.length} />
              <BreakdownCard title="Jobs by Status" rows={jobBreakdown} total={jobs.length} />
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
