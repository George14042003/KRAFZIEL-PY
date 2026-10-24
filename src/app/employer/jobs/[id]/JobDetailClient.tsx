"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  cardStyle,
  dangerButtonStyle,
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import { listCandidates, type Candidate } from "@/lib/candidates";
import {
  deleteJob,
  getJob,
  linkCandidateToJob,
  listApplicationsForJob,
  updateApplication,
  updateJob,
  type EmploymentType,
  type Job,
  type JobApplication,
  type JobApplicationStatus,
  type JobStatus,
} from "@/lib/jobs";

const EMPLOYMENT_TYPES: EmploymentType[] = ["full_time", "part_time", "contract", "internship"];
const JOB_STATUSES: JobStatus[] = ["draft", "open", "closed", "filled"];
const APPLICATION_STATUSES: JobApplicationStatus[] = [
  "submitted",
  "under_review",
  "shortlisted",
  "interviewing",
  "offered",
  "hired",
  "rejected",
  "withdrawn",
];

function labelize(value: string): string {
  return value
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function JobDetailClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { user, loading } = useSession("employer");

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "applicants">("overview");

  useEffect(() => {
    if (!user) return;
    Promise.all([getJob(jobId), listApplicationsForJob(jobId)])
      .then(([jobData, applicationsData]) => {
        setJob(jobData);
        setApplications(applicationsData);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load this job."))
      .finally(() => setDataLoading(false));
  }, [user, jobId]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  async function handleStatusChange(status: JobStatus) {
    if (!job) return;
    const updated = await updateJob(job.id, { status });
    setJob(updated);
  }

  async function handleDelete() {
    if (!job) return;
    if (!confirm(`Delete "${job.title}"? This also removes its applications.`)) return;
    await deleteJob(job.id);
    router.push("/employer/jobs");
  }

  return (
    <DashboardShell user={user}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <Link href="/employer/jobs" style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}>
          &larr; Back to jobs
        </Link>

        {dataLoading && (
          <div style={{ color: "var(--text-tertiary)", fontSize: "13px", marginTop: "16px" }}>Loading…</div>
        )}

        {loadError && (
          <div style={{ ...cardStyle, marginTop: "16px" }}>
            <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }} role="alert">
              {loadError}
            </p>
          </div>
        )}

        {job && (
          <div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
            {(
              [
                { key: "overview", label: "Overview" },
                { key: "applicants", label: `Applicants (${applications.length})` },
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
        )}

        {job && activeTab === "overview" && !editing && (
          <div className="fade-in" style={{ ...cardStyle, marginTop: "12px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0 }}>{job.title}</h1>
                  <StatusBadge status={job.status} />
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  {[job.department, job.location, labelize(job.employment_type)].filter(Boolean).join(" · ")}
                </p>
                {(job.salary_min || job.salary_max) && (
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0" }}>
                    {job.salary_min ? job.salary_min.toLocaleString() : "?"} &ndash;{" "}
                    {job.salary_max ? job.salary_max.toLocaleString() : "?"}
                  </p>
                )}
                {job.created_by_name && (
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0" }}>Posted by {job.created_by_name}</p>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" style={secondaryButtonStyle} onClick={() => setEditing(true)}>
                  Edit
                </button>
                {job.created_by_email === user.email && (
                  <button type="button" style={dangerButtonStyle} onClick={handleDelete}>
                    Delete
                  </button>
                )}
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
              {job.description}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>Status</label>
              <select value={job.status} onChange={(e) => handleStatusChange(e.target.value as JobStatus)} style={{ ...inputStyle, width: "auto" }}>
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {labelize(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {job && activeTab === "overview" && editing && (
          <EditJobForm job={job} onCancel={() => setEditing(false)} onSaved={(updated) => { setJob(updated); setEditing(false); }} />
        )}

        {job && activeTab === "applicants" && (
          <div className="fade-in" style={{ marginTop: "12px" }}>
            <LinkCandidatePanel
              jobId={job.id}
              alreadyLinkedIds={applications.map((a) => a.candidate.id)}
              onLinked={(application) => setApplications((prev) => [application, ...prev])}
            />

            {applications.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "12px" }}>No applicants yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
                {applications.map((application) => (
                  <ApplicationRow
                    key={application.id}
                    application={application}
                    onUpdated={(updated) =>
                      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function EditJobForm({
  job,
  onCancel,
  onSaved,
}: {
  job: Job;
  onCancel: () => void;
  onSaved: (job: Job) => void;
}) {
  const [title, setTitle] = useState(job.title);
  const [department, setDepartment] = useState(job.department ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(job.employment_type);
  const [salaryMin, setSalaryMin] = useState(job.salary_min?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(job.salary_max?.toString() ?? "");
  const [description, setDescription] = useState(job.description);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await updateJob(job.id, {
        title,
        description,
        department: department || undefined,
        location: location || undefined,
        employment_type: employmentType,
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="fade-in" style={{ ...cardStyle, marginTop: "12px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <label style={labelStyle}>Job Title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>Department</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>Employment Type</label>
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} style={inputStyle}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {labelize(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Salary Min</label>
          <input type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Salary Max</label>
          <input type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={6} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {error && (
        <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function ApplicationRow({
  application,
  onUpdated,
}: {
  application: JobApplication;
  onUpdated: (application: JobApplication) => void;
}) {
  async function handleStatusChange(status: JobApplicationStatus) {
    const updated = await updateApplication(application.id, { status });
    onUpdated(updated);
  }

  return (
    <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{application.candidate.applicant_name}</div>
        <div style={{ fontSize: "12px", color: "#64748b" }}>{application.candidate.applicant_email}</div>
        {application.cover_letter && (
          <p style={{ fontSize: "12px", color: "#334155", marginTop: "4px", whiteSpace: "pre-wrap" }}>{application.cover_letter}</p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Link
          href={`/employer/candidates/${application.candidate.id}`}
          style={{ ...secondaryButtonStyle, padding: "6px 10px", fontSize: "12px", textDecoration: "none" }}
        >
          View Candidate
        </Link>
        <select
          value={application.status}
          onChange={(e) => handleStatusChange(e.target.value as JobApplicationStatus)}
          style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LinkCandidatePanel({
  jobId,
  alreadyLinkedIds,
  onLinked,
}: {
  jobId: string;
  alreadyLinkedIds: string[];
  onLinked: (application: JobApplication) => void;
}) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && candidates.length === 0) {
      listCandidates().then(setCandidates).catch(() => {});
    }
  }, [open, candidates.length]);

  const q = search.trim().toLowerCase();
  const matches = candidates
    .filter((c) => !alreadyLinkedIds.includes(c.id))
    .filter((c) => !q || c.applicant_name.toLowerCase().includes(q) || c.applicant_email.toLowerCase().includes(q))
    .slice(0, 8);

  async function handleLink(candidateId: string) {
    setLinkingId(candidateId);
    setError(null);
    try {
      const application = await linkCandidateToJob(jobId, candidateId);
      onLinked(application);
      setOpen(false);
      setSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link this candidate.");
    } finally {
      setLinkingId(null);
    }
  }

  if (!open) {
    return (
      <button type="button" style={secondaryButtonStyle} onClick={() => setOpen(true)}>
        + Link Existing Candidate
      </button>
    );
  }

  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={labelStyle}>Link a candidate already in your pool to this job</label>
        <button type="button" onClick={() => setOpen(false)} style={{ ...secondaryButtonStyle, padding: "4px 10px", fontSize: "11px" }}>
          Close
        </button>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        style={inputStyle}
        autoFocus
      />
      {error && (
        <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
          {error}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto" }}>
        {matches.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No matching candidates.</p>
        ) : (
          matches.map((c) => (
            <div
              key={c.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "8px", background: "#f8fafc" }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>{c.applicant_name}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>{c.applicant_email}</div>
              </div>
              <button
                type="button"
                disabled={linkingId === c.id}
                onClick={() => handleLink(c.id)}
                style={{ ...secondaryButtonStyle, padding: "5px 10px", fontSize: "11px", opacity: linkingId === c.id ? 0.6 : 1 }}
              >
                {linkingId === c.id ? "Linking…" : "Link"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
