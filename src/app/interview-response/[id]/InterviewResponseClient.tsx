"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import {
  acceptInterviewAvailability,
  declineInterviewAvailability,
  getInterviewAvailability,
  type AvailabilityInfo,
} from "@/lib/candidates";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const cardStyle = {
  width: "100%",
  maxWidth: "440px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "16px",
  padding: "36px",
  boxShadow: "0 25px 60px rgba(0,0,0,.5)",
  display: "flex",
  flexDirection: "column" as const,
  gap: "18px",
};

export function InterviewResponseClient({ interviewId }: { interviewId: string }) {
  const [info, setInfo] = useState<AvailabilityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getInterviewAvailability(interviewId)
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this interview."))
      .finally(() => setLoading(false));
  }, [interviewId]);

  async function respond(action: "accept" | "decline") {
    setSubmitting(true);
    setError(null);
    try {
      const updated =
        action === "accept"
          ? await acceptInterviewAvailability(interviewId)
          : await declineInterviewAvailability(interviewId);
      setInfo(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% 0%, #1e293b, #0a0f1a 60%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={cardStyle}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <Logo size={48} radius={13} />
          <div style={{ fontSize: "17px", fontWeight: 800, color: "#e2e8f0" }}>Nextenti</div>
        </div>

        {loading ? (
          <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", margin: 0 }}>Loading…</p>
        ) : error ? (
          <p style={{ fontSize: "13px", color: "#f87171", textAlign: "center", margin: 0 }} role="alert">
            {error}
          </p>
        ) : info ? (
          <>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: "17px", fontWeight: 800, color: "#e2e8f0", margin: "0 0 8px" }}>
                Confirm your interview
              </h1>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
                {info.interviewer_name} scheduled a{" "}
                <strong style={{ color: "#e2e8f0" }}>{info.interview_type.replace("_", " ")}</strong>{" "}
                interview with you on
              </p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#7dd3fc", margin: "6px 0 0" }}>
                {formatWhen(info.scheduled_at)}
              </p>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>
                {info.duration_minutes} minutes
              </p>
            </div>

            {info.availability_status === "pending" && (
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => respond("decline")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #475569",
                    background: "transparent",
                    color: "#e2e8f0",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: submitting ? "default" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  Can&apos;t make it
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => respond("accept")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #0891b2, #01617a)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: submitting ? "default" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Confirming…" : "I'm available"}
                </button>
              </div>
            )}

            {info.availability_status === "accepted" && (
              <div style={{ textAlign: "center", padding: "12px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "10px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#4ade80", margin: 0 }}>
                  You&apos;re confirmed for this interview.
                </p>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0" }}>
                  Check your email for the interview link.
                </p>
              </div>
            )}

            {info.availability_status === "declined" && (
              <div style={{ textAlign: "center", padding: "12px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "10px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#f87171", margin: 0 }}>
                  You&apos;ve declined this time.
                </p>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0" }}>
                  Your recruiter has been notified and will follow up to reschedule.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
