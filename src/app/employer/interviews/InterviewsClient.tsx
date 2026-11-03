"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import aurora from "@/components/aurora/aurora.module.css";
import local from "./interviews.module.css";
import { CalendarPickerField } from "@/components/scheduling/CalendarPicker";
import { useSession } from "@/hooks/useSession";
import { useOpenEdition } from "@/lib/edition";
import {
  createInterview,
  deleteInterview,
  listAllInterviews,
  listCandidates,
  updateInterview,
  type Candidate,
  type Interview,
  type InterviewStatus,
  type InterviewType,
} from "@/lib/candidates";

const STATUS_FILTERS: { value: InterviewStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "no_show", label: "No Show" },
];

const TYPE_FILTERS: { value: InterviewType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "phone", label: "Phone" },
  { value: "video", label: "Video" },
  { value: "onsite", label: "Onsite" },
  { value: "technical", label: "Technical" },
  { value: "final", label: "Final" },
  { value: "bot", label: "Bot" },
];

const TYPE_COLORS: Record<InterviewType, string> = {
  phone: "#00B4FF",
  video: "#0066FF",
  onsite: "#5B6472",
  technical: "#0F172A",
  final: "#00E5FF",
  bot: "#3B4147",
};

const COLS = "1.4fr 1.8fr 1fr 1.3fr .8fr 1.3fr .8fr";

const AVAILABILITY_COLORS: Record<string, string> = {
  accepted: "#007C8A",
  pending: "#0080B8",
  declined: "#D7173E",
};

function AvailabilityChip({ status }: { status: string }) {
  const c = AVAILABILITY_COLORS[status] ?? "#6B7280";
  const label = status
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return (
    <span className={aurora.chip} style={{ color: c, background: `${c}29` }}>
      <span className={aurora.dot} style={{ background: c }} />
      {label}
    </span>
  );
}

const pickerStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: "48px",
  padding: "0 16px",
  borderRadius: "16px",
  border: "1px solid var(--line-strong)",
  fontSize: "14px",
  fontFamily: "inherit",
};

