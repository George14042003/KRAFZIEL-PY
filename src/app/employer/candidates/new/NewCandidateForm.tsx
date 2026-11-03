"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuroraLoading } from "@/app/employer/jobs/JobStatusChip";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useSession } from "@/hooks/useSession";
import { createCandidate } from "@/lib/candidates";

const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 } as const;

export function NewCandidateForm() {
  const router = useRouter();
  const { user, loading } = useSession("employer");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [notes, setNotes] = useState("");
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
      const candidate = await createCandidate({
        applicant_name: name,
        applicant_email: email,
        phone: phone || undefined,
        source: source || undefined,
        resume_url: resumeUrl || undefined,
        notes: notes || undefined,
      });
      router.push(`/employer/candidates/${candidate.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this candidate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell user={user}>
      <AuroraPageHeader
        eyebrow="Talent"
        title="Add Candidate"
        subtitle="Sourced from your ATS, a referral, or LinkedIn? Log them here to start scheduling interviews."
        actions={
          <Link href="/employer" className={`${styles.btn} ${styles.btnGlass}`}>
            &larr; Back to dashboard
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit}
        className={`${styles.glass} ${styles.card}`}
        style={{ maxWidth: 720, width: "100%", padding: 32, display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div style={grid2}>
          <div className={styles.field}>
            <label className={styles.lbl}>Full Name</label>
            <input className={styles.inp} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
          </div>
          <div className={styles.field}>
            <label className={styles.lbl}>Email</label>
            <input className={styles.inp} required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" />
          </div>
        </div>

        <div style={grid2}>
          <div className={styles.field}>
            <label className={styles.lbl}>Phone (optional)</label>
            <input className={styles.inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
          </div>
          <div className={styles.field}>
            <label className={styles.lbl}>Source</label>
            <input className={styles.inp} value={source} onChange={(e) => setSource(e.target.value)} placeholder="External ATS, referral, LinkedIn…" />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.lbl}>Resume URL (optional)</label>
          <input className={styles.inp} value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} placeholder="https://…" />
        </div>

        <div className={styles.field}>
          <label className={styles.lbl}>Notes (optional)</label>
          <textarea
            className={styles.inp}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Background, referral source, first impressions…"
            style={{ resize: "vertical", padding: "14px 16px", lineHeight: 1.5 }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "#C4123A", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "flex-end" }}>
          <Link href="/employer" className={`${styles.btn} ${styles.btnGlass}`}>
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className={`${styles.btn} ${styles.btnAccent}`}>
            {submitting ? "Adding…" : "Add Candidate"}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
