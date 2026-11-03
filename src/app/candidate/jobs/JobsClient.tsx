"use client";

import { useEffect, useMemo, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { useSession } from "@/hooks/useSession";
import {
  applyWithResume,
  experienceLabel,
  listMyApplications,
  listOpenJobs,
  withdrawApplication,
  type JobBoardListing,
  type MyApplication,
} from "@/lib/jobs";
import s from "../candidate.module.css";
import { StatusChip, labelize } from "../ui";

const TERMINAL_STATUSES = new Set(["hired", "rejected", "withdrawn"]);
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

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
  const [query, setQuery] = useState("");

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

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.title, j.department, j.location, j.description].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [jobs, query]);

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

  if (loading || !user) return <AuroraLoading />;

  return (
    <>
      <AuroraPageHeader
        eyebrow="Careers"
        title="Jobs"
        subtitle="Browse open roles and track every application in one place."
        actions={
          <div className={s.tabs}>
            {(
              [
                { key: "open", label: `Open Roles (${jobs.length})` },
                { key: "mine", label: `My Applications (${applications.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`${aurora.btn} ${activeTab === tab.key ? aurora.btnAccent : aurora.btnGlass}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <p className={s.muted}>Loading…</p>
      ) : activeTab === "open" ? (
        jobs.length === 0 ? (
          <div className={`${aurora.glass} ${aurora.card} ${s.emptyCard}`}>
            <span className={s.emptyTitle}>No open roles</span>
            <p className={s.emptyText}>No open roles right now — check back soon.</p>
          </div>
        ) : (
          <div className={s.col}>
            <div className={`${aurora.glass} ${s.filterCard}`}>
              <div className={`${aurora.field} ${s.grow}`}>
                <label className={aurora.lbl} htmlFor="job-search">
                  Search
                </label>
                <input
                  id="job-search"
                  className={aurora.inp}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Title, department, location…"
                />
              </div>
              <span className={s.muted} style={{ fontSize: 13, minHeight: 48, display: "flex", alignItems: "center" }}>
                {filteredJobs.length} shown
              </span>
            </div>
            {filteredJobs.length === 0 ? (
              <p className={s.muted}>No roles match your search.</p>
            ) : (
              <div className={s.jobGrid}>
                {filteredJobs.map((job) => (
                  <JobCard key={job.id} job={job} onApplied={(application) => handleApplied(job.id, application)} />
                ))}
              </div>
            )}
          </div>
        )
      ) : applications.length === 0 ? (
        <div className={`${aurora.glass} ${aurora.card} ${s.emptyCard}`}>
          <span className={s.emptyTitle}>No applications yet</span>
          <p className={s.emptyText}>You haven&apos;t applied to any jobs yet.</p>
        </div>
      ) : (
        <div className={s.col}>
          {applications.map((application) => (
            <div key={application.id} className={`${aurora.glass} ${aurora.cardSm} ${s.cardHead}`}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className={s.strong} style={{ fontSize: 16 }}>
                    {application.job.title}
                  </span>
                  <StatusChip status={application.status} />
                </div>
                <div className={s.jobMeta}>
                  {[application.job.department, application.job.location].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className={s.jobMeta} style={{ fontSize: 12 }}>
                  Applied {formatDate(application.created_at)}
                </div>
              </div>
              {!TERMINAL_STATUSES.has(application.status) && (
                <button type="button" className={`${aurora.btn} ${aurora.btnGlass} ${aurora.btnSm}`} onClick={() => handleWithdraw(application.id)}>
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function JobCard({ job, onApplied }: { job: JobBoardListing; onApplied: (application: MyApplication) => void }) {
  const [applying, setApplying] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const salaryRange = formatSalaryRange(job.salary_min, job.salary_max);
  const experience = experienceLabel(job.experience_min_years);

  function pickResume(file: File | null) {
    setError(null);
    if (!file) return setResume(null);
    if (!/\.(doc|docx)$/i.test(file.name)) {
      setResume(null);
      return setError("Please upload your resume as a Word document (.doc or .docx).");
    }
    if (file.size > MAX_RESUME_BYTES) {
      setResume(null);
      return setError("That file is too large. Please keep your resume under 5 MB.");
    }
    setResume(file);
  }

  async function handleApply() {
    if (!resume) return setError("Upload your resume (.doc or .docx) to apply.");
    setSubmitting(true);
    setError(null);
    try {
      const application = await applyWithResume(job.id, {
        resume,
        portfolio_url: portfolioUrl,
        cover_letter: coverLetter,
      });
      onApplied({
        id: application.id,
        status: application.status,
        cover_letter: application.cover_letter,
        resume_filename: application.resume_filename,
        portfolio_url: application.portfolio_url,
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
          experience_min_years: job.experience_min_years,
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
    <div className={`${aurora.glass} ${aurora.card} ${aurora.lift} ${s.job}`}>
      <div className={s.jobHead}>
        <div>
          <span className={s.jobTitle}>{job.title}</span>
          <div className={s.jobMeta}>
            {[job.department, job.location, labelize(job.employment_type)].filter(Boolean).join(" · ")}
          </div>
          {salaryRange && <span className={s.salary}>{salaryRange}</span>}
          {experience && (
            <div className={s.jobMeta} style={{ marginTop: 4 }}>
              Experience: {experience}
            </div>
          )}
        </div>
        {job.already_applied ? (
          <StatusChip status={job.my_application_status ?? "submitted"} />
        ) : !applying ? (
          <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} onClick={() => setApplying(true)}>
            Apply
          </button>
        ) : null}
      </div>

      <p className={s.desc}>{job.description}</p>

      {applying && (
        <div className={s.applyBox}>
          <div className={aurora.field}>
            <label className={aurora.lbl} htmlFor={`resume-${job.id}`}>
              Resume (Word .doc or .docx)
            </label>
            <input
              id={`resume-${job.id}`}
              type="file"
              accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className={aurora.inp}
              style={{ paddingTop: 12 }}
              disabled={submitting}
              onChange={(e) => pickResume(e.target.files?.[0] ?? null)}
            />
            <p className={s.muted} style={{ fontSize: 12 }}>
              {resume ? `${resume.name} selected.` : "We read it and show the employer a clean summary, and use it to tailor your interview questions."}
            </p>
          </div>
          <div className={aurora.field}>
            <label className={aurora.lbl} htmlFor={`portfolio-${job.id}`}>
              Portfolio link (optional)
            </label>
            <input
              id={`portfolio-${job.id}`}
              type="url"
              inputMode="url"
              className={aurora.inp}
              value={portfolioUrl}
              maxLength={500}
              disabled={submitting}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://your-portfolio.vercel.app"
            />
          </div>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={3}
            placeholder="Add a short note to your application (optional)…"
            className={`${aurora.inp} ${s.textarea}`}
          />
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <div className={s.rowActions}>
            <button type="button" className={`${aurora.btn} ${aurora.btnGlass}`} onClick={() => setApplying(false)}>
              Cancel
            </button>
            <button type="button" disabled={submitting || !resume} onClick={handleApply} className={`${aurora.btn} ${aurora.btnAccent}`}>
              {submitting ? "Reading your resume…" : "Submit Application"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
