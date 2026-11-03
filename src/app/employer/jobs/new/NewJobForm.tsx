"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useSession } from "@/hooks/useSession";
import { createJob, type EmploymentType, type JobStatus } from "@/lib/jobs";
import { AuroraLoading } from "../JobStatusChip";

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const JOB_STATUSES: { value: JobStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "filled", label: "Filled" },
];

const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 } as const;

export function NewJobForm() {
  const router = useRouter();
  const { user, loading } = useSession("employer");

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("full_time");
  const [jobStatus, setJobStatus] = useState<JobStatus>("draft");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [experience, setExperience] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !user) {
    return <AuroraLoading />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const job = await createJob({
        title,
        description,
        department: department || undefined,
        location: location || undefined,
        employment_type: employmentType,
        status: jobStatus,
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
        experience_min_years: experience === "" ? null : Number(experience),
      });
      router.push(`/employer/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post this job.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell user={user}>
      <AuroraPageHeader
        eyebrow="Hiring"
        title="Post a Job"
        subtitle="Publish a requisition candidates can browse and apply to from their dashboard."
        actions={
          <Link href="/employer/jobs" className={`${styles.btn} ${styles.btnGlass}`}>
            &larr; Back to jobs
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit}
        className={`${styles.glass} ${styles.card}`}
        style={{ maxWidth: 760, width: "100%", padding: 32, display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div className={styles.field}>
          <label className={styles.lbl}>Job Title</label>
          <input className={styles.inp} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Product Designer" />
        </div>

        <div style={grid2}>
          <div className={styles.field}>
            <label className={styles.lbl}>Department (optional)</label>
            <input className={styles.inp} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Design" />
          </div>
          <div className={styles.field}>
            <label className={styles.lbl}>Location (optional)</label>
            <input className={styles.inp} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote, Bengaluru…" />
          </div>
        </div>

        <div style={grid2}>
          <div className={styles.field}>
            <label className={styles.lbl}>Employment Type</label>
            <select className={styles.inp} value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.lbl}>Status</label>
            <select className={styles.inp} value={jobStatus} onChange={(e) => setJobStatus(e.target.value as JobStatus)}>
              {JOB_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={grid2}>
          <div className={styles.field}>
            <label className={styles.lbl}>Salary Min (optional)</label>
            <input className={styles.inp} type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="90000" />
          </div>
          <div className={styles.field}>
            <label className={styles.lbl}>Salary Max (optional)</label>
            <input className={styles.inp} type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="130000" />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.lbl} htmlFor="job-experience">Experience required, in years (optional)</label>
          <input
            id="job-experience"
            className={styles.inp}
            type="number"
            min={0}
            max={50}
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="e.g. 5"
          />
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
            placeholder="Responsibilities, requirements, what makes this role great…"
            style={{ resize: "vertical", padding: "14px 16px", lineHeight: 1.5 }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "#C4123A", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "flex-end" }}>
          <Link href="/employer/jobs" className={`${styles.btn} ${styles.btnGlass}`}>
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className={`${styles.btn} ${styles.btnAccent}`}>
            {submitting ? "Posting…" : "Post Job"}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
