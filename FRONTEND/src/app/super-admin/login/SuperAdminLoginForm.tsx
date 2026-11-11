"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuroraCanvas } from "@/components/aurora/AuroraCanvas";
import styles from "@/components/aurora/aurora.module.css";
import { BrandLogo } from "@/components/BrandLogo";
import { login } from "@/lib/auth";

export function SuperAdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ role: "super_admin", email, password, remember: false });
      router.push("/super-admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuroraCanvas style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", boxSizing: "border-box" }}>
      <div
        className={`${styles.glass} ${styles.popIn}`}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "440px",
          borderRadius: "32px",
          padding: "40px 36px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "26px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", textAlign: "center" }}>
          <BrandLogo onLight height="clamp(30px, 9.5vw, 56px)" />
          <div>
            <h1 className={styles.display} style={{ fontWeight: 700, fontSize: "30px", letterSpacing: "-0.03em", margin: 0, color: "var(--text)" }}>
              Super Admin Console
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-3)", margin: "8px 0 0" }}>Sign in to manage every organization on Krafziel.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="sa-login-email">
              Email
            </label>
            <input
              id="sa-login-email"
              className={styles.inp}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nextenti.ai"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="sa-login-password">
              Password
            </label>
            <input
              id="sa-login-password"
              className={styles.inp}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className={`${styles.btn} ${styles.btnAccent}`} style={{ width: "100%", justifyContent: "center" }}>
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-4)", margin: 0, textAlign: "center" }}>
            Restricted access. Contact your Krafziel account owner if you need admin credentials.
          </p>
          <Link href="/" style={{ fontSize: "13px", color: "var(--text-3)", textDecoration: "none" }}>
            ← Back to site
          </Link>
        </div>
      </div>
    </AuroraCanvas>
  );
}
