"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { requestPasswordReset } from "@/lib/auth";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  fontSize: "13px",
  color: "#0f172a",
  boxSizing: "border-box",
};

const FEATURES = [
  "Track every application and interview in one pipeline",
  "Real-time status updates for candidates and recruiters",
  "AI-matched job recommendations tailored to your profile",
];

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      headline="Forgot your password?"
      subhead="No worries — we'll email you a link to reset it."
      features={FEATURES}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "28px",
          padding: "36px",
          boxShadow: "0 25px 60px rgba(0,0,0,.35)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            Reset your password
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            Enter the email associated with your account.
          </p>
        </div>

        {submitted ? (
          <p style={{ fontSize: "13px", color: "#334155", margin: 0, lineHeight: 1.6 }}>
            If <strong>{email}</strong> is registered, a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px",
                background: "#01617a",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", fontSize: "12px", color: "#64748b", margin: 0 }}>
          <Link href="/login" style={{ fontWeight: 700, textDecoration: "none", color: "#01617a" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
