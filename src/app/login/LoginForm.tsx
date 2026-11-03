"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, RoleSwap, RoleTabs } from "@/components/auth/AuthShell";
import s from "@/components/auth/AuthShell.module.css";
import { GoogleIcon } from "@/components/auth/icons";
import aurora from "@/components/aurora/aurora.module.css";
import { login, loginWithGoogle, resendVerificationEmail, safeNextPath } from "@/lib/auth";
import { requestGoogleAccessToken } from "@/lib/google";
import { OPEN_EDITION_HOME, setOpenEdition } from "@/lib/edition";

// This page only ever handles the two public-facing roles — Super Admin
// signs in via its own separate, non-public login page.
type Role = "candidate" | "employer";

const COPY: Record<
  Role,
  {
    heading: string;
    subheading: string;
    emailPlaceholder: string;
    submitLabel: string;
  }
> = {
  candidate: {
    heading: "Welcome back",
    subheading: "Sign in to track your applications and interviews.",
    emailPlaceholder: "alex@example.com",
    submitLabel: "Sign In as Candidate",
  },
  employer: {
    heading: "Employer sign in",
    subheading: "Access the recruiter dashboard and candidate pipeline.",
    emailPlaceholder: "you@company.com",
    submitLabel: "Sign In as Employer",
  },
};

const HERO_COPY: Record<Role, { headline: string; subhead: string; features: string[] }> = {
  candidate: {
    headline: "Your next role is closer than you think.",
    subhead: "Sign in to pick up where you left off and stay on top of every application.",
    features: [
      "Track every application and interview in one pipeline",
      "Get notified the moment your status changes",
      "AI-matched job recommendations tailored to your profile",
    ],
  },
  employer: {
    headline: "Run your entire hiring pipeline in one place.",
    subhead: "Sign in to review candidates, schedule interviews, and move roles forward.",
    features: [
      "See every open role and its pipeline at a glance",
      "Move candidates through stages in one click",
      "Coordinate interviews with your hiring team",
    ],
  },
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?role= is read once up front so a deep link never flashes the other role first.
  const [role, setRole] = useState<Role>(searchParams.get("role") === "employer" ? "employer" : "candidate");

  const openEdition = searchParams.get("edition") === "open";
  // Arriving from the "Open source" button turns the video-interviews-only edition on; any normal
  // sign-in link turns it off.
  useEffect(() => {
    setOpenEdition(openEdition);
  }, [openEdition]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const isCandidate = role === "candidate";
  const copy = COPY[role];
  const hero = HERO_COPY[role];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ role, email, password, remember });
      router.push(safeNextPath(searchParams.get("next")) ?? (openEdition ? OPEN_EDITION_HOME[role] : isCandidate ? "/candidate" : "/employer"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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
      router.push(safeNextPath(searchParams.get("next")) ?? (openEdition ? OPEN_EDITION_HOME[role] : isCandidate ? "/candidate" : "/employer"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleResendVerification() {
    setResendingVerification(true);
    setResendMessage(null);
    try {
      const detail = await resendVerificationEmail(email);
      setResendMessage(detail || "Email sent.");
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : "Could not resend the email.");
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <AuthShell
      headline={hero.headline}
      subhead={hero.subhead}
      features={hero.features}
      tone={role}
      footnote={<>By continuing you agree to Krafziel&apos;s Terms &amp; Privacy Policy.</>}
    >
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
          <label className={aurora.lbl} htmlFor="login-email">
            Email Address
          </label>
          <input suppressHydrationWarning
            id="login-email"
            className={aurora.inp}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.emailPlaceholder}
          />
        </div>

        <div className={aurora.field}>
          <div className={s.rowBetween}>
            <label className={aurora.lbl} htmlFor="login-password">
              Password
            </label>
            <Link href="/forgot-password" className={s.link} style={{ fontSize: 12 }}>
              Forgot password?
            </Link>
          </div>
          <input suppressHydrationWarning
            id="login-password"
            className={aurora.inp}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <label className={s.check}>
          <input suppressHydrationWarning type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me
        </label>

        {error && (
          <p className={s.err} role="alert">
            {error}
            {error.toLowerCase().includes("verify your email") && (
              <>
                {" "}
                <button type="button" className={s.linkBtn} onClick={handleResendVerification} disabled={resendingVerification}>
                  {resendingVerification ? "Sending…" : "Resend email"}
                </button>
              </>
            )}
          </p>
        )}
        {resendMessage && <p className={s.ok}>{resendMessage}</p>}

        <button type="submit" disabled={submitting} className={`${aurora.btn} ${aurora.btnAccent} ${s.full}`}>
          {submitting ? "Signing in…" : <RoleSwap role={role} candidate={COPY.candidate.submitLabel} employer={COPY.employer.submitLabel} />}
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
        Don&apos;t have an account?{" "}
        <Link href="/signup" className={s.link}>
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
