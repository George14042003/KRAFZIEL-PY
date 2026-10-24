"use client";

import { useState } from "react";

type ConsentGateProps = {
  onAccept: () => Promise<void> | void;
  onDecline?: () => void;
};

const CONSENT_ITEMS = [
  {
    key: "recording_and_ai_evaluation" as const,
    title: "Recording & AI-based evaluation",
    body:
      "I consent to my video/audio being recorded during this interview, and to my answers being " +
      "analyzed and scored by an AI model to help evaluate my communication, problem-solving, and " +
      "overall fit for the role.",
  },
  {
    key: "proctoring_and_identity_snapshot" as const,
    title: "Proctoring & identity verification",
    body:
      "I consent to webcam-based face-presence checks and screen-share monitoring during the " +
      "interview to help ensure academic/interview integrity, and to a single photo captured at the " +
      "start of this interview being kept as a record of who attended it.",
  },
  {
    key: "data_storage_and_retention" as const,
    title: "Data storage & retention",
    body:
      "I consent to Nextenti storing my application data, resume, and interview records (including " +
      "recordings, transcripts, and the identity snapshot above) for recruitment purposes, in " +
      "accordance with applicable data protection law. I understand I may request access to or " +
      "deletion of this data by contacting the organization I applied to.",
  },
];

export function ConsentGate({ onAccept, onDecline }: ConsentGateProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = CONSENT_ITEMS.every((item) => checked[item.key]);

  async function handleAccept() {
    if (!allChecked) {
      setError("Please review and check all sections below to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onAccept();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your consent. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "radial-gradient(circle at 50% 0%, #3f0d10, #0a0a0c 65%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "rgba(127, 29, 29, 0.28)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          border: "1px solid rgba(248, 113, 113, 0.35)",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 25px 70px rgba(127, 29, 29, 0.35)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: "10.5px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#fca5a5",
              background: "rgba(248, 113, 113, 0.15)",
              border: "1px solid rgba(248, 113, 113, 0.35)",
              padding: "4px 10px",
              borderRadius: "999px",
              marginBottom: "12px",
            }}
          >
            Consent required
          </span>
          <h1 style={{ fontSize: "19px", fontWeight: 800, color: "#fff", margin: 0 }}>
            Before we begin, please review &amp; accept
          </h1>
          <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.7)", margin: "6px 0 0", lineHeight: 1.6 }}>
            In accordance with applicable data protection and information technology law, we need your
            explicit consent before recording or evaluating this interview.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {CONSENT_ITEMS.map((item) => (
            <label
              key={item.key}
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                padding: "14px",
                borderRadius: "14px",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={!!checked[item.key]}
                onChange={(e) => setChecked((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                style={{ width: "16px", height: "16px", marginTop: "2px", accentColor: "#ef4444", flexShrink: 0 }}
              />
              <span>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "3px" }}>
                  {item.title}
                </span>
                <span style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>
                  {item.body}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p style={{ fontSize: "12px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          {onDecline && (
            <button
              type="button"
              onClick={onDecline}
              style={{
                flex: "0 0 auto",
                padding: "12px 18px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.25)",
                background: "transparent",
                color: "rgba(255,255,255,0.85)",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Decline
            </button>
          )}
          <button
            type="button"
            onClick={handleAccept}
            disabled={submitting || !allChecked}
            style={{
              flex: 1,
              padding: "12px 18px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              color: "#fff",
              fontWeight: 800,
              fontSize: "13px",
              cursor: submitting || !allChecked ? "default" : "pointer",
              opacity: submitting || !allChecked ? 0.6 : 1,
            }}
          >
            {submitting ? "Saving…" : "I Agree & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
