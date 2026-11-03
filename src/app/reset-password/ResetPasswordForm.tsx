"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import s from "@/components/auth/AuthShell.module.css";
import aurora from "@/components/aurora/aurora.module.css";
import { resetPassword } from "@/lib/auth";

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
      <div>
        <h2 className={s.title} style={{ margin: 0 }}>
          Reset your password
        </h2>
      </div>

      {submitted ? (
        <>
          <p className={s.ok}>Your password has been updated. You can now sign in.</p>
          <button type="button" onClick={() => router.push("/login")} className={`${aurora.btn} ${aurora.btnAccent} ${s.full}`}>
            Go to sign in
          </button>
        </>
      ) : (
        <form suppressHydrationWarning onSubmit={handleSubmit} className={s.form}>
          <div className={aurora.field}>
            <label className={aurora.lbl} htmlFor="rp-pass">
              New Password
            </label>
            <input suppressHydrationWarning
              id="rp-pass"
              className={aurora.inp}
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div className={aurora.field}>
            <label className={aurora.lbl} htmlFor="rp-confirm">
              Confirm New Password
            </label>
            <input suppressHydrationWarning
              id="rp-confirm"
              className={aurora.inp}
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className={s.err} role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className={`${aurora.btn} ${aurora.btnAccent} ${s.full}`}>
            {submitting ? "Updating…" : "Update Password"}
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
