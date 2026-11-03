"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { useSession } from "@/hooks/useSession";
import { useOpenEdition } from "@/lib/edition";
import { getMyPortal, type PortalInterview } from "@/lib/candidates";
import s from "../candidate.module.css";
import { StatusChip } from "../ui";

const COLS = "1.2fr 1.6fr 1.3fr .8fr 1.1fr 1fr";

type Filter = "all" | "upcoming" | "past";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isUpcoming(interview: PortalInterview): boolean {
  return interview.status === "scheduled" && new Date(interview.scheduled_at).getTime() >= Date.now();
}

export function InterviewsClient() {
  const { user, loading } = useSession("candidate");
  const [interviews, setInterviews] = useState<PortalInterview[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) return;
    getMyPortal()
      .then((res) => setInterviews(res.candidate?.interviews ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your interviews."))
      .finally(() => setDataLoading(false));
  }, [user]);

  const openEdition = useOpenEdition();
  if (loading || !user) return <AuroraLoading />;

  const sorted = [...interviews]
    .filter((i) => !openEdition || i.interview_type === "video") // open source edition: video only
    .sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  const upcoming = sorted.filter(isUpcoming);
  const past = sorted.filter((i) => !isUpcoming(i));
  const shown = filter === "upcoming" ? upcoming : filter === "past" ? past : sorted;

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: sorted.length },
    { value: "upcoming", label: "Upcoming", count: upcoming.length },
    { value: "past", label: "Past", count: past.length },
  ];

  return (
    <>
      <AuroraPageHeader
        eyebrow="Schedule"
        title="My Interviews"
        subtitle={`${interviews.length} interviews · past and upcoming`}
      />

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <p className={s.muted}>Loading…</p>
      ) : (
        <div className={aurora.sidebarLayout}>
          <aside className={`${aurora.glass} ${aurora.sideCard}`}>
            <span className={aurora.sideLabel}>Show</span>
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`${aurora.fi} ${filter === f.value ? aurora.fiOn : ""}`}
              >
                {f.label}
                <span className={aurora.n}>{f.count}</span>
              </button>
            ))}
          </aside>

          <div className={`${aurora.glass} ${aurora.tableCard}`}>
            <div className={aurora.tableScroll}>
              <div className={aurora.th} style={{ gridTemplateColumns: COLS }}>
                <span>Interview</span>
                <span>Date &amp; Time</span>
                <span>Interviewer</span>
                <span>Duration</span>
                <span>Status</span>
                <span />
              </div>
              {shown.length === 0 ? (
                <p className={s.muted} style={{ padding: "24px 28px", fontSize: 13 }}>
                  {filter === "past" ? "No past interviews." : "Nothing scheduled yet."}
                </p>
              ) : (
                shown.map((interview) => (
                  <div key={interview.id} className={aurora.tr} style={{ gridTemplateColumns: COLS }}>
                    <span className={`${s.strong} ${s.cap}`}>{interview.interview_type} interview</span>
                    <span className={s.cell}>{formatWhen(interview.scheduled_at)}</span>
                    <span className={s.cell}>{interview.interviewer_name}</span>
                    <span className={s.cell}>{interview.duration_minutes}m</span>
                    <span>
                      <StatusChip status={interview.status} />
                    </span>
                    <span>
                      {interview.interview_type === "video" && interview.status === "scheduled" && (
                        <Link href={`/call/${interview.id}`} target="_blank" className={`${aurora.btn} ${aurora.btnAccent} ${aurora.btnSm}`}>
                          Join Call
                        </Link>
                      )}
                      {interview.interview_type === "bot" && interview.status === "scheduled" && (
                        <Link href={`/bot-interview/${interview.id}`} target="_blank" className={`${aurora.btn} ${aurora.btnAccent} ${aurora.btnSm}`}>
                          Join the interview
                        </Link>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className={aurora.tableFoot}>
              {shown.length} of {sorted.length} interviews
            </div>
          </div>
        </div>
      )}
    </>
  );
}
