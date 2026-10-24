"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { SuperAdminShell } from "@/components/superadmin/SuperAdminShell";
import { getAdminPalette } from "@/components/superadmin/adminStyles";
import { useTheme } from "@/contexts/ThemeContext";
import { useSession } from "@/hooks/useSession";
import { createOrganization, listOrganizations, type Organization } from "@/lib/superAdmin";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatusPill({ status, palette }: { status: Organization["status"]; palette: ReturnType<typeof getAdminPalette> }) {
  const isActive = status === "active";
  return (
    <span
      style={{
        fontSize: "10.5px",
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: "999px",
        background: isActive ? palette.positiveBg : palette.negativeBg,
        color: isActive ? palette.positive : palette.negative,
        border: `1px solid ${isActive ? palette.positiveBorder : palette.negativeBorder}`,
      }}
    >
      {status}
    </span>
  );
}

function KpiCard({ label, value, palette }: { label: string; value: string | number; palette: ReturnType<typeof getAdminPalette> }) {
  return (
    <div style={palette.card}>
      <div style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: palette.textMuted }}>
        {label}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 800, color: palette.textPrimary, marginTop: "6px" }}>{value}</div>
    </div>
  );
}

export function SuperAdminDashboard() {
  const { user, loading } = useSession("super_admin");
  const { theme } = useTheme();
  const palette = getAdminPalette(theme);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

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

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: palette.textMuted, fontSize: "14px", background: palette.bg }}>
        Loading…
      </div>
    );
  }

  const totalEmployers = orgs.reduce((n, o) => n + o.employer_count, 0);
  const totalCandidates = orgs.reduce((n, o) => n + o.candidate_count, 0);
  const totalJobs = orgs.reduce((n, o) => n + o.job_count, 0);
  const activeCount = orgs.filter((o) => o.status === "active").length;

  const filteredOrgs = orgs.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <SuperAdminShell user={user}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: palette.textPrimary, margin: 0 }}>Organizations</h1>
          <p style={{ fontSize: "12.5px", color: palette.textMuted, margin: "4px 0 0" }}>
            Every tenant on Nextenti Talent Flow, and the access you have to manage them.
          </p>
        </div>
        <button type="button" style={palette.primaryButton} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancel" : "+ New Organization"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <KpiCard label="Organizations" value={orgs.length} palette={palette} />
        <KpiCard label="Active" value={activeCount} palette={palette} />
        <KpiCard label="Employers" value={totalEmployers} palette={palette} />
        <KpiCard label="Candidates" value={totalCandidates} palette={palette} />
        <KpiCard label="Jobs" value={totalJobs} palette={palette} />
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={{ ...palette.card, marginBottom: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 800, color: palette.textPrimary, margin: 0 }}>
            Create organization &amp; its first employer login
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
            <div>
              <label style={palette.label}>Organization Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" style={palette.input} />
            </div>
            <div>
              <label style={palette.label}>Admin Full Name</label>
              <input required value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} placeholder="Jane Doe" style={palette.input} />
            </div>
            <div>
              <label style={palette.label}>Admin Email</label>
              <input type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="jane@acme.com" style={palette.input} />
            </div>
            <div>
              <label style={palette.label}>Admin Password</label>
              <input type="password" required minLength={8} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="At least 8 characters" style={palette.input} />
            </div>
          </div>
          {createError && (
            <p style={{ fontSize: "12px", color: palette.negative, margin: 0 }} role="alert">
              {createError}
            </p>
          )}
          <div>
            <button type="submit" disabled={creating} style={{ ...palette.primaryButton, opacity: creating ? 0.7 : 1 }}>
              {creating ? "Creating…" : "Create Organization"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p style={{ fontSize: "13px", color: palette.negative, margin: "0 0 16px" }} role="alert">
          {error}
        </p>
      )}

      {orgs.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organizations…"
          style={{ ...palette.input, marginBottom: "14px", maxWidth: "320px" }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {dataLoading ? (
          <p style={{ fontSize: "12px", color: palette.textMuted }}>Loading…</p>
        ) : filteredOrgs.length === 0 ? (
          <div style={{ ...palette.card, textAlign: "center", padding: "40px" }}>
            <p style={{ fontSize: "13px", color: palette.textMuted, margin: 0 }}>
              {orgs.length === 0 ? "No organizations yet." : "No organizations match your search."}
            </p>
          </div>
        ) : (
          filteredOrgs.map((org) => (
            <Link
              key={org.id}
              href={`/super-admin/organizations/${org.id}`}
              style={{
                ...palette.card,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.15s ease",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14.5px", fontWeight: 800, color: palette.textPrimary }}>{org.name}</span>
                  <StatusPill status={org.status} palette={palette} />
                </div>
                <div style={{ fontSize: "11.5px", color: palette.textMuted }}>Created {formatDate(org.created_at)}</div>
              </div>
              <div style={{ display: "flex", gap: "20px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: palette.textPrimary }}>{org.employer_count}</div>
                  <div style={{ fontSize: "10px", color: palette.textMuted, textTransform: "uppercase" }}>Employers</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: palette.textPrimary }}>{org.candidate_count}</div>
                  <div style={{ fontSize: "10px", color: palette.textMuted, textTransform: "uppercase" }}>Candidates</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: palette.textPrimary }}>{org.job_count}</div>
                  <div style={{ fontSize: "10px", color: palette.textMuted, textTransform: "uppercase" }}>Jobs</div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </SuperAdminShell>
  );
}
