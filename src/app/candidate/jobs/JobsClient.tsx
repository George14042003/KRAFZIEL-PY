"use client";

import { useEffect, useState } from "react";
import { CANDIDATE_NAV, DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cardStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import {
  applyToJob,
  listMyApplications,
  listOpenJobs,
  withdrawApplication,
  type JobBoardListing,
  type MyApplication,
} from "@/lib/jobs";

const TERMINAL_STATUSES = new Set(["hired", "rejected", "withdrawn"]);

function labelize(value: string): string {
  return value
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function formatSalaryRange(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min ?? max) as number);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function JobsClient() {
  const { user, loading } = useSession("candidate");
  const [activeTab, setActiveTab] = useState<"open" | "mine">("open");
  const [jobs, setJobs] = useState<JobBoardListing[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listOpenJobs(), listMyApplications()])
      .then(([jobsData, applicationsData]) => {
        setJobs(jobsData);
        setApplications(applicationsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load jobs."))
      .finally(() => setDataLoading(false));
  }, [user]);

  function handleApplied(jobId: string, application: MyApplication) {
    setApplications((prev) => [application, ...prev]);
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, already_applied: true, my_application_status: application.status } : j))
    );
  }

  async function handleWithdraw(applicationId: string) {
    if (!confirm("Withdraw this application?")) return;
    const updated = await withdrawApplication(applicationId);
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? updated : a)));
  }

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  return (
    <DashboardShell user={user} nav={CANDIDATE_NAV}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>Jobs</h1>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>
            Browse open roles and track every application in one place.
          </p>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {(
            [
              { key: "open", label: "Open Roles" },
              { key: "mine", label: `My Applications (${applications.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: "none",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                background: activeTab === tab.key ? "#fff" : "var(--chrome-surface)",
                color: activeTab === tab.key ? "#0f172a" : "var(--text-secondary)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        {dataLoading ? (
          <p style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>Loading…</p>
        ) : activeTab === "open" ? (
          jobs.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>No open roles right now — check back soon.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onApplied={(application) => handleApplied(job.id, application)} />
              ))}
            </div>
          )
        ) : applications.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>You haven&apos;t applied to any jobs yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {applications.map((application) => (
              <div
                key={application.id}
                style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>{application.job.title}</span>
                    <StatusBadge status={application.status} />
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {[application.job.department, application.job.location].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Applied {formatDate(application.created_at)}</div>
                </div>
                {!TERMINAL_STATUSES.has(application.status) && (
                  <button type="button" style={secondaryButtonStyle} onClick={() => handleWithdraw(application.id)}>
                    Withdraw
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function JobCard({ job, onApplied }: { job: JobBoardListing; onApplied: (application: MyApplication) => void }) {
  const [applying, setApplying] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const salaryRange = formatSalaryRange(job.salary_min, job.salary_max);

  async function handleApply() {
    setSubmitting(true);
    setError(null);
    try {
      const application = await applyToJob(job.id, { cover_letter: coverLetter || undefined });
      onApplied({
        id: application.id,
        status: application.status,
        cover_letter: application.cover_letter,
        created_at: application.created_at,
        updated_at: application.updated_at,
        job: {
          id: job.id,
          title: job.title,
          department: job.department,
          location: job.location,
          employment_type: job.employment_type,
          status: "open",
          salary_min: job.salary_min,
          salary_max: job.salary_max,
        },
      });
      setApplying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>{job.title}</span>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
            {[job.department, job.location, labelize(job.employment_type)].filter(Boolean).join(" · ")}
          </div>
          {salaryRange && <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{salaryRange}</div>}
        </div>
        {job.already_applied ? (
          <StatusBadge status={job.my_application_status ?? "submitted"} />
        ) : !applying ? (
          <button type="button" style={primaryButtonStyle} onClick={() => setApplying(true)}>
            Apply
          </button>
        ) : null}
      </div>

      <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{job.description}</p>

      {applying && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={3}
            placeholder="Add a short note to your application (optional)…"
            style={{ ...inputStyle, resize: "vertical" }}
          />
          {error && (
            <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
              {error}
            </p>
          )}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" style={secondaryButtonStyle} onClick={() => setApplying(false)}>
              Cancel
            </button>
            <button type="button" disabled={submitting} onClick={handleApply} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
