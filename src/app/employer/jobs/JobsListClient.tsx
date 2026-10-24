"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
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
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  return (
    <DashboardShell user={user}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>Jobs</h1>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              {jobs.length} requisitions posted by your team
            </p>
          </div>
          <Link
            href="/employer/jobs/new"
            style={{
              padding: "9px 16px",
              background: "#01617a",
              color: "#fff",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "13px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            + Post Job
          </Link>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        {dataLoading ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Loading jobs…</div>
        ) : jobs.length === 0 ? (
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
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>No jobs posted yet</span>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0, maxWidth: "360px" }}>
              Post a requisition so candidates can browse and apply from their dashboard.
            </p>
            <Link
              href="/employer/jobs/new"
              style={{ marginTop: "8px", padding: "10px 18px", background: "#01617a", color: "#fff", borderRadius: "10px", fontWeight: 700, fontSize: "13px", textDecoration: "none" }}
            >
              + Post Job
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "16px" }}>
            <aside
              style={{
                width: "200px",
                flexShrink: 0,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                alignSelf: "flex-start",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", color: "#94a3b8" }}>STATUS</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatusFilter(s.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: statusFilter === s.value ? "#e0f2fe" : "transparent",
                      color: statusFilter === s.value ? "#01617a" : "#334155",
                      fontWeight: statusFilter === s.value ? 700 : 500,
                      fontSize: "13px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {s.label}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        background: statusFilter === s.value ? "#bae6fd" : "#f1f5f9",
                        color: statusFilter === s.value ? "#014a5e" : "#64748b",
                        borderRadius: "999px",
                        padding: "1px 8px",
                      }}
                    >
                      {s.value === "all" ? jobs.length : statusCounts.get(s.value) ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "14px 18px",
                }}
              >
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, department, location…"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", color: "#0f172a", outline: "none" }}
                />
              </div>

              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 0.8fr 0.8fr",
                    gap: "8px",
                    padding: "12px 18px",
                    borderBottom: "1px solid #e2e8f0",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    color: "#94a3b8",
                  }}
                >
                  <span>TITLE</span>
                  <span>DEPARTMENT</span>
                  <span>LOCATION</span>
                  <span>TYPE</span>
                  <span>APPLICANTS</span>
                  <span>STATUS</span>
                </div>

                {filteredJobs.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#94a3b8", padding: "24px 18px" }}>No jobs match these filters.</p>
                ) : (
                  filteredJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/employer/jobs/${job.id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr 0.8fr 0.8fr",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 18px",
                        borderBottom: "1px solid #f1f5f9",
                        textDecoration: "none",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{job.title}</span>
                      <span style={{ fontSize: "12px", color: "#334155" }}>{job.department || "—"}</span>
                      <span style={{ fontSize: "12px", color: "#334155" }}>{job.location || "—"}</span>
                      <span style={{ fontSize: "12px", color: "#334155" }}>{employmentLabel(job.employment_type)}</span>
                      <span style={{ fontSize: "12px", color: "#334155" }}>{job.application_count}</span>
                      <span>
                        <StatusBadge status={job.status} />
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
