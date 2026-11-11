"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { AuroraLoading, JobStatusChip } from "./JobStatusChip";
import { useSession } from "@/hooks/useSession";
import { listJobs, type Job, type JobStatus } from "@/lib/jobs";

const STATUS_FILTERS: { value: JobStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "filled", label: "Filled" },
];

function employmentLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function JobsListClient() {
  const { user, loading } = useSession("employer");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");

  useEffect(() => {
    if (!user) return;
    listJobs()
      .then(setJobs)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load jobs."))
      .finally(() => setDataLoading(false));
  }, [user]);

  const statusCounts = useMemo(() => {
    const counts = new Map<JobStatus, number>();
    for (const j of jobs) counts.set(j.status, (counts.get(j.status) ?? 0) + 1);
    return counts;
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        (j.department ?? "").toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, search, statusFilter]);

  if (loading || !user) {
    return <AuroraLoading />;
  }

  const cols = "2fr 1fr 1fr 1fr .8fr .9fr";

  return (
    <DashboardShell user={user}>
      <AuroraPageHeader
        eyebrow="Hiring"
        title="Jobs"
        subtitle={`${jobs.length} requisitions posted by your team`}
        actions={
          <Link href="/employer/jobs/new" className={`${styles.btn} ${styles.btnAccent}`}>
            + New Job
          </Link>
        }
      />

      {error && (
        <p style={{ fontSize: "13px", color: "#C4123A", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <div style={{ color: "var(--text-3)", fontSize: "13px" }}>Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div
          className={`${styles.glass} ${styles.card}`}
          style={{ padding: "56px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
        >
          <span className={styles.display} style={{ fontSize: 20, fontWeight: 600 }}>No jobs posted yet</span>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0, maxWidth: 380 }}>
            Post a requisition so candidates can browse and apply from their dashboard.
          </p>
          <Link href="/employer/jobs/new" className={`${styles.btn} ${styles.btnAccent}`} style={{ marginTop: 10 }}>
            + New Job
          </Link>
        </div>
      ) : (
        <div className={styles.sidebarLayout}>
          <aside className={`${styles.glass} ${styles.sideCard}`}>
            <span className={styles.sideLabel}>Status</span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatusFilter(s.value)}
                className={`${styles.fi} ${statusFilter === s.value ? styles.fiOn : ""}`}
              >
                {s.label}
                <span className={styles.n}>{s.value === "all" ? jobs.length : statusCounts.get(s.value) ?? 0}</span>
              </button>
            ))}
          </aside>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div
              className={styles.glass}
              style={{ borderRadius: 28, padding: "20px 24px", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}
            >
              <div className={styles.field} style={{ flex: "1 1 300px" }}>
                <label className={styles.lbl} htmlFor="job-search">Search</label>
                <input
                  id="job-search"
                  className={styles.inp}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Title, department, location…"
                />
              </div>
              <span style={{ fontSize: 13, color: "var(--text-3)", minHeight: 48, display: "flex", alignItems: "center" }}>
                {filteredJobs.length} shown
              </span>
            </div>

            <div className={`${styles.glass} ${styles.tableCard}`}>
              <div className={styles.tableScroll}>
                <div className={styles.th} style={{ gridTemplateColumns: cols }}>
                  <span>Title</span>
                  <span>Department</span>
                  <span>Location</span>
                  <span>Type</span>
                  <span>Applicants</span>
                  <span>Status</span>
                </div>

                {filteredJobs.length === 0 ? (
                  <p style={{ fontSize: 14, color: "var(--text-4)", padding: "24px 28px", margin: 0, borderTop: "1px solid var(--line-soft)" }}>
                    No jobs match these filters.
                  </p>
                ) : (
                  filteredJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/employer/jobs/${job.id}`}
                      className={styles.tr}
                      style={{ gridTemplateColumns: cols, color: "var(--text-2)", fontSize: 13 }}
                    >
                      <span className={styles.display} style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{job.title}</span>
                      <span>{job.department || "—"}</span>
                      <span>{job.location || "—"}</span>
                      <span>{employmentLabel(job.employment_type)}</span>
                      <span className={styles.display} style={{ fontWeight: 700, color: "var(--text)" }}>{job.application_count}</span>
                      <span>
                        <JobStatusChip status={job.status} />
                      </span>
                    </Link>
                  ))
                )}
              </div>
              <div className={styles.tableFoot}>
                {filteredJobs.length} of {jobs.length} jobs
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
