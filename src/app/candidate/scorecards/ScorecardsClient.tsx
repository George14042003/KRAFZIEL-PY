"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CANDIDATE_NAV, DashboardShell } from "@/components/dashboard/DashboardShell";
import { cardStyle } from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalInterview } from "@/lib/candidates";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const SCORE_DIMENSIONS: {
  key: "communication" | "problem_solving" | "culture_fit" | "keyword_relevance" | "confidence";
  label: string;
  color: string;
}[] = [
  { key: "communication", label: "Communication", color: "#0ea5e9" },
  { key: "problem_solving", label: "Problem Solving", color: "#8b5cf6" },
  { key: "culture_fit", label: "Culture Fit", color: "#22c55e" },
  { key: "keyword_relevance", label: "Answer Relevance", color: "#f59e0b" },
  { key: "confidence", label: "Speaking Confidence", color: "#ec4899" },
];

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
        <span style={{ color: "#475569", fontWeight: 600 }}>{label}</span>
        <span style={{ color: "#0f172a", fontWeight: 800 }}>{score}/10</span>
      </div>
      <div style={{ height: "6px", borderRadius: "999px", background: "#e2e8f0", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(score / 10) * 100}%`, background: color, borderRadius: "999px" }} />
      </div>
    </div>
  );
}

function ScorecardCard({ interview }: { interview: PortalInterview }) {
  const evaluation = interview.ai_evaluation;

  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>Bot Interview Scorecard</span>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
            {formatDate(interview.scheduled_at)} · with {interview.interviewer_name}
          </div>
        </div>
        {evaluation && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0e5266, #157a8f)",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "18px", fontWeight: 800, lineHeight: 1 }}>{evaluation.overall}</span>
            <span style={{ fontSize: "9px", opacity: 0.85 }}>/ 10</span>
          </div>
        )}
      </div>

      {evaluation ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {SCORE_DIMENSIONS.filter((d) => typeof evaluation[d.key] === "number").map((d) => (
              <ScoreBar key={d.key} label={d.label} score={evaluation[d.key] as number} color={d.color} />
            ))}
          </div>
          <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6, margin: 0, borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
            {evaluation.summary}
          </p>
        </>
      ) : interview.status === "completed" ? (
        <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
          This interview was submitted, but a scorecard isn&apos;t available for it yet.
        </p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
            {interview.interview_type === "bot"
              ? "Not attempted yet — your scorecard will show up here once you complete it."
              : "Not completed yet — your scorecard will show up here after the interview."}
          </p>
          {interview.interview_type === "bot" && (
            <Link
              href={`/bot-interview/${interview.id}`}
              target="_blank"
              style={{
                padding: "7px 14px",
                background: "#01617a",
                color: "#fff",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "12px",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Take Interview
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

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  return (
    <DashboardShell user={user} nav={CANDIDATE_NAV}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            Scorecards
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>
            AI-generated feedback from your bot and video interviews.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        {dataLoading ? (
          <div style={cardStyle}>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Loading…</p>
          </div>
        ) : interviews.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "40px 24px" }}>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              No bot or video interviews yet. Once you&apos;re scheduled for one, your scorecard will show up here after you complete it.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {interviews.map((interview) => (
              <ScorecardCard key={interview.id} interview={interview} />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
