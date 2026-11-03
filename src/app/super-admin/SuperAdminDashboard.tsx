"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { CountUp } from "@/components/aurora/CountUp";
import styles from "@/components/aurora/aurora.module.css";
import { useSession } from "@/hooks/useSession";
import { createOrganization, listOrganizations, type Organization } from "@/lib/superAdmin";
import local from "./superAdmin.module.css";

const GRID_COLUMNS = "2.2fr 1fr 1fr 1fr 1fr";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatusChip({ status }: { status: Organization["status"] }) {
  const color = status === "active" ? "#34D399" : "#FB7185";
  return (
    <span className={styles.chip} style={{ color, background: `${color}29`, textTransform: "capitalize" }}>
      <span className={styles.dot} style={{ background: color }} />
      {status}
    </span>
  );
}

function SmallStat({ label, value, foot }: { label: string; value: number; foot: string }) {
  return (
    <div className={`${styles.glass} ${styles.cardSm}`}>
      <div style={{ fontSize: "13px", color: "var(--text-3)" }}>{label}</div>
      <div
        className={styles.display}
        style={{ fontWeight: 700, fontSize: "40px", letterSpacing: "-0.03em", color: "var(--text)", margin: "6px 0 4px" }}
      >
        <CountUp value={value} />
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-4)" }}>{foot}</div>
    </div>
  );
}

