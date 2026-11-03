"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { CountUp } from "@/components/aurora/CountUp";
import styles from "@/components/aurora/aurora.module.css";
import { useSession } from "@/hooks/useSession";
import {
  deleteOrganization,
  getOrganization,
  updateOrganization,
  type Organization,
} from "@/lib/superAdmin";
import local from "../../superAdmin.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function OrganizationDetailClient({ orgId }: { orgId: string }) {
  const { user, loading } = useSession("super_admin");
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

  if (loading || !user) return <AuroraLoading />;

  const statusColor = org?.status === "active" ? "#34D399" : "#FB7185";

  return (
    <>
      <Link href="/super-admin" style={{ fontSize: "13px", color: "var(--text-3)", textDecoration: "none", alignSelf: "flex-start" }}>
        ← All organizations
      </Link>

      {error && (
        <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <AuroraLoading label="Loading organization…" />
      ) : org ? (
        <>
          <AuroraPageHeader
            eyebrow="Organization"
            title={org.name}
            subtitle={
              <>
                Created {formatDate(org.created_at)} ·{" "}
                <span className={styles.chip} style={{ color: statusColor, background: `${statusColor}29`, textTransform: "capitalize" }}>
                  <span className={styles.dot} style={{ background: statusColor }} />
                  {org.status}
                </span>
              </>
            }
            actions={
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={toggling}
                className={`${styles.btn} ${org.status === "active" ? styles.btnDanger : styles.btnAccent}`}
              >
                {toggling ? "Working…" : org.status === "active" ? "Suspend Organization" : "Reactivate Organization"}
              </button>
            }
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
            {(
              [
                ["Employers", org.employer_count, "accent"],
                ["Candidates", org.candidate_count, "violet"],
                ["Jobs", org.job_count, "glass"],
              ] as const
            ).map(([label, value, kind]) => (
              <div
                key={label}
                className={`${kind === "glass" ? styles.glass : ""} ${styles.lift}`}
                style={{
                  borderRadius: "28px",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  background: kind === "accent" ? "var(--accent)" : kind === "violet" ? "#0066ff" : undefined,
                  color: kind === "accent" ? "var(--on-accent)" : kind === "violet" ? "#fff" : "var(--text)",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.75 }}>
                  {label}
                </div>
                <div className={styles.display} style={{ fontWeight: 800, fontSize: "56px", lineHeight: 1, letterSpacing: "-0.04em" }}>
                  <CountUp value={value} />
                </div>
              </div>
            ))}
          </div>

          <div className={local.cols2}>
            <div className={`${styles.glass} ${styles.card}`} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 className={styles.display} style={{ fontWeight: 600, fontSize: "18px", margin: 0, color: "var(--text)" }}>
                Rename Organization
              </h2>
              <div className={styles.field}>
                <label className={styles.lbl} htmlFor="org-rename">
                  Organization Name
                </label>
                <input id="org-rename" className={styles.inp} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {saveError && (
                <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">
                  {saveError}
                </p>
              )}
              <div>
                <button
                  type="button"
                  onClick={handleRename}
                  disabled={saving || name.trim() === org.name || !name.trim()}
                  className={`${styles.btn} ${styles.btnAccent}`}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <div
              className={`${styles.glass} ${styles.card}`}
              style={{ display: "flex", flexDirection: "column", gap: "16px", borderColor: "rgba(251,113,133,.4)" }}
            >
              <h2 className={styles.display} style={{ fontWeight: 600, fontSize: "18px", margin: 0, color: "#FB7185" }}>
                Danger Zone
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-3)", margin: 0, lineHeight: 1.55 }}>
                Permanently deletes this organization and every employer, candidate, job, interview, and offer that
                belongs to it. This cannot be undone.
              </p>
              {!confirmingDelete ? (
                <div>
                  <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setConfirmingDelete(true)}>
                    Delete Organization
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", color: "#FB7185", fontWeight: 700 }}>Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className={`${styles.btn} ${styles.btnDanger}`}
                    style={{ background: "#FB7185", color: "#1a0509" }}
                  >
                    {deleting ? "Deleting…" : "Yes, delete everything"}
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnGlass}`} onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
