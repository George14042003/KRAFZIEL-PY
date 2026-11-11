"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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
  experienceLabel,
} from "@/lib/jobs";
import { ApplicationResumePanel, PortfolioBadge } from "@/components/applications/ApplicationResume";
import { AuroraLoading, JobStatusChip } from "../JobStatusChip";

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

const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 } as const;

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
    return <AuroraLoading />;
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

  const meta = job ? [job.department, job.location, labelize(job.employment_type)].filter(Boolean).join(" · ") : "";

  return (
    <DashboardShell user={user}>
      {job ? (
        <AuroraPageHeader
          eyebrow="Job"
          title={job.title}
          subtitle={
            <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <JobStatusChip status={job.status} />
              <span>{meta}</span>
            </span>
          }
          actions={
            <>
              <Link href="/employer/jobs" className={`${styles.btn} ${styles.btnGlass}`}>
                &larr; Back to jobs
              </Link>
              {activeTab === "overview" && !editing && (
                <button type="button" className={`${styles.btn} ${styles.btnLight}`} onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              {job.created_by_email === user.email && (
                <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete}>
                  Delete
                </button>
              )}
            </>
          }
        />
      ) : (
        <div>
          <Link href="/employer/jobs" className={`${styles.btn} ${styles.btnGlass}`}>
            &larr; Back to jobs
          </Link>
        </div>
      )}

      {dataLoading && <div style={{ color: "var(--text-3)", fontSize: 13 }}>Loading…</div>}

      {loadError && (
        <div className={`${styles.glass} ${styles.cardSm}`}>
          <p style={{ fontSize: 13, color: "#C4123A", margin: 0 }} role="alert">
            {loadError}
          </p>
        </div>
      )}

      {job && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
              className={`${styles.btn} ${styles.btnSm} ${activeTab === tab.key ? styles.btnAccent : styles.btnGlass}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {job && activeTab === "overview" && !editing && (
        <div className={styles.two}>
          <div className={`${styles.glass} ${styles.card}`} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span className={styles.sideLabel} style={{ padding: 0 }}>Description</span>
            <p style={{ fontSize: 15, color: "var(--text-2)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>
              {job.description}
            </p>
          </div>

          <div className={`${styles.glass} ${styles.card}`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <span className={styles.sideLabel} style={{ padding: 0 }}>Details</span>
            <DetailRow label="Department" value={job.department || "—"} />
            <DetailRow label="Location" value={job.location || "—"} />
            <DetailRow label="Employment type" value={labelize(job.employment_type)} />
            {(job.salary_min || job.salary_max) && (
              <DetailRow
                label="Salary range"
                value={`${job.salary_min ? job.salary_min.toLocaleString() : "?"} – ${job.salary_max ? job.salary_max.toLocaleString() : "?"}`}
              />
            )}
            {experienceLabel(job.experience_min_years) && <DetailRow label="Experience" value={experienceLabel(job.experience_min_years) as string} />}
            {job.created_by_name && <DetailRow label="Posted by" value={job.created_by_name} />}
            <div className={styles.field}>
              <label className={styles.lbl} htmlFor="job-status">Status</label>
              <select
                id="job-status"
                className={styles.inp}
                value={job.status}
                onChange={(e) => handleStatusChange(e.target.value as JobStatus)}
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {labelize(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {job && activeTab === "overview" && editing && (
        <EditJobForm job={job} onCancel={() => setEditing(false)} onSaved={(updated) => { setJob(updated); setEditing(false); }} />
      )}

      {job && activeTab === "applicants" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LinkCandidatePanel
            jobId={job.id}
            alreadyLinkedIds={applications.map((a) => a.candidate.id)}
            onLinked={(application) => setApplications((prev) => [application, ...prev])}
          />

          {applications.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--text-4)", margin: 0 }}>No applicants yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
    </DashboardShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px solid var(--line-soft)", paddingBottom: 12 }}>
      <span style={{ fontSize: 13, color: "var(--text-3)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
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
  const [experience, setExperience] = useState(job.experience_min_years?.toString() ?? "");
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
        experience_min_years: experience === "" ? null : Number(experience),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${styles.glass} ${styles.card}`}
      style={{ maxWidth: 820, width: "100%", padding: 32, display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div className={styles.field}>
        <label className={styles.lbl}>Job Title</label>
        <input className={styles.inp} required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div style={grid2}>
        <div className={styles.field}>
          <label className={styles.lbl}>Department</label>
          <input className={styles.inp} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Location</label>
          <input className={styles.inp} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div style={grid2}>
        <div className={styles.field}>
          <label className={styles.lbl}>Employment Type</label>
          <select className={styles.inp} value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {labelize(t)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Salary Min</label>
          <input className={styles.inp} type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Salary Max</label>
          <input className={styles.inp} type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.lbl} htmlFor="edit-experience">Experience required, in years</label>
        <input id="edit-experience" className={styles.inp} type="number" min={0} max={50} value={experience} onChange={(e) => setExperience(e.target.value)} />
        <span style={{ fontSize: 12, color: "var(--text-4)" }}>0 means fresher. Roles asking for more than 8 years allow 5 look-away warnings in the bot interview; all others allow 2.</span>
      </div>
      <div className={styles.field}>
        <label className={styles.lbl}>Description</label>
        <textarea
          className={styles.inp}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          style={{ resize: "vertical", padding: "14px 16px", lineHeight: 1.5 }}
        />
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "#C4123A", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "flex-end" }}>
        <button type="button" className={`${styles.btn} ${styles.btnGlass}`} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} className={`${styles.btn} ${styles.btnAccent}`}>
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
  const [showResume, setShowResume] = useState(false);

  async function handleStatusChange(status: JobApplicationStatus) {
    const updated = await updateApplication(application.id, { status });
    onUpdated(updated);
  }

  return (
    <div
      className={`${styles.glass} ${styles.cardSm}`}
      style={{ borderRadius: 28, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
    >
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <div className={styles.display} style={{ fontSize: 16, fontWeight: 600, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {application.candidate.applicant_name}
          <PortfolioBadge application={application} />
        </div>
        <div style={{ fontSize: 13, color: "var(--text-3)" }}>{application.candidate.applicant_email}</div>
        {application.resume_data?.total_experience_years != null && (
          <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 2 }}>
            {application.resume_data.total_experience_years === 0 ? "Fresher" : `${application.resume_data.total_experience_years} years experience`} per resume
          </div>
        )}
        {application.cover_letter && (
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{application.cover_letter}</p>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        {(application.resume_data || application.portfolio_url) && (
          <button type="button" className={`${styles.btn} ${styles.btnGlass} ${styles.btnSm}`} aria-expanded={showResume} onClick={() => setShowResume((v) => !v)}>
            {showResume ? "Hide resume" : "View resume"}
          </button>
        )}
        <Link href={`/employer/candidates/${application.candidate.id}`} className={`${styles.btn} ${styles.btnGlass} ${styles.btnSm}`}>
          View Candidate
        </Link>
        <select
          className={`${styles.chip} ${styles.chipSelect}`}
          aria-label="Application status"
          value={application.status}
          onChange={(e) => handleStatusChange(e.target.value as JobApplicationStatus)}
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
      </div>
      {showResume && (
        <div style={{ flexBasis: "100%", borderTop: "1px solid var(--line-soft)", paddingTop: 16 }}>
          <ApplicationResumePanel application={application} />
        </div>
      )}
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
      <div>
        <button type="button" className={`${styles.btn} ${styles.btnGlass}`} onClick={() => setOpen(true)}>
          + Link Existing Candidate
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.glass} ${styles.card}`} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <label className={styles.lbl}>Link a candidate already in your pool to this job</label>
        <button type="button" onClick={() => setOpen(false)} className={`${styles.btn} ${styles.btnGlass} ${styles.btnSm}`}>
          Close
        </button>
      </div>
      <input
        className={styles.inp}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        autoFocus
      />
      {error && (
        <p style={{ fontSize: 13, color: "#C4123A", margin: 0 }} role="alert">
          {error}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
        {matches.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-4)", margin: 0 }}>No matching candidates.</p>
        ) : (
          matches.map((c) => (
            <div
              key={c.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderRadius: 16, background: "var(--fill-soft)" }}
            >
              <div style={{ minWidth: 0 }}>
                <div className={styles.display} style={{ fontSize: 14, fontWeight: 600 }}>{c.applicant_name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>{c.applicant_email}</div>
              </div>
              <button
                type="button"
                disabled={linkingId === c.id}
                onClick={() => handleLink(c.id)}
                className={`${styles.btn} ${styles.btnAccent} ${styles.btnSm}`}
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
