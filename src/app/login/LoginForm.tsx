"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { getAuthPalette } from "@/components/auth/authPalette";
import { BriefcaseIcon, GoogleIcon, UserIcon } from "@/components/auth/icons";
import { useTheme } from "@/contexts/ThemeContext";
import { login, loginWithGoogle, resendVerificationEmail } from "@/lib/auth";
import { requestGoogleAccessToken } from "@/lib/google";

// This page only ever handles the two public-facing roles — Super Admin
// signs in via its own separate, non-public login page.
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
  const { theme } = useTheme();
  const palette = getAuthPalette(theme);
  const [role, setRole] = useState<Role>("candidate");

  useEffect(() => {
    const requested = searchParams.get("role");
    if (requested === "candidate" || requested === "employer") {
      setRole(requested);
    }
  }, [searchParams]);
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
    setSubmitting(true);
    try {
      await login({ role, email, password, remember });
      router.push(isCandidate ? "/candidate" : "/employer");
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
      router.push(isCandidate ? "/candidate" : "/employer");
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
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: palette.label, marginBottom: "6px" }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.emailPlaceholder}
              style={{
                width: "100%",
                padding: "11px 14px",
                background: palette.inputBg,
                border: palette.inputBorder,
                borderRadius: "12px",
                fontSize: "13px",
                color: palette.inputText,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: palette.label }}>Password</label>
              <Link href="/forgot-password" style={{ fontSize: "11px", fontWeight: 600, textDecoration: "none", color: palette.link }}>
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "11px 14px",
                background: palette.inputBg,
                border: palette.inputBorder,
                borderRadius: "12px",
                fontSize: "13px",
                color: palette.inputText,
                boxSizing: "border-box",
              }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: palette.checkboxText, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: "14px", height: "14px", accentColor: "#01617a" }}
            />
            Remember me
          </label>

          {error && (
            <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
              {error}
              {error.toLowerCase().includes("verify your email") && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingVerification}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#dc2626",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: resendingVerification ? "default" : "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {resendingVerification ? "Sending…" : "Resend email"}
                  </button>
                </>
              )}
            </p>
          )}
          {resendMessage && (
            <p style={{ fontSize: "12px", color: palette.link, margin: 0 }}>{resendMessage}</p>
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
            {submitting ? "Signing in…" : copy.submitLabel}
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
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ fontWeight: 700, textDecoration: "none", color: palette.link }}>
            Sign up
          </Link>
        </p>
      </div>

      <p style={{ textAlign: "center", fontSize: "11px", color: palette.mutedText, margin: 0 }}>
        By continuing you agree to Nextenti&apos;s Terms &amp; Privacy Policy.
      </p>
    </AuthShell>
  );
}
