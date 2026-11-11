"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CalendarPickerField } from "@/components/scheduling/CalendarPicker";
import styles from "@/components/aurora/aurora.module.css";
import d from "./candidateDetail.module.css";
import { useSession } from "@/hooks/useSession";
import { useOpenEdition } from "@/lib/edition";
import { ApplicationResumePanel, PortfolioBadge } from "@/components/applications/ApplicationResume";
import { listAllApplications, type JobApplication } from "@/lib/jobs";
import {
  createInterview,
  createOffer,
  deleteCandidate,
  deleteInterview,
  getCandidate,
  listInterviewsForCandidate,
  listOffersForCandidate,
  RECOMMENDATION_LABELS,
  recommendationOf,
  updateCandidate,
  updateInterview,
  inviteCandidateToSignUp,
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
  phone: "#00B4FF",
  video: "#0066FF",
  onsite: "#5B6472",
  technical: "#0F172A",
  final: "#00E5FF",
  bot: "#3B4147",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#0080B8",
  reviewed: "#0052CC",
  interviewing: "#0F172A",
  offered: "#3B4147",
  hired: "#007C8A",
  rejected: "#D7173E",
  scheduled: "#0052CC",
  completed: "#0B7A4B",
  cancelled: "#6B7280",
  rescheduled: "#0080B8",
  no_show: "#D7173E",
  accepted: "#007C8A",
  declined: "#D7173E",
  withdrawn: "#6B7280",
};

// Mirrors the Aurora .inp look for components that take an inline style (the calendar picker).
const darkInputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: "48px",
  padding: "0 16px",
  borderRadius: "16px",
  border: "1px solid var(--line-strong)",
  background: "var(--input-bg)",
  color: "var(--text)",
  font: "inherit",
  fontSize: "14px",
};

