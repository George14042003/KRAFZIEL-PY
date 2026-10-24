"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { verifyEmail, type AuthUser } from "@/lib/auth";

const FEATURES = [
  "Track every application and interview in one pipeline",
  "Real-time status updates for candidates and recruiters",
  "AI-matched job recommendations tailored to your profile",
];

type Status = "verifying" | "success" | "error";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("verifying");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("This link is missing its token.");
      return;
    }

    verifyEmail(token)
      .then((verifiedUser) => {
        setUser(verifiedUser);
        setStatus("success");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "This link is invalid or has expired.");
        setStatus("error");
      });
  }, [token]);

  return (
    <AuthShell headline="Confirm your email" subhead="One more step to activate your account." features={FEATURES}>
      <div
        style={{
          background: "#fff",
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
        {status === "verifying" && (
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Confirming your email…</p>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#e0f2fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              ✅
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Email confirmed</h2>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              {user ? `You're all set, ${user.full_name.split(" ")[0]}.` : "You're all set."} You can now sign in.
            </p>
            <Link
              href="/login"
              style={{
                display: "inline-block",
                marginTop: "8px",
                padding: "12px 24px",
                background: "#01617a",
                color: "#fff",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              Go to sign in
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Link invalid or expired</h2>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>{error}</p>
            <Link href="/login" style={{ fontSize: "12px", fontWeight: 700, color: "#01617a", marginTop: "8px" }}>
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
