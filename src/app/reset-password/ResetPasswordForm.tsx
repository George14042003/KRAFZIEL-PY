"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { resetPassword } from "@/lib/auth";

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

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This link is missing its token. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell headline="Set a new password" subhead="Choose a strong password for your account." features={FEATURES}>
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
        </div>

        {submitted ? (
          <>
            <p style={{ fontSize: "13px", color: "#334155", margin: 0, lineHeight: 1.6 }}>
              Your password has been updated. You can now sign in.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              style={{
                padding: "12px",
                background: "#01617a",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Go to sign in
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
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
              {submitting ? "Updating…" : "Update Password"}
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