function Chip({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#6B7280";
  const label = status
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  return (
    <span className={styles.chip} style={{ color, background: `${color}29` }}>
      <span className={styles.dot} style={{ background: color }} />
      {label}
    </span>
  );
}

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
  const openEdition = useOpenEdition();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "applications" | "interviews" | "offers">("overview");
  // Open source edition: video interviews only.
  const shownInterviews = openEdition ? interviews.filter((i) => i.interview_type === "video") : interviews;

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
    // Applications (with the resume each one carried) come from the organisation-wide list; a failure here
    // should not hide the rest of the candidate.
    listAllApplications()
      .then((all) => setApplications(all.filter((a) => a.candidate.id === candidateId)))
      .catch(() => {});
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

  const statusColor = candidate ? STATUS_COLORS[candidate.status] ?? "#6B7280" : "#6B7280";

  return (
    <DashboardShell user={user}>
      <Link href="/employer" className={d.back}>
        &larr; Back to dashboard
      </Link>

      {dataLoading && <div style={{ color: "var(--text-3)", fontSize: "14px", padding: "0 8px" }}>Loading…</div>}

      {loadError && (
        <div className={`${styles.glass} ${styles.cardSm}`}>
          <p className={d.err} role="alert">
            {loadError}
          </p>
        </div>
      )}

      {candidate && (
        <div className={`${styles.glass} ${d.tabs}`} role="tablist">
          {(
            [
              { key: "overview", label: "Overview" },
              { key: "applications", label: `Applications (${applications.length})` },
              { key: "interviews", label: `Interviews (${shownInterviews.length})` },
              { key: "offers", label: `Offers (${offers.length})` },
            ] as const
          )
            .filter((tab) => !(openEdition && tab.key === "offers"))
            .map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`${d.tab} ${activeTab === tab.key ? d.tabOn : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {candidate && activeTab === "overview" && !editing && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className={`${styles.glass} ${styles.card} ${d.profile}`}>
            <div className={d.id}>
              <div className={d.avatar} style={{ background: `${statusColor}22`, color: statusColor }}>
                {initialsFor(candidate.applicant_name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className={d.row}>
                  <h1 className={d.name}>{candidate.applicant_name}</h1>
                  <Chip status={candidate.status} />
                </div>
                {candidate.created_by_name && <p className={d.sub}>Added by {candidate.created_by_name}</p>}
              </div>
            </div>
            <div className={d.row}>
              <button type="button" className={`${styles.btn} ${styles.btnGlass}`} onClick={() => setEditing(true)}>
                Edit
              </button>
              {candidate.created_by_email === user.email && (
                <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete}>
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className={`${styles.glass} ${styles.card}`} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h2 className={d.sectionTitle}>Contact</h2>
              <div className={d.facts}>
                <div>
                  <div className={d.factLabel}>Email</div>
                  <div className={d.factValue}>{candidate.applicant_email}</div>
                  <AccountStatus candidateId={candidate.id} hasAccount={candidate.has_account} />
                </div>
                <div>
                  <div className={d.factLabel}>Phone</div>
                  <div className={d.factValue}>{candidate.phone || "—"}</div>
                </div>
                <div>
                  <div className={d.factLabel}>Source</div>
                  <div className={d.factValue}>{candidate.source || "—"}</div>
                </div>
                <div>
                  <div className={d.factLabel}>Resume</div>
                  <div className={d.factValue}>
                    {candidate.resume_url ? (
                      <a href={candidate.resume_url} target="_blank" rel="noreferrer" className={d.link}>
                        View Resume →
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {candidate.notes && (
              <div className={d.divider}>
                <h2 className={d.sectionTitle}>Notes</h2>
                <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                  {candidate.notes}
                </p>
              </div>
            )}

            <div className={`${d.divider} ${d.row}`} style={{ gap: "14px" }}>
              <label htmlFor="pipeline-status" className={d.sectionTitle} style={{ margin: 0 }}>
                Pipeline Status
              </label>
              <select
                id="pipeline-status"
                value={candidate.status}
                onChange={(e) => handleStatusChange(e.target.value as CandidateStatus)}
                className={styles.inp}
                style={{ width: "auto", minWidth: "170px" }}
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

      {candidate && activeTab === "applications" && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className={d.listHead}>
            <h2 className={d.heading}>Applications ({applications.length})</h2>
          </div>
          {applications.length === 0 ? (
            <p style={{ fontSize: "14px", color: "var(--text-4)", margin: 0 }}>This candidate has not applied to any of your jobs yet.</p>
          ) : (
            applications.map((application) => (
              <div key={application.id} className={`${styles.glass} ${styles.card}`} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
                    <Link href={`/employer/jobs/${application.job_id}`} className={d.link} style={{ fontSize: "16px", fontWeight: 600 }}>
                      {application.job_title}
                    </Link>
                    <Chip status={application.status} />
                    <PortfolioBadge application={application} />
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-4)" }}>Applied {formatWhen(application.created_at)}</span>
                </div>
                {application.cover_letter && (
                  <p style={{ fontSize: "13px", color: "var(--text-2)", margin: 0, whiteSpace: "pre-wrap" }}>{application.cover_letter}</p>
                )}
                <ApplicationResumePanel application={application} />
              </div>
            ))
          )}
        </div>
      )}

      {candidate && activeTab === "interviews" && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className={d.listHead}>
            <h2 className={d.heading}>Interviews ({interviews.length})</h2>
            {!showInterviewForm && (
              <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => setShowInterviewForm(true)}>
                + Schedule Interview
              </button>
            )}
          </div>

          {showInterviewForm && (
            <InterviewForm
              candidateId={candidate.id}
              candidateEmail={candidate.applicant_email}
              hasAccount={candidate.has_account}
              onCreated={(interview) => {
                setInterviews((prev) => [...prev, interview].sort(
                  (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
                ));
                setShowInterviewForm(false);
              }}
              onCancel={() => setShowInterviewForm(false)}
            />
          )}

          {shownInterviews.length === 0 && !showInterviewForm ? (
            <div className={`${styles.glass} ${styles.card} ${d.empty}`}>No interviews scheduled yet.</div>
          ) : (
            <div className={d.stack}>
              {shownInterviews.map((interview) => (
                <InterviewRow
                  key={interview.id}
                  interview={interview}
                  onUpdated={(updated) =>
                    setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
                  }
                  onDeleted={async () => {
                    if (!confirm("Cancel and remove this interview?")) return;
                    try {
                      await deleteInterview(interview.id);
                      setInterviews((prev) => prev.filter((i) => i.id !== interview.id));
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "Could not remove the interview.");
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {candidate && !openEdition && activeTab === "offers" && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className={d.listHead}>
            <h2 className={d.heading}>Offers ({offers.length})</h2>
            {!showOfferForm && (
              <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => setShowOfferForm(true)}>
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
            <div className={`${styles.glass} ${styles.card} ${d.empty}`}>No offers extended yet.</div>
          ) : (
            <div className={d.stack}>
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
    <form onSubmit={handleSubmit} className={`fade-in ${styles.glass} ${styles.card} ${d.form}`}>
      <div className={d.grid2}>
        <div className={styles.field}>
          <label className={styles.lbl}>Full Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={styles.inp} />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.inp} />
        </div>
      </div>
      <div className={d.grid2}>
        <div className={styles.field}>
          <label className={styles.lbl}>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={styles.inp} />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Source</label>
          <input value={source} onChange={(e) => setSource(e.target.value)} className={styles.inp} />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.lbl}>Resume URL</label>
        <input value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} className={styles.inp} />
      </div>
      <div className={styles.field}>
        <label className={styles.lbl}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${styles.inp} ${d.textarea}`} />
      </div>

      {error && (
        <p className={d.err} role="alert">
          {error}
        </p>
      )}

      <div className={d.actions}>
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

function InterviewForm({
  candidateId,
  candidateEmail,
  hasAccount,
  onCreated,
  onCancel,
}: {
  candidateId: string;
  candidateEmail: string;
  hasAccount: boolean;
  onCreated: (interview: Interview) => void;
  onCancel: () => void;
}) {
  const openEdition = useOpenEdition();
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
        interview_type: openEdition ? "video" : type,
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
    <form onSubmit={handleSubmit} className={`${styles.glass} ${styles.card} ${d.form}`}>
      {!hasAccount && (
        <div className={d.warn}>
          <strong>No account yet.</strong> {candidateEmail} must sign up with this exact email before they
          can confirm or join. The confirmation email will include a sign-up link.
        </div>
      )}
      <div className={d.grid3}>
        <div className={styles.field}>
          <label className={styles.lbl}>Date &amp; Time</label>
          <CalendarPickerField value={scheduledAt} onChange={setScheduledAt} inputStyle={darkInputStyle} />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Duration (min)</label>
          <input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} className={styles.inp} />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Type</label>
          <select value={openEdition ? "video" : type} onChange={(e) => setType(e.target.value as InterviewType)} className={styles.inp}>
            {INTERVIEW_TYPES.filter((t) => !openEdition || t === "video").map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={d.grid2}>
        <div className={styles.field}>
          <label className={styles.lbl}>Interviewer Name</label>
          <input
            required
            value={interviewerName}
            onChange={(e) => setInterviewerName(e.target.value)}
            placeholder="Dana Lee"
            className={styles.inp}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Interviewer Email (optional)</label>
          <input
            type="email"
            value={interviewerEmail}
            onChange={(e) => setInterviewerEmail(e.target.value)}
            placeholder="dana@nextenti.com"
            className={styles.inp}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.lbl}>Location or Video Link (optional)</label>
        <input
          value={locationOrLink}
          onChange={(e) => setLocationOrLink(e.target.value)}
          placeholder="https://meet…"
          className={styles.inp}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.lbl}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={styles.inp} />
      </div>

      {error && (
        <p className={d.err} role="alert">
          {error}
        </p>
      )}

      <div className={d.actions}>
        <button type="button" className={`${styles.btn} ${styles.btnGlass}`} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} className={`${styles.btn} ${styles.btnAccent}`}>
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
  const openEdition = useOpenEdition();
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
    <div className={`${styles.glass} ${styles.card} ${d.item}`}>
      <div className={d.itemMain}>
        <div className={d.row}>
          <span className={d.itemTitle}>{formatWhen(interview.scheduled_at)}</span>
          <Chip status={interview.status} />
          <Chip status={interview.availability_status} />
          {!interview.candidate_has_account && <NoAccountBadge />}
        </div>
        <div className={d.meta} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: typeColor, flex: "none" }} />
          <span style={{ color: typeColor, fontWeight: 600 }}>
            {interview.interview_type[0].toUpperCase() + interview.interview_type.slice(1)}
          </span>
          <span>
            · {interview.duration_minutes} min · with {interview.interviewer_name}
          </span>
        </div>
        {(interview.interview_type === "video" || interview.interview_type === "bot") && interview.status === "scheduled" && (
          <div className={d.hint}>
            {interview.candidate_has_account
              ? "The candidate logs in with their account email to join."
              : "The candidate must create an account with their email before they can join."}
          </div>
        )}
        {interview.identity_snapshot_url && (
          <div style={{ marginTop: "8px" }}>
            <a href={interview.identity_snapshot_url} target="_blank" rel="noreferrer" className={d.link} style={{ fontSize: "13px" }}>
              View identity snapshot →
            </a>
          </div>
        )}
        {interview.face_scan_urls && interview.face_scan_urls.length > 0 && (
          <div style={{ marginTop: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-2)", marginBottom: "6px" }}>Four-corner face verification</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {interview.face_scan_urls.map((shot) => (
                <a key={shot.angle} href={shot.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", textAlign: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.url}
                    alt={`Face verification, ${shot.angle.replace("_", " ")}`}
                    style={{ width: "88px", height: "66px", objectFit: "cover", borderRadius: "8px", display: "block", transform: "scaleX(-1)" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "capitalize" }}>{shot.angle.replace("_", " ")}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {interview.location_or_link && (
          <div style={{ marginTop: "8px" }}>
            <a href={interview.location_or_link} target="_blank" rel="noreferrer" className={d.link} style={{ fontSize: "13px" }}>
              {interview.location_or_link}
            </a>
          </div>
        )}
        {interview.notes && !isBotTranscript && <div className={d.note}>{interview.notes}</div>}
        {isBotTranscript && (
          <div style={{ marginTop: "10px" }}>
            <button type="button" onClick={() => setTranscriptOpen((v) => !v)} className={d.linkBtn}>
              {transcriptOpen ? "Hide transcript ▲" : "View transcript ▾"}
            </button>
            {transcriptOpen && <div className={d.note}>{interview.notes}</div>}
          </div>
        )}
        {!openEdition && (interview.interview_type === "bot" || interview.interview_type === "video") && interview.ai_evaluation && (
          <div className={d.eval}>
            <div className={d.evalTitle}>AI Evaluation</div>
            {(() => {
              const verdict = recommendationOf(interview.ai_evaluation);
              const color = verdict === "no_hire" ? "#e11d48" : verdict === "maybe" ? "#d97706" : "#0a9b5a";
              return (
                <div style={{ marginBottom: "10px" }}>
                  <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, color, border: `1px solid ${color}` }}>
                    {RECOMMENDATION_LABELS[verdict]}
                  </span>
                  {interview.ai_evaluation.recommendation_reason && (
                    <p style={{ fontSize: "13px", color: "var(--text-2)", margin: "8px 0 0", lineHeight: 1.55 }}>{interview.ai_evaluation.recommendation_reason}</p>
                  )}
                </div>
              );
            })()}
            <div className={d.scores}>
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
                  <div key={label} className={d.score}>
                    <b>{score}/10</b> {label}
                  </div>
                ))}
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-2)", margin: 0, lineHeight: 1.55 }}>{interview.ai_evaluation.summary}</p>
            {interview.ai_evaluation.proctoring && (
              <p style={{ fontSize: "12px", color: "var(--text-3)", margin: "8px 0 0" }}>
                Attention: reminded to face the screen {interview.ai_evaluation.proctoring.look_away_warnings} time
                {interview.ai_evaluation.proctoring.look_away_warnings === 1 ? "" : "s"} during the interview
              </p>
            )}
          </div>
        )}
        {interview.recording_urls && interview.recording_urls.length > 0 && (
          <div style={{ marginTop: "10px" }}>
            <button type="button" onClick={() => setRecordingsOpen((v) => !v)} className={d.linkBtn}>
              {recordingsOpen ? "Hide recording ▲" : `View recording${interview.recording_urls.length > 1 ? "s" : ""} ▾`}
            </button>
            {recordingsOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", maxWidth: "420px" }}>
                {interview.recording_urls.map((url, i) => (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video key={url} src={url} controls className={d.video} aria-label={`Interview recording ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={d.itemActions}>
        {interview.interview_type === "video" && (
          <>
            <Link
              href={`/call/${interview.id}`}
              target="_blank"
              className={`${styles.btn} ${styles.btnGlass} ${styles.btnSm}`}
              style={{ textDecoration: "none" }}
            >
              Join Call
            </Link>
            <button
              type="button"
              onClick={() => copyLink(`/call/${interview.id}`)}
              className={`${styles.btn} ${styles.btnGlass} ${styles.btnSm}`}
            >
              {linkCopied ? "Copied — they must log in" : "Copy Invite Link"}
            </button>
          </>
        )}
        {interview.interview_type === "bot" && interview.status === "scheduled" && (
          <button
            type="button"
            onClick={() => copyLink(`/bot-interview/${interview.id}`)}
            className={`${styles.btn} ${styles.btnGlass} ${styles.btnSm}`}
          >
            {linkCopied ? "Copied — they must log in" : "Copy Interview Link"}
          </button>
        )}
        <select
          value={interview.status}
          onChange={(e) => handleStatusChange(e.target.value as InterviewStatus)}
          className={`${styles.chip} ${styles.chipSelect}`}
          aria-label="Interview status"
        >
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <button type="button" onClick={onDeleted} className={d.dangerLink}>
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
    <form onSubmit={handleSubmit} className={`${styles.glass} ${styles.card} ${d.form}`}>
      <div className={d.grid21}>
        <div className={styles.field}>
          <label className={styles.lbl}>Salary</label>
          <input required type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="115000" className={styles.inp} />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={styles.inp} />
        </div>
      </div>
      <div className={d.grid2}>
        <div className={styles.field}>
          <label className={styles.lbl}>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={styles.inp} style={{ colorScheme: "dark" }} />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>Expires</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={styles.inp} style={{ colorScheme: "dark" }} />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.lbl}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={styles.inp} />
      </div>

      {error && (
        <p className={d.err} role="alert">
          {error}
        </p>
      )}

      <div className={d.actions}>
        <button type="button" className={`${styles.btn} ${styles.btnGlass}`} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} className={`${styles.btn} ${styles.btnAccent}`}>
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
    <div className={`${styles.glass} ${styles.card} ${d.item}`} style={{ alignItems: "center" }}>
      <div className={d.itemMain}>
        <div className={d.row}>
          <span className={d.itemTitle} style={{ fontSize: "22px" }}>
            {offer.currency} {offer.salary.toLocaleString()}
          </span>
          <Chip status={offer.status} />
        </div>
        <div className={d.meta}>
          {offer.start_date && <span>Starts {offer.start_date}</span>}
          {offer.start_date && offer.expires_at && <span> · </span>}
          {offer.expires_at && <span>Expires {offer.expires_at}</span>}
          {!offer.start_date && !offer.expires_at && <span>No dates set</span>}
        </div>
        {offer.notes && <div className={d.note}>{offer.notes}</div>}
      </div>
      <select
        value={offer.status}
        onChange={(e) => handleStatusChange(e.target.value as OfferStatus)}
        className={`${styles.chip} ${styles.chipSelect}`}
        aria-label="Offer status"
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

function NoAccountBadge() {
  return (
    <span
      title="This candidate has no verified account yet, so they can't confirm or join until they sign up."
      className={styles.chip}
      style={{ color: "#0080B8", background: "#0080B829", fontSize: "11px", padding: "3px 10px" }}
    >
      No account yet
    </span>
  );
}

function AccountStatus({ candidateId, hasAccount }: { candidateId: string; hasAccount: boolean }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    setSending(true);
    setError(null);
    try {
      const result = await inviteCandidateToSignUp(candidateId);
      setMessage(result.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the invitation.");
    } finally {
      setSending(false);
    }
  }

  if (hasAccount) {
    return (
      <span
        className={styles.chip}
        style={{ marginTop: "8px", color: "#0B7A4B", background: "#0B7A4B29", fontSize: "11px", padding: "3px 10px" }}
      >
        Has account
      </span>
    );
  }

  return (
    <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
      <NoAccountBadge />
      {message ? (
        <span style={{ fontSize: "12px", color: "#0B7A4B", fontWeight: 600 }}>{message}</span>
      ) : (
        <button type="button" onClick={invite} disabled={sending} className={d.linkBtn}>
          {sending ? "Sending…" : "Invite to sign up"}
        </button>
      )}
      {error && <span style={{ fontSize: "12px", color: "#c4123a" }}>{error}</span>}
    </div>
  );
}
