"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { getAuthPalette } from "@/components/auth/authPalette";
import { BriefcaseIcon, GoogleIcon, UserIcon } from "@/components/auth/icons";
import { useTheme } from "@/contexts/ThemeContext";
import { loginWithGoogle, register, resendVerificationEmail } from "@/lib/auth";
import { requestGoogleAccessToken } from "@/lib/google";

// This page only ever handles the two public-facing roles — Super Admin
// accounts are provisioned by an existing admin, never via public signup.
type Role = "candidate" | "employer";

const tabBase: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "9px",
  border: "none",
  borderRadius: "11px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
};

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

export function SignupForm() {
  const router = useRouter();
  const { theme } = useTheme();
  const palette = getAuthPalette(theme);
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    background: palette.inputBg,
    border: palette.inputBorder,
    borderRadius: "12px",
    fontSize: "13px",
    color: palette.inputText,
    boxSizing: "border-box",
  };
  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: palette.label,
    marginBottom: "6px",
  };
  const [role, setRole] = useState<Role>("candidate");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
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

  const candidateTabStyle: CSSProperties = {
    ...tabBase,
    background: isCandidate ? palette.tabActiveBg : "transparent",
    color: isCandidate ? palette.tabActiveText : palette.tabInactiveText,
    boxShadow: isCandidate ? palette.tabActiveShadow : "none",
  };

  const employerTabStyle: CSSProperties = {
    ...tabBase,
    background: !isCandidate ? palette.tabActiveBg : "transparent",
    color: !isCandidate ? palette.tabActiveText : palette.tabInactiveText,
    boxShadow: !isCandidate ? palette.tabActiveShadow : "none",
  };

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
      <AuthShell headline={hero.headline} subhead={hero.subhead} features={hero.features} mirrored={!isCandidate}>
        <div
          style={{
            background: palette.cardBg,
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
            border: palette.cardBorder,
            borderRadius: "28px",
            padding: "36px",
            boxShadow: "0 25px 60px rgba(0,0,0,.35)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            textAlign: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: palette.iconCircleBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            ✉️
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: palette.heading, margin: 0 }}>Check your email</h2>
          <p style={{ fontSize: "13px", color: palette.subheading, margin: 0, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: palette.heading }}>{submittedEmail}</strong>. Click it
            to activate your account, then sign in.
          </p>

          {resendMessage && (
            <p style={{ fontSize: "12px", color: palette.link, margin: 0 }}>{resendMessage}</p>
          )}

          <button
            type="button"
            disabled={resending}
            onClick={handleResend}
            style={{
              marginTop: "8px",
              padding: "10px 16px",
              border: palette.googleBorder,
              background: palette.googleBg,
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 700,
              color: palette.googleText,
              cursor: resending ? "default" : "pointer",
              opacity: resending ? 0.7 : 1,
            }}
          >
            {resending ? "Resending…" : "Resend email"}
          </button>

          <Link href="/login" style={{ fontSize: "12px", fontWeight: 700, color: palette.link, marginTop: "8px" }}>
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell headline={hero.headline} subhead={hero.subhead} features={hero.features} mirrored={!isCandidate}>
      <div
        style={{
          background: palette.cardBg,
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          border: palette.cardBorder,
          borderRadius: "28px",
          padding: "36px",
          boxShadow: "0 25px 60px rgba(0,0,0,.35)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div style={{ display: "flex", background: palette.tabWrapBg, borderRadius: "14px", padding: "4px", gap: "4px" }}>
          <button type="button" style={candidateTabStyle} onClick={() => setRole("candidate")}>
            <UserIcon size={14} color={isCandidate ? palette.tabActiveText : palette.tabInactiveText} />
            Candidate
          </button>
          <button type="button" style={employerTabStyle} onClick={() => setRole("employer")}>
            <BriefcaseIcon size={14} color={!isCandidate ? palette.tabActiveText : palette.tabInactiveText} />
            Employer
          </button>
        </div>

        <div style={{ textAlign: "left" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: palette.heading, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            {copy.heading}
          </h2>
          <p style={{ fontSize: "13px", color: palette.subheading, margin: 0 }}>{copy.subheading}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={copy.namePlaceholder}
              style={inputStyle}
            />
          </div>

          {!isCandidate && (
            <div>
              <label style={labelStyle}>Company / Organization Name</label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Corp"
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.emailPlaceholder}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
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
            <label style={labelStyle}>Confirm Password</label>
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

          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", color: palette.checkboxText, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: "14px", height: "14px", marginTop: "2px", accentColor: "#01617a", flexShrink: 0 }}
            />
            I agree to Nextenti&apos;s Terms &amp; Privacy Policy.
          </label>

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
              marginTop: "4px",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Creating account…" : copy.submitLabel}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1, height: "1px", background: palette.dividerLine }} />
          <span style={{ fontSize: "11px", color: palette.dividerText, fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: palette.dividerLine }} />
        </div>

        <button
          type="button"
          disabled={googleSubmitting}
          onClick={handleGoogleSignIn}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "11px",
            border: palette.googleBorder,
            background: palette.googleBg,
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 600,
            color: palette.googleText,
            cursor: googleSubmitting ? "default" : "pointer",
            opacity: googleSubmitting ? 0.7 : 1,
          }}
        >
          <GoogleIcon size={16} />
          {googleSubmitting ? "Connecting…" : "Continue with Google"}
        </button>

        <p style={{ textAlign: "center", fontSize: "12px", color: palette.subheading, margin: 0 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ fontWeight: 700, textDecoration: "none", color: palette.link }}>
            Sign in
          </Link>
        </p>
      </div>

      <p style={{ textAlign: "center", fontSize: "11px", color: palette.mutedText, margin: 0 }}>
        By continuing you agree to Nextenti&apos;s Terms &amp; Privacy Policy.
      </p>
    </AuthShell>
  );
}
