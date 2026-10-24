"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  cardStyle,
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import { createJob, type EmploymentType, type JobStatus } from "@/lib/jobs";

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
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
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
      <div style={{ maxWidth: "620px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <Link href="/employer/jobs" style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}>
            &larr; Back to jobs
          </Link>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", margin: "8px 0 0" }}>Post a Job</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "6px 0 0" }}>
            Publish a requisition candidates can browse and apply to from their dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Job Title</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Product Designer" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Department (optional)</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Design" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Location (optional)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote, Bengaluru…" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Employment Type</label>
              <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} style={inputStyle}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={jobStatus} onChange={(e) => setJobStatus(e.target.value as JobStatus)} style={inputStyle}>
                {JOB_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Salary Min (optional)</label>
              <input type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="90000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Salary Max (optional)</label>
              <input type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="130000" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Responsibilities, requirements, what makes this role great…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <Link href="/employer/jobs" style={{ ...secondaryButtonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Cancel
            </Link>
            <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Posting…" : "Post Job"}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
