"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { AuthShell, RoleSwap, RoleTabs } from "@/components/auth/AuthShell";
import s from "@/components/auth/AuthShell.module.css";
import { GoogleIcon } from "@/components/auth/icons";
import aurora from "@/components/aurora/aurora.module.css";
import { loginWithGoogle, register, resendVerificationEmail } from "@/lib/auth";
import { requestGoogleAccessToken } from "@/lib/google";

// This page only ever handles the two public-facing roles — Super Admin
// accounts are provisioned by an existing admin, never via public signup.
type Role = "candidate" | "employer";

const COPY: Record<
  Role,
  {
    heading: string;
    subheading: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    submitLabel: string;
  }
> = {
  candidate: {
    heading: "Create your account",
    subheading: "Start tracking applications and get matched to roles.",
    namePlaceholder: "Alex Johnson",
    emailPlaceholder: "alex@example.com",
    submitLabel: "Sign Up as Candidate",
  },
  employer: {
    heading: "Request recruiter access",
    subheading: "Set up your account to manage jobs and the candidate pipeline.",
    namePlaceholder: "Jamie Lee",
    emailPlaceholder: "you@company.com",
    submitLabel: "Sign Up as Employer",
  },
};

const HERO_COPY: Record<Role, { headline: string; subhead: string; features: string[] }> = {
  candidate: {
    headline: "Find a role that actually fits.",
    subhead: "Create an account to save jobs, apply in a click, and track every application.",
    features: [
      "Build a profile once, apply to roles in seconds",
      "Track every application and interview in one pipeline",
      "AI-matched job recommendations tailored to your profile",
    ],
  },
  employer: {
    headline: "Hire faster, with less busywork.",
    subhead: "Create an account to post roles, screen candidates, and manage interviews.",
    features: [
      "Post a role and start screening in minutes",
      "See every open role and its pipeline at a glance",
      "Coordinate interviews with your hiring team",
    ],
  },
};

const LEGAL = <>By continuing you agree to Krafziel&apos;s Terms &amp; Privacy Policy.</>;

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Invite emails link here with the candidate's address already filled in.
  const [role, setRole] = useState<Role>(searchParams.get("role") === "employer" ? "employer" : "candidate");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const isCandidate = role === "candidate";
  const copy = COPY[role];
  const hero = HERO_COPY[role];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms & Privacy Policy to continue.");
      return;
    }
    if (!isCandidate && !organizationName.trim()) {
      setError("Please enter your company/organization name.");
      return;
    }

    setSubmitting(true);
    try {
      await register({ role, fullName, email, password, organizationName });
      setSubmittedEmail(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!submittedEmail) return;
    setResending(true);
    setResendMessage(null);
    try {
      const detail = await resendVerificationEmail(submittedEmail);
      setResendMessage(detail || "Email sent.");
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : "Could not resend the email.");
    } finally {
      setResending(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      const result = await requestGoogleAccessToken();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await loginWithGoogle(role, result.accessToken);
      router.push(isCandidate ? "/candidate" : "/employer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setGoogleSubmitting(false);
    }
  }

  if (submittedEmail) {
    return (
      <AuthShell headline={hero.headline} subhead={hero.subhead} features={hero.features} centered>
        <div className={s.iconCircle} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18v12H3z" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </div>
        <h2 className={s.title} style={{ margin: 0 }}>
          Check your email
        </h2>
        <p className={s.centerText}>
          We sent a confirmation link to <strong className={s.strong}>{submittedEmail}</strong>. Click it to activate your account, then
          sign in.
        </p>

        {resendMessage && <p className={s.ok}>{resendMessage}</p>}

        <button type="button" disabled={resending} onClick={handleResend} className={`${aurora.btn} ${aurora.btnGlass} ${aurora.btnSm}`}>
          {resending ? "Resending…" : "Resend email"}
        </button>

        <Link href="/login" className={s.link}>
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell headline={hero.headline} subhead={hero.subhead} features={hero.features} footnote={LEGAL} tone={role}>
      <RoleTabs role={role} onChange={setRole} />

      <div>
        <h2 className={s.title}>
          <RoleSwap role={role} candidate={COPY.candidate.heading} employer={COPY.employer.heading} />
        </h2>
        <p className={s.sub}>
          <RoleSwap role={role} candidate={COPY.candidate.subheading} employer={COPY.employer.subheading} />
        </p>
      </div>

      <form suppressHydrationWarning onSubmit={handleSubmit} className={s.form}>
        <div className={aurora.field}>
          <label className={aurora.lbl} htmlFor="su-name">
            Full Name
          </label>
          <input suppressHydrationWarning
            id="su-name"
            className={aurora.inp}
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={copy.namePlaceholder}
          />
        </div>

        <div className={`${s.collapse} ${isCandidate ? s.collapseClosed : ""}`} aria-hidden={isCandidate} inert={isCandidate}>
          <div className={s.collapseInner}>
            <div className={aurora.field}>
              <label className={aurora.lbl} htmlFor="su-org">
                Company / Organization Name
              </label>
              <input suppressHydrationWarning
                id="su-org"
                className={aurora.inp}
                type="text"
                required={!isCandidate}
                tabIndex={isCandidate ? -1 : undefined}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          </div>
        </div>

        <div className={aurora.field}>
          <label className={aurora.lbl} htmlFor="su-email">
            Email Address
          </label>
          <input suppressHydrationWarning
            id="su-email"
            className={aurora.inp}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.emailPlaceholder}
          />
        </div>

        <div className={aurora.field}>
          <label className={aurora.lbl} htmlFor="su-pass">
            Password
          </label>
          <input suppressHydrationWarning
            id="su-pass"
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
          <label className={aurora.lbl} htmlFor="su-confirm">
            Confirm Password
          </label>
          <input suppressHydrationWarning
            id="su-confirm"
            className={aurora.inp}
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <label className={s.check}>
          <input suppressHydrationWarning type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I agree to Krafziel&apos;s Terms &amp; Privacy Policy.
        </label>

        {error && (
          <p className={s.err} role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className={`${aurora.btn} ${aurora.btnAccent} ${s.full}`}>
          {submitting ? "Creating account…" : <RoleSwap role={role} candidate={COPY.candidate.submitLabel} employer={COPY.employer.submitLabel} />}
        </button>
      </form>

      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <>
          <div className={s.divider}>OR</div>

          <button type="button" disabled={googleSubmitting} onClick={handleGoogleSignIn} className={`${aurora.btn} ${aurora.btnGlass} ${s.full}`}>
            <GoogleIcon size={16} />
            {googleSubmitting ? "Connecting…" : "Continue with Google"}
          </button>
        </>
      )}

      <p className={s.foot}>
        Already have an account?{" "}
        <Link href="/login" className={s.link}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
