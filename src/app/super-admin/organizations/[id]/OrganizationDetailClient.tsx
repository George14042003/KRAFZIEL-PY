"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SuperAdminShell } from "@/components/superadmin/SuperAdminShell";
import { getAdminPalette } from "@/components/superadmin/adminStyles";
import { useTheme } from "@/contexts/ThemeContext";
import { useSession } from "@/hooks/useSession";
import {
  deleteOrganization,
  getOrganization,
  updateOrganization,
  type Organization,
} from "@/lib/superAdmin";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function OrganizationDetailClient({ orgId }: { orgId: string }) {
  const { user, loading } = useSession("super_admin");
  const { theme } = useTheme();
  const palette = getAdminPalette(theme);
  const [org, setOrg] = useState<Organization | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    getOrganization(orgId)
      .then((data) => {
        setOrg(data);
        setName(data.name);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this organization."))
      .finally(() => setDataLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, orgId]);

  async function handleRename() {
    if (!org || name.trim() === org.name) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateOrganization(orgId, { name: name.trim() });
      setOrg(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not rename organization.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!org) return;
    setToggling(true);
    try {
      const updated = await updateOrganization(orgId, {
        status: org.status === "active" ? "suspended" : "active",
      });
      setOrg(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteOrganization(orgId);
      window.location.href = "/super-admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete organization.");
      setDeleting(false);
    }
  }

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: palette.textMuted, fontSize: "14px", background: palette.bg }}>
        Loading…
      </div>
    );
  }

  return (
    <SuperAdminShell user={user}>
      <Link href="/super-admin" style={{ fontSize: "12px", color: palette.textMuted, textDecoration: "none", marginBottom: "16px", display: "inline-block" }}>
        ← All organizations
      </Link>

      {error && (
        <p style={{ fontSize: "13px", color: palette.negative, margin: "0 0 16px" }} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <p style={{ fontSize: "12px", color: palette.textMuted }}>Loading…</p>
      ) : org ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 800, color: palette.textPrimary, margin: 0 }}>{org.name}</h1>
              <p style={{ fontSize: "12px", color: palette.textMuted, margin: "4px 0 0" }}>
                Created {formatDate(org.created_at)} · Status:{" "}
                <span style={{ color: org.status === "active" ? palette.positive : palette.negative, fontWeight: 700 }}>{org.status}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={toggling}
              style={{
                ...(org.status === "active" ? palette.dangerButton : palette.primaryButton),
                opacity: toggling ? 0.7 : 1,
              }}
            >
              {toggling ? "Working…" : org.status === "active" ? "Suspend Organization" : "Reactivate Organization"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
            {[
              ["Employers", org.employer_count],
              ["Candidates", org.candidate_count],
              ["Jobs", org.job_count],
            ].map(([label, value]) => (
              <div key={label} style={{ ...palette.card, textAlign: "center" }}>
                <div style={{ fontSize: "24px", fontWeight: 800, color: palette.textPrimary }}>{value}</div>
                <div style={{ fontSize: "11px", color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ ...palette.card, display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 800, color: palette.textPrimary, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Rename Organization
            </h2>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ ...palette.input, maxWidth: "320px" }}
              />
              <button
                type="button"
                onClick={handleRename}
                disabled={saving || name.trim() === org.name || !name.trim()}
                style={{ ...palette.primaryButton, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {saveError && (
              <p style={{ fontSize: "12px", color: palette.negative, margin: 0 }} role="alert">
                {saveError}
              </p>
            )}
          </div>

          <div style={{ ...palette.card, borderColor: palette.dark ? "#7f1d1d" : "#fecaca", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 800, color: palette.negative, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Danger Zone
            </h2>
            <p style={{ fontSize: "12px", color: palette.textMuted, margin: 0 }}>
              Permanently deletes this organization and every employer, candidate, job, interview, and offer that
              belongs to it. This cannot be undone.
            </p>
            {!confirmingDelete ? (
              <div>
                <button type="button" style={palette.dangerButton} onClick={() => setConfirmingDelete(true)}>
                  Delete Organization
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: palette.negative, fontWeight: 700 }}>Are you sure?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ ...palette.dangerButton, background: "#7f1d1d", color: "#fff", opacity: deleting ? 0.7 : 1 }}
                >
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button type="button" style={palette.secondaryButton} onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </SuperAdminShell>
  );
}