export function SuperAdminDashboard() {
  const { user, loading } = useSession("super_admin");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Organization["status"]>("all");

  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function refresh() {
    setDataLoading(true);
    listOrganizations()
      .then(setOrgs)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load organizations."))
      .finally(() => setDataLoading(false));
  }

  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createOrganization({
        name,
        admin_email: adminEmail,
        admin_full_name: adminFullName,
        admin_password: adminPassword,
      });
      setName("");
      setAdminEmail("");
      setAdminFullName("");
      setAdminPassword("");
      setShowCreate(false);
      refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create organization.");
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) return <AuroraLoading />;

  const totalEmployers = orgs.reduce((n, o) => n + o.employer_count, 0);
  const totalCandidates = orgs.reduce((n, o) => n + o.candidate_count, 0);
  const totalJobs = orgs.reduce((n, o) => n + o.job_count, 0);
  const activeCount = orgs.filter((o) => o.status === "active").length;
  const suspendedCount = orgs.filter((o) => o.status === "suspended").length;

  const filteredOrgs = orgs.filter(
    (o) =>
      (statusFilter === "all" || o.status === statusFilter) &&
      o.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <AuroraPageHeader
        eyebrow="Platform"
        title="Organizations"
        subtitle="Every tenant on Krafziel Talent Flow, and the access you have to manage them."
        actions={
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "+ New Organization"}
          </button>
        }
      />

      <div className={local.statRow}>
        <div className={`${local.bigStat} ${styles.lift}`} style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <span style={{ fontWeight: 600 }}>Organizations</span>
          <div>
            <div className={local.bigNum}>
              <CountUp value={orgs.length} />
            </div>
            <div style={{ fontSize: "15px", fontWeight: 500 }}>
              {activeCount} active · {suspendedCount} suspended
            </div>
          </div>
        </div>
        <div className={`${local.bigStat} ${styles.lift}`} style={{ background: "#0066ff", color: "#fff" }}>
          <span style={{ fontWeight: 600 }}>Candidates</span>
          <div>
            <div className={local.bigNum}>
              <CountUp value={totalCandidates} />
            </div>
            <div style={{ fontSize: "15px", fontWeight: 500, color: "#EEE9FF" }}>Across every organization</div>
          </div>
        </div>
        <div className={local.smallStats}>
          <SmallStat label="Active" value={activeCount} foot="Organizations in good standing" />
          <SmallStat label="Employers" value={totalEmployers} foot="Employer logins" />
          <SmallStat label="Jobs" value={totalJobs} foot="Posted in total" />
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className={`${styles.glass} ${styles.card}`}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          <h2 className={styles.display} style={{ fontWeight: 600, fontSize: "18px", margin: 0, color: "var(--text)" }}>
            Create organization &amp; its first employer login
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div className={styles.field}>
              <label className={styles.lbl} htmlFor="org-name">
                Organization Name
              </label>
              <input id="org-name" className={styles.inp} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className={styles.field}>
              <label className={styles.lbl} htmlFor="org-admin-name">
                Admin Full Name
              </label>
              <input id="org-admin-name" className={styles.inp} required value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className={styles.field}>
              <label className={styles.lbl} htmlFor="org-admin-email">
                Admin Email
              </label>
              <input id="org-admin-email" className={styles.inp} type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="jane@acme.com" />
            </div>
            <div className={styles.field}>
              <label className={styles.lbl} htmlFor="org-admin-pw">
                Admin Password
              </label>
              <input id="org-admin-pw" className={styles.inp} type="password" required minLength={8} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
          </div>
          {createError && (
            <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">
              {createError}
            </p>
          )}
          <div>
            <button type="submit" disabled={creating} className={`${styles.btn} ${styles.btnAccent}`}>
              {creating ? "Creating…" : "Create Organization"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <AuroraLoading label="Loading organizations…" />
      ) : (
        <div className={styles.sidebarLayout}>
          <aside className={`${styles.glass} ${styles.sideCard}`}>
            <div className={styles.sideLabel}>Status</div>
            {(
              [
                ["all", "All", orgs.length],
                ["active", "Active", activeCount],
                ["suspended", "Suspended", suspendedCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                className={`${styles.fi} ${statusFilter === value ? styles.fiOn : ""}`}
                onClick={() => setStatusFilter(value)}
              >
                {label}
                <span className={styles.n}>{count}</span>
              </button>
            ))}
          </aside>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
            <div
              className={styles.glass}
              style={{ borderRadius: "28px", padding: "20px 24px", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "16px" }}
            >
              <div className={styles.field} style={{ flex: "1 1 300px" }}>
                <label className={styles.lbl} htmlFor="org-search">
                  Search
                </label>
                <input
                  id="org-search"
                  className={styles.inp}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search organizations…"
                />
              </div>
              <span style={{ fontSize: "13px", color: "var(--text-3)", minHeight: "48px", display: "flex", alignItems: "center" }}>
                {filteredOrgs.length} shown
              </span>
            </div>

            <div className={`${styles.glass} ${styles.tableCard}`}>
              <div className={styles.tableScroll}>
                <div className={styles.th} style={{ gridTemplateColumns: GRID_COLUMNS }}>
                  <span>Organization</span>
                  <span>Status</span>
                  <span>Employers</span>
                  <span>Candidates</span>
                  <span>Jobs</span>
                </div>
                {filteredOrgs.length === 0 ? (
                  <p style={{ fontSize: "14px", color: "var(--text-4)", padding: "24px 28px", margin: 0, borderTop: "1px solid var(--line-soft)" }}>
                    {orgs.length === 0 ? "No organizations yet." : "No organizations match your search."}
                  </p>
                ) : (
                  filteredOrgs.map((org) => (
                    <Link
                      key={org.id}
                      href={`/super-admin/organizations/${org.id}`}
                      className={styles.tr}
                      style={{ gridTemplateColumns: GRID_COLUMNS, color: "inherit", textDecoration: "none" }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                        <span
                          className={styles.display}
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "13px",
                            fontWeight: 700,
                            background: "rgba(0, 102, 255,.25)",
                            color: "#C9BBFF",
                          }}
                        >
                          {org.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span
                            className={styles.display}
                            style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          >
                            {org.name}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-3)" }}>Created {formatDate(org.created_at)}</span>
                        </span>
                      </span>
                      <span>
                        <StatusChip status={org.status} />
                      </span>
                      <span style={{ fontSize: "13px" }}>{org.employer_count}</span>
                      <span style={{ fontSize: "13px" }}>{org.candidate_count}</span>
                      <span style={{ fontSize: "13px" }}>{org.job_count}</span>
                    </Link>
                  ))
                )}
              </div>
              <div className={styles.tableFoot}>
                {filteredOrgs.length} of {orgs.length} organizations
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
