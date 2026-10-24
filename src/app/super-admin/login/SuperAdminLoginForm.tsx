"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/Logo";
import { adminInputStyle, adminLabelStyle, adminPrimaryButtonStyle } from "@/components/superadmin/adminStyles";
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
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% 0%, #1e293b, #0a0f1a 60%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "16px",
          padding: "36px",
          boxShadow: "0 25px 60px rgba(0,0,0,.5)",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <Logo size={48} radius={13} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "17px", fontWeight: 800, color: "#e2e8f0" }}>Nextenti</div>
            <div
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#f59e0b",
                marginTop: "2px",
              }}
            >
              Super Admin Console
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={adminLabelStyle}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nextenti.ai"
              style={adminInputStyle}
            />
          </div>
          <div>
            <label style={adminLabelStyle}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={adminInputStyle}
            />
          </div>

          {error && (
            <p style={{ fontSize: "12px", color: "#f87171", margin: 0 }} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{ ...adminPrimaryButtonStyle, opacity: submitting ? 0.7 : 1, marginTop: "4px" }}
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{ fontSize: "11px", color: "#64748b", margin: 0, textAlign: "center" }}>
          Restricted access. Contact your Nextenti account owner if you need admin credentials.
        </p>
      </div>
    </div>
  );
}