function typeLabel(type: InterviewType): string {
  return TYPE_FILTERS.find((t) => t.value === type)?.label ?? type;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InterviewsClient() {
  const { user, loading } = useSession("employer");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<InterviewType | "all">("all");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCandidates(), listAllInterviews()])
      .then(([candidatesData, interviewsData]) => {
        setCandidates(candidatesData);
        setInterviews(interviewsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load interviews."))
      .finally(() => setDataLoading(false));
  }, [user]);

  const candidateMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  const statusCounts = useMemo(() => {
    const counts = new Map<InterviewStatus, number>();
    for (const i of interviews) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
    return counts;
  }, [interviews]);

  const openEdition = useOpenEdition();
  const filteredInterviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    return interviews
      .filter((i) => {
        if (openEdition && i.interview_type !== "video") return false; // open source edition: video only
        if (statusFilter !== "all" && i.status !== statusFilter) return false;
        if (typeFilter !== "all" && i.interview_type !== typeFilter) return false;
        if (!q) return true;
        const candidate = candidateMap.get(i.candidate_id);
        return (
          candidate?.applicant_name.toLowerCase().includes(q) ||
          i.interviewer_name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }, [interviews, search, statusFilter, typeFilter, candidateMap]);

  if (loading || !user) {
    return <div className={local.fullLoading}>Loading…</div>;
  }

  async function handleStatusChange(interview: Interview, status: InterviewStatus) {
    const updated = await updateInterview(interview.id, { status });
    setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function handleDelete(interview: Interview) {
    if (!confirm("Cancel and remove this interview?")) return;
    await deleteInterview(interview.id);
    setInterviews((prev) => prev.filter((i) => i.id !== interview.id));
  }

  return (
    <DashboardShell user={user}>
      <AuroraPageHeader
        eyebrow="Schedule"
        title="Interviews"
        subtitle={`${interviews.length} interviews · across your whole team`}
        actions={
          !showForm ? (
            <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} onClick={() => setShowForm(true)}>
              + Schedule Interview
            </button>
          ) : undefined
        }
      />

      {error && (
        <p className={local.error} role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <ScheduleInterviewForm
          candidates={candidates}
          onCreated={(interview) => {
            setInterviews((prev) => [interview, ...prev]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {dataLoading ? (
        <div className={local.loading}>Loading interviews…</div>
      ) : interviews.length === 0 ? (
        <div className={`${aurora.glass} ${local.emptyCard}`}>
          <span className={local.emptyTitle}>No interviews yet</span>
          <p className={local.emptyText}>
            Schedule an interview for any candidate in your pool to see it show up here.
          </p>
        </div>
      ) : (
        <div className={aurora.sidebarLayout}>
          <aside className={`${aurora.glass} ${aurora.sideCard}`}>
            <span className={aurora.sideLabel}>Status</span>
            {STATUS_FILTERS.map((s) => {
              const count = s.value === "all" ? interviews.length : statusCounts.get(s.value) ?? 0;
              const isActive = statusFilter === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatusFilter(s.value)}
                  className={`${aurora.fi} ${isActive ? aurora.fiOn : ""}`}
                >
                  {s.label}
                  <span className={aurora.n}>{count}</span>
                </button>
              );
            })}
          </aside>

          <div className={local.col}>
            <div className={`${aurora.glass} ${local.filterCard}`}>
              <div className={aurora.field} style={{ flex: "1 1 300px" }}>
                <label className={aurora.lbl} htmlFor="interview-search">
                  Search
                </label>
                <input
                  id="interview-search"
                  className={aurora.inp}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Candidate, interviewer…"
                />
              </div>
              <div className={aurora.field} style={{ flex: "0 0 180px" }}>
                <label className={aurora.lbl} htmlFor="interview-type">
                  Type
                </label>
                <select
                  id="interview-type"
                  className={aurora.inp}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as InterviewType | "all")}
                >
                  {TYPE_FILTERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className={local.shown}>{filteredInterviews.length} shown</span>
            </div>

            <div className={`${aurora.glass} ${aurora.tableCard}`}>
              <div className={aurora.tableScroll}>
                <div className={aurora.th} style={{ gridTemplateColumns: COLS }}>
                  <span>Candidate</span>
                  <span>Date &amp; Time</span>
                  <span>Type</span>
                  <span>Interviewer</span>
                  <span>Duration</span>
                  <span>Status</span>
                  <span></span>
                </div>

                {filteredInterviews.length === 0 ? (
                  <p className={local.empty}>No interviews match these filters.</p>
                ) : (
                  filteredInterviews.map((interview) => {
                    const candidate = candidateMap.get(interview.candidate_id);
                    const color = TYPE_COLORS[interview.interview_type];
                    return (
                      <div key={interview.id} className={aurora.tr} style={{ gridTemplateColumns: COLS }}>
                        <Link href={`/employer/candidates/${interview.candidate_id}`} className={local.cand}>
                          {candidate?.applicant_name ?? "Unknown candidate"}
                        </Link>
                        <span className={local.when}>
                          <span className={local.whenText}>{formatWhen(interview.scheduled_at)}</span>
                          <AvailabilityChip status={interview.availability_status} />
                          {!interview.candidate_has_account && (
                            <span
                              className={local.noAcct}
                              title="No verified account yet — they must sign up before they can confirm or join."
                            >
                              No account yet
                            </span>
                          )}
                        </span>
                        <span className={local.cell}>
                          <span className={local.typeDot} style={{ background: color }} />
                          {typeLabel(interview.interview_type)}
                        </span>
                        <span className={`${local.cell} ${local.ellipsis}`}>{interview.interviewer_name}</span>
                        <span className={local.cell}>{interview.duration_minutes}m</span>
                        <span className={local.selectWrap}>
                          <select
                            className={`${aurora.chip} ${aurora.chipSelect}`}
                            value={interview.status}
                            onChange={(e) => handleStatusChange(interview, e.target.value as InterviewStatus)}
                            aria-label="Interview status"
                          >
                            {STATUS_FILTERS.filter((s) => s.value !== "all").map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <svg
                            className={local.chev}
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            aria-hidden="true"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                        <button type="button" className={local.remove} onClick={() => handleDelete(interview)}>
                          Remove
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function ScheduleInterviewForm({
  candidates,
  onCreated,
  onCancel,
}: {
  candidates: Candidate[];
  onCreated: (interview: Interview) => void;
  onCancel: () => void;
}) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("30");
  const openEdition = useOpenEdition();
  const [type, setType] = useState<InterviewType>("phone");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerEmail, setInterviewerEmail] = useState("");
  const [locationOrLink, setLocationOrLink] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!candidateId) {
      setError("Choose a candidate first.");
      return;
    }
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
    <form onSubmit={handleSubmit} className={`${aurora.glass} ${local.formCard}`}>
      <div className={local.grid4}>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Candidate</label>
          <select className={aurora.inp} value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            {candidates.length === 0 && <option value="">No candidates yet</option>}
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.applicant_name}
              </option>
            ))}
          </select>
        </div>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Date &amp; Time</label>
          <CalendarPickerField value={scheduledAt} onChange={setScheduledAt} inputStyle={pickerStyle} />
        </div>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Duration (min)</label>
          <input
            className={aurora.inp}
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Type</label>
          <select className={aurora.inp} value={openEdition ? "video" : type} onChange={(e) => setType(e.target.value as InterviewType)}>
            {TYPE_FILTERS.filter((t) => t.value !== "all" && t.value !== "bot" && (!openEdition || t.value === "video")).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={local.grid2}>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Interviewer Name</label>
          <input
            className={aurora.inp}
            required
            value={interviewerName}
            onChange={(e) => setInterviewerName(e.target.value)}
            placeholder="Dana Lee"
          />
        </div>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Interviewer Email (optional)</label>
          <input
            className={aurora.inp}
            type="email"
            value={interviewerEmail}
            onChange={(e) => setInterviewerEmail(e.target.value)}
            placeholder="dana@nextenti.com"
          />
        </div>
      </div>
      <div className={aurora.field}>
        <label className={aurora.lbl}>Location or Video Link (optional)</label>
        <input
          className={aurora.inp}
          value={locationOrLink}
          onChange={(e) => setLocationOrLink(e.target.value)}
          placeholder="https://meet…"
        />
      </div>
      <div className={aurora.field}>
        <label className={aurora.lbl}>Notes (optional)</label>
        <input className={aurora.inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && (
        <p className={local.error} role="alert">
          {error}
        </p>
      )}

      <div className={local.actions}>
        <button type="button" className={`${aurora.btn} ${aurora.btnGlass}`} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting || !candidateId} className={`${aurora.btn} ${aurora.btnAccent}`}>
          {submitting ? "Scheduling…" : "Schedule Interview"}
        </button>
      </div>
    </form>
  );
}
