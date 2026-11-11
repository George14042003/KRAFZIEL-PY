"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { useSession } from "@/hooks/useSession";
import { changePassword, updateProfile } from "@/lib/auth";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function SuperAdminSettingsClient() {
  const { user, loading } = useSession("super_admin");

  const [fullName, setFullName] = useState("");
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

  if (loading || !user) return <AuroraLoading />;

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

  const formStyle = { display: "flex", flexDirection: "column", gap: "20px", borderRadius: "32px", padding: "32px" } as const;
  const titleStyle = { fontWeight: 600, fontSize: "22px", margin: 0, color: "var(--text)" } as const;
  const circle = {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;

  return (
    <>
      <AuroraPageHeader eyebrow="Account" title="Settings" subtitle="Manage your super admin account details and password." />

      <div className={styles.two}>
        <form onSubmit={handleProfileSubmit} className={styles.glass} style={formStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span className={styles.display} style={{ ...circle, background: "#0066ff", color: "#fff", fontWeight: 700, fontSize: "20px" }}>
              {initialsFor(fullName || user.full_name)}
            </span>
            <h2 className={styles.display} style={titleStyle}>
              Profile
            </h2>
          </div>

          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="sa-name">
              Full Name
            </label>
            <input id="sa-name" className={styles.inp} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="sa-email">
              Email Address
            </label>
            <input id="sa-email" className={styles.inp} value={user.email} disabled />
          </div>

          {profileError && (
            <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">
              {profileError}
            </p>
          )}
          {profileMessage && <p style={{ fontSize: "13px", color: "#34D399", margin: 0 }}>{profileMessage}</p>}

          <div>
            <button type="submit" disabled={savingProfile} className={`${styles.btn} ${styles.btnAccent}`}>
              {savingProfile ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </form>

        <form onSubmit={handlePasswordSubmit} className={styles.glass} style={formStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ ...circle, border: "1.5px dashed var(--line-2)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 11h14v10H5z M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <h2 className={styles.display} style={titleStyle}>
              Change Password
            </h2>
          </div>

          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="sa-cur">
              Current Password
            </label>
            <input id="sa-cur" className={styles.inp} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="sa-new">
              New Password
            </label>
            <input id="sa-new" className={styles.inp} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="sa-conf">
              Confirm New Password
            </label>
            <input id="sa-conf" className={styles.inp} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>

          {passwordError && (
            <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">
              {passwordError}
            </p>
          )}
          {passwordMessage && <p style={{ fontSize: "13px", color: "#34D399", margin: 0 }}>{passwordMessage}</p>}

          <div>
            <button type="submit" disabled={savingPassword} className={`${styles.btn} ${styles.btnLight}`}>
              {savingPassword ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
