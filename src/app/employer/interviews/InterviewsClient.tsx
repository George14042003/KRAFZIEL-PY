"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  phone: "#0d9488",
  video: "#4338ca",
  onsite: "#ea580c",
  technical: "#7c3aed",
  final: "#dc2626",
  bot: "#0f172a",
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

  const filteredInterviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    return interviews
      .filter((i) => {
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
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
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
    <DashboardShell user={user} fitToScreen>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
          Dashboard <span style={{ color: "var(--text-faint)" }}>/</span> Interviews
        </p>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
              Interviews
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              {interviews.length} interviews · across your whole team
            </p>
          </div>
          {!showForm && (
            <button type="button" style={primaryButtonStyle} onClick={() => setShowForm(true)}>
              + Schedule Interview
            </button>
          )}
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
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
          <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Loading interviews…</div>
        ) : interviews.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>No interviews yet</span>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0, maxWidth: "360px" }}>
              Schedule an interview for any candidate in your pool to see it show up here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0 }}>
            <aside
              style={{
                width: "200px",
                flexShrink: 0,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                overflowY: "auto",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", color: "#94a3b8" }}>
                STATUS
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {STATUS_FILTERS.map((s) => {
                  const count = s.value === "all" ? interviews.length : statusCounts.get(s.value) ?? 0;
                  const isActive = statusFilter === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStatusFilter(s.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "none",
                        background: isActive ? "#e0f2fe" : "transparent",
                        color: isActive ? "#01617a" : "#334155",
                        fontWeight: isActive ? 700 : 500,
                        fontSize: "13px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {s.label}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          background: isActive ? "#bae6fd" : "#f1f5f9",
                          color: isActive ? "#014a5e" : "#64748b",
                          borderRadius: "999px",
                          padding: "1px 8px",
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>Search</label>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Candidate, interviewer..."
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as InterviewType | "all")}
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    {TYPE_FILTERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span style={{ fontSize: "12px", color: "#94a3b8", paddingBottom: "9px" }}>
                  {filteredInterviews.length} shown
                </span>
              </div>

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.8fr 1.3fr 0.9fr 1.1fr 0.7fr 1.1fr 0.6fr",
                    gap: "8px",
                    padding: "12px 18px",
                    borderBottom: "1px solid #e2e8f0",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    color: "#94a3b8",
                  }}
                >
                  <span>CANDIDATE</span>
                  <span>DATE &amp; TIME</span>
                  <span>TYPE</span>
                  <span>INTERVIEWER</span>
                  <span>DURATION</span>
                  <span>STATUS</span>
                  <span></span>
                </div>

                <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                  {filteredInterviews.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#94a3b8", padding: "24px 18px" }}>
                      No interviews match these filters.
                    </p>
                  ) : (
                    filteredInterviews.map((interview) => {
                      const candidate = candidateMap.get(interview.candidate_id);
                      const color = TYPE_COLORS[interview.interview_type];
                      return (
                        <div
                          key={interview.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.8fr 1.3fr 0.9fr 1.1fr 0.7fr 1.1fr 0.6fr",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 18px",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          <Link
                            href={`/employer/candidates/${interview.candidate_id}`}
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "#0f172a",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {candidate?.applicant_name ?? "Unknown candidate"}
                          </Link>
                          <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span style={{ fontSize: "12px", color: "#334155" }}>{formatWhen(interview.scheduled_at)}</span>
                            <StatusBadge status={interview.availability_status} />
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#334155" }}>
                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                            {typeLabel(interview.interview_type)}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#334155",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {interview.interviewer_name}
                          </span>
                          <span style={{ fontSize: "12px", color: "#334155" }}>{interview.duration_minutes}m</span>
                          <select
                            value={interview.status}
                            onChange={(e) => handleStatusChange(interview, e.target.value as InterviewStatus)}
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "5px 8px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              color: "#334155",
                              background: "#fff",
                              width: "fit-content",
                            }}
                          >
                            {STATUS_FILTERS.filter((s) => s.value !== "all").map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDelete(interview)}
                            style={{
                              justifySelf: "end",
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#dc2626",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 6px",
                            }}
                          >
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
      </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Candidate</label>
          <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} style={inputStyle}>
            {candidates.length === 0 && <option value="">No candidates yet</option>}
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.applicant_name}
              </option>
            ))}
          </select>
        </div>
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
            {TYPE_FILTERS.filter((t) => t.value !== "all" && t.value !== "bot").map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
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
        <button type="submit" disabled={submitting || !candidateId} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Scheduling…" : "Schedule Interview"}
        </button>
      </div>
    </form>
  );
}
