"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import s from "@/components/auth/AuthShell.module.css";
import aurora from "@/components/aurora/aurora.module.css";
import { requestPasswordReset } from "@/lib/auth";

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
      <div>
        <h2 className={s.title}>Reset your password</h2>
        <p className={s.sub}>Enter the email associated with your account.</p>
      </div>

      {submitted ? (
        <p className={s.ok}>
          If <strong>{email}</strong> is registered, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form suppressHydrationWarning onSubmit={handleSubmit} className={s.form}>
          <div className={aurora.field}>
            <label className={aurora.lbl} htmlFor="fp-email">
              Email Address
            </label>
            <input suppressHydrationWarning
              id="fp-email"
              className={aurora.inp}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <p className={s.err} role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className={`${aurora.btn} ${aurora.btnAccent} ${s.full}`}>
            {submitting ? "Sending…" : "Send Reset Link"}
          </button>
        </form>
      )}

      <p className={s.foot}>
        <Link href="/login" className={s.link}>
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
