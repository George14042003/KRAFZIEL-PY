"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalInterview } from "@/lib/candidates";
import s from "../candidate.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const SCORE_DIMENSIONS: {
  key: "communication" | "problem_solving" | "culture_fit" | "keyword_relevance" | "confidence";
  label: string;
  color: string;
}[] = [
  { key: "communication", label: "Communication", color: "#38BDF8" },
  { key: "problem_solving", label: "Problem Solving", color: "#00B4FF" },
  { key: "culture_fit", label: "Culture Fit", color: "#34D399" },
  { key: "keyword_relevance", label: "Answer Relevance", color: "#FFB020" },
  { key: "confidence", label: "Speaking Confidence", color: "#FB7185" },
];

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className={s.scoreRow}>
      <div className={s.scoreTop}>
        <span>{label}</span>
        <b>{score}/10</b>
      </div>
      <div className={aurora.bar} style={{ height: 6 }}>
        <i style={{ width: `${(score / 10) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function ScorecardCard({ interview }: { interview: PortalInterview }) {
  const evaluation = interview.ai_evaluation;

  return (
    <div className={`${aurora.glass} ${aurora.card} ${s.job}`}>
      <div className={s.cardHead}>
        <div>
          <div className={s.jobTitle} style={{ fontSize: 18 }}>
            Bot Interview Scorecard
          </div>
          <div className={s.jobMeta}>
            {formatDate(interview.scheduled_at)} · with {interview.interviewer_name}
          </div>
        </div>
        {evaluation && (
          <div className={s.score}>
            <b>{evaluation.overall}</b>
            <small>/ 10</small>
          </div>
        )}
      </div>

      {evaluation ? (
        <>
          <div className={s.col} style={{ gap: 14 }}>
            {SCORE_DIMENSIONS.filter((d) => typeof evaluation[d.key] === "number").map((d) => (
              <ScoreBar key={d.key} label={d.label} score={evaluation[d.key] as number} color={d.color} />
            ))}
          </div>
          <p className={s.summary}>{evaluation.summary}</p>
        </>
      ) : interview.status === "completed" ? (
        <p className={s.muted}>Your answers were submitted. Your scorecard is being generated and will appear here shortly. Refresh in a minute.</p>
      ) : (
        <div className={s.cardHead}>
          <p className={s.muted} style={{ flex: "1 1 220px" }}>
            {interview.interview_type === "bot"
              ? "Not attempted yet — your scorecard will show up here once you complete it."
              : "Not completed yet — your scorecard will show up here after the interview."}
          </p>
          {interview.interview_type === "bot" && (
            <Link href={`/bot-interview/${interview.id}`} target="_blank" className={`${aurora.btn} ${aurora.btnAccent} ${aurora.btnSm}`}>
              Join the interview
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function ScorecardsClient() {
  const { user, loading } = useSession("candidate");
  const [interviews, setInterviews] = useState<PortalInterview[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyPortal()
      .then((res) =>
        setInterviews((res.candidate?.interviews ?? []).filter((i) => i.interview_type === "bot" || i.interview_type === "video"))
      )
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your scorecards."))
      .finally(() => setDataLoading(false));
  }, [user]);

  if (loading || !user) return <AuroraLoading />;

  return (
    <>
      <AuroraPageHeader
        eyebrow="Feedback"
        title="Scorecards"
        subtitle="AI-generated feedback from your bot and video interviews."
      />

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <p className={s.muted}>Loading…</p>
      ) : interviews.length === 0 ? (
        <div className={`${aurora.glass} ${aurora.card} ${s.emptyCard}`}>
          <span className={s.emptyTitle}>No scorecards yet</span>
          <p className={s.emptyText}>
            No bot or video interviews yet. Once you&apos;re scheduled for one, your scorecard will show up here after you complete it.
          </p>
        </div>
      ) : (
        <div className={s.jobGrid}>
          {interviews.map((interview) => (
            <ScorecardCard key={interview.id} interview={interview} />
          ))}
        </div>
      )}
    </>
  );
}
