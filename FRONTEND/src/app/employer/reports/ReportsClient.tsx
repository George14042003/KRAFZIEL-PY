"use client";

import { useEffect, useMemo, useState } from "react";
import { CountUp } from "@/components/aurora/CountUp";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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
import local from "./reports.module.css";

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

const CANDIDATE_COLORS: Record<CandidateStatus, string> = {
  pending: "#00B4FF",
  reviewed: "#0066FF",
  interviewing: "#0F172A",
  offered: "#3B4147",
  hired: "#00E5FF",
  rejected: "#FF2D55",
};

const JOB_COLORS: Record<JobStatus, string> = {
  draft: "#9CA3AF",
  open: "#0066FF",
  closed: "#9CA3AF",
  filled: "#9CA3AF",
};

function KpiCard({ label, value, sub, bar }: { label: string; value: string | number; sub?: string; bar: string }) {
  return (
    <div className={`${local.stat} ${styles.glass}`}>
      <i className={local.statBar} style={{ background: bar }} />
      <div className={local.statLabel} style={{ color: "var(--text-4)" }}>
        {label}
      </div>
      <div className={local.statValue}>
        <CountUp value={value} />
      </div>
      {sub && (
        <div className={local.statFoot} style={{ color: "var(--text-3)" }}>
          {sub}
        </div>
      )}
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
    <div className={`${styles.glass} ${styles.card}`} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <h2 className={styles.display} style={{ fontWeight: 600, fontSize: "18px", margin: 0 }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {rows.map((r) => {
          const pct = total === 0 ? 0 : Math.round((r.count / total) * 100);
          return (
            <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "14px" }}>
                <span style={{ fontWeight: 500 }}>{r.label}</span>
                <span style={{ color: "var(--text-3)", fontSize: "13px" }}>
                  <b className={styles.display} style={{ fontSize: "17px", color: "var(--text)" }}>
                    {r.count}
                  </b>{" "}
                  ({pct}%)
                </span>
              </div>
              <div className={styles.bar}>
                <i style={{ width: `${pct}%`, background: r.color }} />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p style={{ fontSize: "13px", color: "var(--text-3)", margin: 0 }}>No data yet.</p>}
      </div>
    </div>
  );
}

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
    return Object.keys(CANDIDATE_STATUS_LABELS).map((status) => ({
      label: CANDIDATE_STATUS_LABELS[status as CandidateStatus],
      count: counts.get(status as CandidateStatus) ?? 0,
      color: CANDIDATE_COLORS[status as CandidateStatus],
    }));
  }, [candidates]);

  const jobBreakdown = useMemo(() => {
    const counts = new Map<JobStatus, number>();
    for (const j of jobs) counts.set(j.status, (counts.get(j.status) ?? 0) + 1);
    return Object.keys(JOB_STATUS_LABELS).map((status) => ({
      label: JOB_STATUS_LABELS[status as JobStatus],
      count: counts.get(status as JobStatus) ?? 0,
      color: JOB_COLORS[status as JobStatus],
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
      <AuroraPageHeader
        eyebrow="Analytics"
        title="Reports & Analytics"
        subtitle="A snapshot of your hiring pipeline across every job and candidate."
      />

      {error && (
        <p style={{ fontSize: "13px", color: "#C4123A", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <div style={{ color: "var(--text-3)", fontSize: "14px" }}>Crunching the numbers…</div>
      ) : (
        <>
          <div className={local.stats}>
            <KpiCard bar="#0066FF" label="Candidates" value={candidates.length} sub="in your pool" />
            <KpiCard bar="#00B4FF" label="Open Jobs" value={jobs.filter((j) => j.status === "open").length} sub={`of ${jobs.length} total`} />
            <KpiCard bar="#00E5FF" label="Upcoming Interviews" value={upcomingInterviews} sub={`${interviews.length} total scheduled`} />
            <KpiCard bar="#0F172A" label="Accepted Offers" value={acceptedOffers} sub={`of ${offers.length} extended`} />
            <KpiCard bar="#3B4147" label="Hire Rate" value={`${hireRate}%`} sub="of all candidates" />
          </div>

          <div className={styles.two}>
            <BreakdownCard title="Candidates by status" rows={candidateBreakdown} total={candidates.length} />
            <BreakdownCard title="Jobs by status" rows={jobBreakdown} total={jobs.length} />
          </div>
        </>
      )}
    </DashboardShell>
  );
}
