"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { CANDIDATE_NAV, DashboardShell, EMPLOYER_NAV } from "@/components/dashboard/DashboardShell";
import { cardStyle, inputStyle, labelStyle, primaryButtonStyle } from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import { changePassword, updateProfile, type Role } from "@/lib/auth";

export function SettingsClient({
  role,
  variant,
  extra,
}: {
  role: Extract<Role, "employer" | "candidate">;
  variant?: "aurora";
  /** Extra sections rendered under the account forms (aurora variant). */
  extra?: ReactNode;
}) {
  const { user, loading } = useSession(role);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setFullName(user.full_name);
  }, [user]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      await updateProfile(fullName.trim());
      setProfileMessage("Profile updated.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not update your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (variant === "aurora") {
    const initials =
      user.full_name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "U";
    const formStyle = { display: "flex", flexDirection: "column", gap: "20px", padding: "32px", borderRadius: "32px", boxSizing: "border-box", alignSelf: "start" } as const;
    const headStyle = { display: "flex", alignItems: "center", gap: "16px" } as const;
    const iconCircle = { width: 64, height: 64, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" } as const;
    return (
      <DashboardShell user={user} nav={role === "candidate" ? CANDIDATE_NAV : EMPLOYER_NAV}>
        <AuroraPageHeader eyebrow="Account" title="Settings" subtitle="Manage your account details and password." />

        <div className={styles.two}>
          <form onSubmit={handleProfileSubmit} className={styles.glass} style={formStyle}>
            <div style={headStyle}>
              <div className={styles.display} style={{ ...iconCircle, background: "var(--violet)", color: "#fff", fontWeight: 700, fontSize: "20px" }}>
                {initials}
              </div>
              <h2 className={styles.display} style={{ fontWeight: 600, fontSize: "22px", margin: 0 }}>Profile</h2>
            </div>

            <div className={styles.field}>
              <label className={styles.lbl}>Full Name</label>
              <input className={styles.inp} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.lbl}>Email Address</label>
              <input className={styles.inp} value={user.email} disabled />
            </div>

            {profileError && (
              <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">{profileError}</p>
            )}
            {profileMessage && <p style={{ fontSize: "13px", color: "#34D399", margin: 0 }}>{profileMessage}</p>}

            <div>
              <button type="submit" disabled={savingProfile} className={`${styles.btn} ${styles.btnAccent}`} style={{ opacity: savingProfile ? 0.7 : 1 }}>
                {savingProfile ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </form>

          <form onSubmit={handlePasswordSubmit} className={styles.glass} style={formStyle}>
            <div style={headStyle}>
              <div style={{ ...iconCircle, border: "1.5px dashed var(--line-2)" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 11h14v10H5z M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </div>
              <h2 className={styles.display} style={{ fontWeight: 600, fontSize: "22px", margin: 0 }}>Change Password</h2>
            </div>

            <div className={styles.field}>
              <label className={styles.lbl}>Current Password</label>
              <input className={styles.inp} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.lbl}>New Password</label>
              <input className={styles.inp} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.lbl}>Confirm New Password</label>
              <input className={styles.inp} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>

            {passwordError && (
              <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">{passwordError}</p>
            )}
            {passwordMessage && <p style={{ fontSize: "13px", color: "#34D399", margin: 0 }}>{passwordMessage}</p>}

            <div>
              <button type="submit" disabled={savingPassword} className={`${styles.btn} ${styles.btnLight}`} style={{ opacity: savingPassword ? 0.7 : 1 }}>
                {savingPassword ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </div>
        {extra}
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user} nav={role === "candidate" ? CANDIDATE_NAV : EMPLOYER_NAV}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
          Dashboard <span style={{ color: "var(--text-faint)" }}>/</span> Settings
        </p>

        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            Settings
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Manage your account details and password.
          </p>
        </div>

        <form onSubmit={handleProfileSubmit} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Profile</h2>

          <div>
            <label style={labelStyle}>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} required />
          </div>

          <div>
            <label style={labelStyle}>Email Address</label>
            <input value={user.email} disabled style={{ ...inputStyle, background: "#f1f5f9", color: "#94a3b8" }} />
          </div>

          {profileError && (
            <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
              {profileError}
            </p>
          )}
          {profileMessage && (
            <p style={{ fontSize: "12px", color: "#15803d", margin: 0 }}>{profileMessage}</p>
          )}

          <div>
            <button type="submit" disabled={savingProfile} style={{ ...primaryButtonStyle, opacity: savingProfile ? 0.7 : 1 }}>
              {savingProfile ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </form>

        <form onSubmit={handlePasswordSubmit} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Change Password</h2>

          <div>
            <label style={labelStyle}>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {passwordError && (
            <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
              {passwordError}
            </p>
          )}
          {passwordMessage && (
            <p style={{ fontSize: "12px", color: "#15803d", margin: 0 }}>{passwordMessage}</p>
          )}

          <div>
            <button type="submit" disabled={savingPassword} style={{ ...primaryButtonStyle, opacity: savingPassword ? 0.7 : 1 }}>
              {savingPassword ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
