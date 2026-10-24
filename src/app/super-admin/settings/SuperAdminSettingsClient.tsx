"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SuperAdminShell } from "@/components/superadmin/SuperAdminShell";
import { getAdminPalette } from "@/components/superadmin/adminStyles";
import { useTheme } from "@/contexts/ThemeContext";
import { useSession } from "@/hooks/useSession";
import { changePassword, updateProfile } from "@/lib/auth";

export function SuperAdminSettingsClient() {
  const { user, loading } = useSession("super_admin");
  const { theme } = useTheme();
  const palette = getAdminPalette(theme);

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

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: palette.textMuted, fontSize: "14px", background: palette.bg }}>
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

  return (
    <SuperAdminShell user={user}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: palette.textPrimary, margin: 0 }}>Settings</h1>
          <p style={{ fontSize: "12.5px", color: palette.textMuted, margin: "4px 0 0" }}>
            Manage your super admin account details and password.
          </p>
        </div>

        <form onSubmit={handleProfileSubmit} style={{ ...palette.card, display: "flex", flexDirection: "column", gap: "14px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 800, color: palette.textPrimary, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Profile
          </h2>

          <div>
            <label style={palette.label}>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={palette.input} required />
          </div>

          <div>
            <label style={palette.label}>Email Address</label>
            <input value={user.email} disabled style={{ ...palette.input, opacity: 0.6 }} />
          </div>

          {profileError && (
            <p style={{ fontSize: "12px", color: palette.negative, margin: 0 }} role="alert">
              {profileError}
            </p>
          )}
          {profileMessage && <p style={{ fontSize: "12px", color: palette.positive, margin: 0 }}>{profileMessage}</p>}

          <div>
            <button type="submit" disabled={savingProfile} style={{ ...palette.primaryButton, opacity: savingProfile ? 0.7 : 1 }}>
              {savingProfile ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </form>

        <form onSubmit={handlePasswordSubmit} style={{ ...palette.card, display: "flex", flexDirection: "column", gap: "14px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 800, color: palette.textPrimary, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Change Password
          </h2>

          <div>
            <label style={palette.label}>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={palette.input}
              required
            />
          </div>
          <div>
            <label style={palette.label}>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={palette.input} required />
          </div>
          <div>
            <label style={palette.label}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={palette.input}
              required
            />
          </div>

          {passwordError && (
            <p style={{ fontSize: "12px", color: palette.negative, margin: 0 }} role="alert">
              {passwordError}
            </p>
          )}
          {passwordMessage && <p style={{ fontSize: "12px", color: palette.positive, margin: 0 }}>{passwordMessage}</p>}

          <div>
            <button type="submit" disabled={savingPassword} style={{ ...palette.primaryButton, opacity: savingPassword ? 0.7 : 1 }}>
              {savingPassword ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </SuperAdminShell>
  );
}
