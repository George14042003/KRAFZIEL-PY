"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CalendarPickerField } from "@/components/scheduling/CalendarPicker";
import {
  cardStyle,
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import {
  createInterview,
  createOffer,
  deleteCandidate,
  deleteInterview,
  getCandidate,
  listInterviewsForCandidate,
  listOffersForCandidate,
  updateCandidate,
  updateInterview,
  updateOffer,
  type Candidate,
  type CandidateStatus,
  type Interview,
  type InterviewStatus,
  type InterviewType,
  type Offer,
  type OfferStatus,
} from "@/lib/candidates";

const CANDIDATE_STATUSES: CandidateStatus[] = [
  "pending",
  "reviewed",
  "interviewing",
  "offered",
  "hired",
  "rejected",
];
const INTERVIEW_TYPES: InterviewType[] = ["phone", "video", "onsite", "technical", "final", "bot"];
const INTERVIEW_STATUSES: InterviewStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
  "rescheduled",
  "no_show",
];
const OFFER_STATUSES: OfferStatus[] = ["pending", "accepted", "declined", "withdrawn"];

const INTERVIEW_TYPE_COLORS: Record<InterviewType, string> = {
  phone: "#0d9488",
  video: "#4338ca",
  onsite: "#ea580c",
  technical: "#7c3aed",
  final: "#dc2626",
  bot: "#0f172a",
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CandidateDetailClient({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const { user, loading } = useSession("employer");

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "interviews" | "offers">("overview");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getCandidate(candidateId),
      listInterviewsForCandidate(candidateId),
      listOffersForCandidate(candidateId),
    ])
      .then(([candidateData, interviewsData, offersData]) => {
        setCandidate(candidateData);
        setInterviews(interviewsData);
        setOffers(offersData);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load this candidate."))
      .finally(() => setDataLoading(false));
  }, [user, candidateId]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  async function handleStatusChange(status: CandidateStatus) {
    if (!candidate) return;
    const updated = await updateCandidate(candidate.id, { status });
    setCandidate(updated);
  }

  async function handleDelete() {
    if (!candidate) return;
    if (!confirm(`Remove ${candidate.applicant_name} from your pipeline? This also removes their interviews and offers.`)) return;
    await deleteCandidate(candidate.id);
    router.push("/employer");
  }

  return (
    <DashboardShell user={user}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <Link href="/employer" style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}>
          &larr; Back to dashboard
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

        {candidate && (
          <div style={{ display: "flex", gap: "4px", marginTop: "20px", borderBottom: "1px solid #e2e8f0" }}>
            {(
              [
                { key: "overview", label: "Overview" },
                { key: "interviews", label: `Interviews (${interviews.length})` },
                { key: "offers", label: `Offers (${offers.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "10px 6px",
                  marginRight: "22px",
                  border: "none",
                  borderBottom: activeTab === tab.key ? "2px solid #01617a" : "2px solid transparent",
                  background: "transparent",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  color: activeTab === tab.key ? "#01617a" : "#94a3b8",
                  transition: "color 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {candidate && activeTab === "overview" && !editing && (
          <div className="fade-in" style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                background: "linear-gradient(135deg, #0891b2, #01617a)",
                borderRadius: "18px",
                padding: "26px 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
                boxShadow: "0 10px 30px rgba(1,97,122,0.22)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.16)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {initialsFor(candidate.applicant_name)}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <h1 style={{ fontSize: "21px", fontWeight: 800, color: "#fff", margin: 0 }}>
                      {candidate.applicant_name}
                    </h1>
                    <StatusBadge status={candidate.status} />
                  </div>
                  {candidate.created_by_name && (
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", margin: "4px 0 0" }}>
                      Added by {candidate.created_by_name}
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                {candidate.created_by_email === user.email && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    style={{
                      padding: "9px 16px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.4)",
                      background: "rgba(220,38,38,0.25)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h2 style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8", margin: "0 0 12px" }}>
                  Contact
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>Email</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", marginTop: "2px" }}>{candidate.applicant_email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>Phone</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", marginTop: "2px" }}>{candidate.phone || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>Source</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", marginTop: "2px" }}>{candidate.source || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>Resume</div>
                    <div style={{ fontSize: "13px", marginTop: "2px" }}>
                      {candidate.resume_url ? (
                        <a href={candidate.resume_url} target="_blank" rel="noreferrer" style={{ color: "#01617a", fontWeight: 700, textDecoration: "none" }}>
                          View Resume →
                        </a>
                      ) : (
                        <span style={{ color: "#0f172a" }}>—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {candidate.notes && (
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                  <h2 style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8", margin: "0 0 8px" }}>
                    Notes
                  </h2>
                  <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                    {candidate.notes}
                  </p>
                </div>
              )}

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <label style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
                  Pipeline Status
                </label>
                <select
                  value={candidate.status}
                  onChange={(e) => handleStatusChange(e.target.value as CandidateStatus)}
                  style={{ ...inputStyle, width: "auto" }}
                >
                  {CANDIDATE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {candidate && activeTab === "overview" && editing && (
          <EditCandidateForm
            candidate={candidate}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setCandidate(updated);
              setEditing(false);
            }}
          />
        )}

        {candidate && activeTab === "interviews" && (
          <div className="fade-in" style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                Interviews ({interviews.length})
              </h2>
              <div style={{ display: "flex", gap: "8px" }}>
                {!showInterviewForm && (
                  <button type="button" style={primaryButtonStyle} onClick={() => setShowInterviewForm(true)}>
                    + Schedule Interview
                  </button>
                )}
              </div>
            </div>

            {showInterviewForm && (
              <InterviewForm
                candidateId={candidate.id}
                onCreated={(interview) => {
                  setInterviews((prev) => [...prev, interview].sort(
                    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
                  ));
                  setShowInterviewForm(false);
                }}
                onCancel={() => setShowInterviewForm(false)}
              />
            )}

            {interviews.length === 0 && !showInterviewForm ? (
              <div style={{ ...cardStyle, textAlign: "center", padding: "40px 24px", color: "#94a3b8", fontSize: "13px" }}>
                No interviews scheduled yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: showInterviewForm ? "16px" : 0 }}>
                {interviews.map((interview) => (
                  <InterviewRow
                    key={interview.id}
                    interview={interview}
                    onUpdated={(updated) =>
                      setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
                    }
                    onDeleted={async () => {
                      if (!confirm("Cancel and remove this interview?")) return;
                      await deleteInterview(interview.id);
                      setInterviews((prev) => prev.filter((i) => i.id !== interview.id));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {candidate && activeTab === "offers" && (
          <div className="fade-in" style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                Offers ({offers.length})
              </h2>
              {!showOfferForm && (
                <button type="button" style={primaryButtonStyle} onClick={() => setShowOfferForm(true)}>
                  + Extend Offer
                </button>
              )}
            </div>

            {showOfferForm && (
              <OfferForm
                candidateId={candidate.id}
                onCreated={(offer) => {
                  setOffers((prev) => [offer, ...prev]);
                  setShowOfferForm(false);
                }}
                onCancel={() => setShowOfferForm(false)}
              />
            )}

            {offers.length === 0 && !showOfferForm ? (
              <div style={{ ...cardStyle, textAlign: "center", padding: "40px 24px", color: "#94a3b8", fontSize: "13px" }}>
                No offers extended yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: showOfferForm ? "16px" : 0 }}>
                {offers.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    onUpdated={(updated) =>
                      setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
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

function EditCandidateForm({
  candidate,
  onCancel,
  onSaved,
}: {
  candidate: Candidate;
  onCancel: () => void;
  onSaved: (candidate: Candidate) => void;
}) {
  const [name, setName] = useState(candidate.applicant_name);
  const [email, setEmail] = useState(candidate.applicant_email);
  const [phone, setPhone] = useState(candidate.phone ?? "");
  const [source, setSource] = useState(candidate.source ?? "");
  const [resumeUrl, setResumeUrl] = useState(candidate.resume_url ?? "");
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await updateCandidate(candidate.id, {
        applicant_name: name,
        applicant_email: email,
        phone: phone || undefined,
        source: source || undefined,
        resume_url: resumeUrl || undefined,
        notes: notes || undefined,
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
      className="fade-in"
      style={{ ...cardStyle, marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>Full Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Source</label>
          <input value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Resume URL</label>
        <input value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
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

function InterviewForm({
  candidateId,
  onCreated,
  onCancel,
}: {
  candidateId: string;
  onCreated: (interview: Interview) => void;
  onCancel: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("30");
  const [type, setType] = useState<InterviewType>("phone");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerEmail, setInterviewerEmail] = useState("");
  const [locationOrLink, setLocationOrLink] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const interview = await createInterview(candidateId, {
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: Number(duration),
        interview_type: type,
        interviewer_name: interviewerName,
        interviewer_email: interviewerEmail || undefined,
        location_or_link: locationOrLink || undefined,
        notes: notes || undefined,
      });
      onCreated(interview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule the interview.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Date &amp; Time</label>
          <CalendarPickerField value={scheduledAt} onChange={setScheduledAt} inputStyle={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Duration (min)</label>
          <input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as InterviewType)} style={inputStyle}>
            {INTERVIEW_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Interviewer Name</label>
          <input
            required
            value={interviewerName}
            onChange={(e) => setInterviewerName(e.target.value)}
            placeholder="Dana Lee"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Interviewer Email (optional)</label>
          <input
            type="email"
            value={interviewerEmail}
            onChange={(e) => setInterviewerEmail(e.target.value)}
            placeholder="dana@nextenti.com"
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Location or Video Link (optional)</label>
        <input
          value={locationOrLink}
          onChange={(e) => setLocationOrLink(e.target.value)}
          placeholder="https://meet…"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
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
          {submitting ? "Scheduling…" : "Schedule Interview"}
        </button>
      </div>
    </form>
  );
}

function InterviewRow({
  interview,
  onUpdated,
  onDeleted,
}: {
  interview: Interview;
  onUpdated: (interview: Interview) => void;
  onDeleted: () => void;
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const isBotTranscript = interview.interview_type === "bot" && !!interview.notes;

  async function handleStatusChange(status: InterviewStatus) {
    const updated = await updateInterview(interview.id, { status });
    onUpdated(updated);
  }

  async function copyLink(path: string) {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard API unavailable; nothing to fall back to safely
    }
  }

  const typeColor = INTERVIEW_TYPE_COLORS[interview.interview_type];

  return (
    <div
      style={{
        ...cardStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
        borderLeft: `4px solid ${typeColor}`,
        borderTopLeftRadius: "6px",
        borderBottomLeftRadius: "6px",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>{formatWhen(interview.scheduled_at)}</span>
          <StatusBadge status={interview.status} />
          <StatusBadge status={interview.availability_status} />
        </div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
          <span style={{ color: typeColor, fontWeight: 700 }}>
            {interview.interview_type[0].toUpperCase() + interview.interview_type.slice(1)}
          </span>{" "}
          · {interview.duration_minutes} min · with {interview.interviewer_name}
        </div>
        {interview.identity_snapshot_url && (
          <a
            href={interview.identity_snapshot_url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "12px", color: "#01617a", fontWeight: 700, display: "inline-block", marginTop: "4px" }}
          >
            View identity snapshot →
          </a>
        )}
        {interview.location_or_link && (
          <a href={interview.location_or_link} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#01617a" }}>
            {interview.location_or_link}
          </a>
        )}
        {interview.notes && !isBotTranscript && (
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", whiteSpace: "pre-wrap" }}>
            {interview.notes}
          </div>
        )}
        {isBotTranscript && (
          <div style={{ marginTop: "4px" }}>
            <button
              type="button"
              onClick={() => setTranscriptOpen((v) => !v)}
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#01617a",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              {transcriptOpen ? "Hide transcript ▲" : "View transcript ▾"}
            </button>
            {transcriptOpen && (
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", whiteSpace: "pre-wrap" }}>
                {interview.notes}
              </div>
            )}
          </div>
        )}
        {interview.interview_type === "bot" && interview.ai_evaluation && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              maxWidth: "480px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#0369a1", marginBottom: "6px" }}>
              AI Evaluation
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "6px" }}>
              {(
                [
                  ["Communication", interview.ai_evaluation.communication],
                  ["Problem Solving", interview.ai_evaluation.problem_solving],
                  ["Culture Fit", interview.ai_evaluation.culture_fit],
                  ["Relevance", interview.ai_evaluation.keyword_relevance],
                  ["Confidence", interview.ai_evaluation.confidence],
                  ["Overall", interview.ai_evaluation.overall],
                ] as const
              )
                .filter(([, score]) => typeof score === "number")
                .map(([label, score]) => (
                  <div key={label} style={{ fontSize: "11px", color: "#0c4a6e" }}>
                    <span style={{ fontWeight: 700 }}>{score}/10</span> {label}
                  </div>
                ))}
            </div>
            <p style={{ fontSize: "12px", color: "#0c4a6e", margin: 0 }}>{interview.ai_evaluation.summary}</p>
          </div>
        )}
        {interview.recording_urls && interview.recording_urls.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setRecordingsOpen((v) => !v)}
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#01617a",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              {recordingsOpen ? "Hide recording ▲" : `View recording${interview.recording_urls.length > 1 ? "s" : ""} ▾`}
            </button>
            {recordingsOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", maxWidth: "420px" }}>
                {interview.recording_urls.map((url, i) => (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video key={url} src={url} controls style={{ width: "100%", borderRadius: "10px", background: "#000" }} aria-label={`Interview recording ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {interview.interview_type === "video" && (
          <>
            <Link
              href={`/call/${interview.id}`}
              target="_blank"
              style={{ ...secondaryButtonStyle, padding: "6px 10px", fontSize: "12px", textDecoration: "none" }}
            >
              Join Call
            </Link>
            <button
              type="button"
              onClick={() => copyLink(`/call/${interview.id}`)}
              style={{ ...secondaryButtonStyle, padding: "6px 10px", fontSize: "12px" }}
            >
              {linkCopied ? "Copied!" : "Copy Invite Link"}
            </button>
          </>
        )}
        {interview.interview_type === "bot" && interview.status === "scheduled" && (
          <button
            type="button"
            onClick={() => copyLink(`/bot-interview/${interview.id}`)}
            style={{ ...secondaryButtonStyle, padding: "6px 10px", fontSize: "12px" }}
          >
            {linkCopied ? "Copied!" : "Copy Interview Link"}
          </button>
        )}
        <select
          value={interview.status}
          onChange={(e) => handleStatusChange(e.target.value as InterviewStatus)}
          style={{
            fontSize: "12px",
            fontWeight: 700,
            padding: "7px 10px",
            borderRadius: "9px",
            border: "1px solid #e2e8f0",
            color: "#334155",
            background: "#fff",
          }}
        >
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDeleted}
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#dc2626",
            background: "transparent",
            border: "none",
            padding: "6px 4px",
            cursor: "pointer",
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function OfferForm({
  candidateId,
  onCreated,
  onCancel,
}: {
  candidateId: string;
  onCreated: (offer: Offer) => void;
  onCancel: () => void;
}) {
  const [salary, setSalary] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const offer = await createOffer(candidateId, {
        salary: Number(salary),
        currency,
        start_date: startDate || null,
        expires_at: expiresAt || null,
        notes: notes || null,
      });
      onCreated(offer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the offer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Salary</label>
          <input required type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="115000" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Expires</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
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
          {submitting ? "Sending…" : "Send Offer"}
        </button>
      </div>
    </form>
  );
}

function OfferRow({ offer, onUpdated }: { offer: Offer; onUpdated: (offer: Offer) => void }) {
  async function handleStatusChange(status: OfferStatus) {
    const updated = await updateOffer(offer.id, { status });
    onUpdated(updated);
  }

  return (
    <div
      style={{
        ...cardStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
        borderLeft: "4px solid #15803d",
        borderTopLeftRadius: "6px",
        borderBottomLeftRadius: "6px",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
            {offer.currency} {offer.salary.toLocaleString()}
          </span>
          <StatusBadge status={offer.status} />
        </div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
          {offer.start_date && <span>Starts {offer.start_date}</span>}
          {offer.start_date && offer.expires_at && <span> · </span>}
          {offer.expires_at && <span>Expires {offer.expires_at}</span>}
          {!offer.start_date && !offer.expires_at && <span>No dates set</span>}
        </div>
        {offer.notes && (
          <div style={{ color: "#334155", fontSize: "12px", marginTop: "6px", whiteSpace: "pre-wrap" }}>{offer.notes}</div>
        )}
      </div>
      <select
        value={offer.status}
        onChange={(e) => handleStatusChange(e.target.value as OfferStatus)}
        style={{
          fontSize: "12px",
          fontWeight: 700,
          padding: "7px 10px",
          borderRadius: "9px",
          border: "1px solid #e2e8f0",
          color: "#334155",
          background: "#fff",
        }}
      >
        {OFFER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s[0].toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
