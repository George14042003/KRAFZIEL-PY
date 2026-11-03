"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import s from "@/components/auth/AuthShell.module.css";
import { CheckIcon } from "@/components/auth/icons";
import aurora from "@/components/aurora/aurora.module.css";
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
    <AuthShell headline="Confirm your email" subhead="One more step to activate your account." features={FEATURES} centered>
      {status === "verifying" && (
        <>
          <div className={aurora.spinner} aria-hidden="true" style={{ width: 28, height: 28 }} />
          <p className={s.centerText}>Confirming your email…</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className={s.iconCircle} aria-hidden="true">
            <CheckIcon size={24} />
          </div>
          <h2 className={s.title} style={{ margin: 0 }}>
            Email confirmed
          </h2>
          <p className={s.centerText}>
            {user ? `You're all set, ${user.full_name.split(" ")[0]}.` : "You're all set."} You can now sign in.
          </p>
          <Link href="/login" className={`${aurora.btn} ${aurora.btnAccent}`}>
            Go to sign in
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <h2 className={s.title} style={{ margin: 0 }}>
            Link invalid or expired
          </h2>
          <p className={s.err}>{error}</p>
          <Link href="/login" className={s.link}>
            Back to sign in
          </Link>
        </>
      )}
    </AuthShell>
  );
}
