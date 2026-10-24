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
import { createCandidate } from "@/lib/candidates";

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
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <Link href="/employer" style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}>
            &larr; Back to dashboard
          </Link>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", margin: "8px 0 0" }}>Add Candidate</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "6px 0 0" }}>
            Sourced from your ATS, a referral, or LinkedIn? Log them here to start scheduling interviews.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya@example.com"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Source</label>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="External ATS, referral, LinkedIn…"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Resume URL (optional)</label>
            <input value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Background, referral source, first impressions…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <Link href="/employer" style={{ ...secondaryButtonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Cancel
            </Link>
            <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Adding…" : "Add Candidate"}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
