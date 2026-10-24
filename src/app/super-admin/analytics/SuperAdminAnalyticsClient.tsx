"use client";

import { useEffect, useMemo, useState } from "react";
import { SuperAdminShell } from "@/components/superadmin/SuperAdminShell";
import { getAdminPalette } from "@/components/superadmin/adminStyles";
import { useTheme } from "@/contexts/ThemeContext";
import { useSession } from "@/hooks/useSession";
import { listOrganizations, type Organization } from "@/lib/superAdmin";

function KpiCard({
  label,
  value,
  sub,
  palette,
}: {
  label: string;
  value: string | number;
  sub?: string;
  palette: ReturnType<typeof getAdminPalette>;
}) {
  return (
    <div style={palette.card}>
      <div style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: palette.textMuted }}>
        {label}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 800, color: palette.textPrimary, margin: "6px 0 2px" }}>{value}</div>
      {sub && <div style={{ fontSize: "11.5px", color: palette.textMuted }}>{sub}</div>}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
  palette,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  palette: ReturnType<typeof getAdminPalette>;
}) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: palette.textPrimary }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>{label}</span>
        <span style={{ fontWeight: 700, color: palette.textMuted }}>{value}</span>
      </div>
      <div style={{ height: "7px", borderRadius: "999px", background: palette.dark ? "#0f172a" : "#e2e8f0", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(pct, value > 0 ? 3 : 0)}%`, background: color, borderRadius: "999px" }} />
      </div>
    </div>
  );
}

export function SuperAdminAnalyticsClient() {
  const { user, loading } = useSession("super_admin");
  const { theme } = useTheme();
  const palette = getAdminPalette(theme);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listOrganizations()
      .then(setOrgs)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load analytics."))
      .finally(() => setDataLoading(false));
  }, [user]);

  const totals = useMemo(
    () => ({
      employers: orgs.reduce((n, o) => n + o.employer_count, 0),
      candidates: orgs.reduce((n, o) => n + o.candidate_count, 0),
      jobs: orgs.reduce((n, o) => n + o.job_count, 0),
      active: orgs.filter((o) => o.status === "active").length,
      suspended: orgs.filter((o) => o.status === "suspended").length,
    }),
    [orgs]
  );

  const byCandidates = useMemo(() => [...orgs].sort((a, b) => b.candidate_count - a.candidate_count).slice(0, 8), [orgs]);
  const byEmployers = useMemo(() => [...orgs].sort((a, b) => b.employer_count - a.employer_count).slice(0, 8), [orgs]);
  const maxCandidates = Math.max(1, ...byCandidates.map((o) => o.candidate_count));
  const maxEmployers = Math.max(1, ...byEmployers.map((o) => o.employer_count));

  const avgCandidatesPerOrg = orgs.length === 0 ? 0 : Math.round((totals.candidates / orgs.length) * 10) / 10;

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: palette.textMuted, fontSize: "14px", background: palette.bg }}>
        Loading…
      </div>
    );
  }

  return (
    <SuperAdminShell user={user}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 800, color: palette.textPrimary, margin: 0 }}>Analytics</h1>
        <p style={{ fontSize: "12.5px", color: palette.textMuted, margin: "4px 0 0" }}>
          Cross-organization usage at a glance.
        </p>
      </div>

      {error && (
        <p style={{ fontSize: "13px", color: palette.negative, margin: "0 0 16px" }} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <p style={{ fontSize: "12px", color: palette.textMuted }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            <KpiCard label="Total Organizations" value={orgs.length} sub={`${totals.active} active · ${totals.suspended} suspended`} palette={palette} />
            <KpiCard label="Total Employers" value={totals.employers} palette={palette} />
            <KpiCard label="Total Candidates" value={totals.candidates} sub={`~${avgCandidatesPerOrg} per org`} palette={palette} />
            <KpiCard label="Total Jobs Posted" value={totals.jobs} palette={palette} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            <div style={{ ...palette.card, display: "flex", flexDirection: "column", gap: "14px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: 800, color: palette.textPrimary, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Top Organizations by Candidates
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {byCandidates.length === 0 ? (
                  <p style={{ fontSize: "12px", color: palette.textMuted, margin: 0 }}>No data yet.</p>
                ) : (
                  byCandidates.map((o) => (
                    <BarRow key={o.id} label={o.name} value={o.candidate_count} max={maxCandidates} color={palette.accent} palette={palette} />
                  ))
                )}
              </div>
            </div>

            <div style={{ ...palette.card, display: "flex", flexDirection: "column", gap: "14px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: 800, color: palette.textPrimary, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Top Organizations by Employers
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {byEmployers.length === 0 ? (
                  <p style={{ fontSize: "12px", color: palette.textMuted, margin: 0 }}>No data yet.</p>
                ) : (
                  byEmployers.map((o) => (
                    <BarRow key={o.id} label={o.name} value={o.employer_count} max={maxEmployers} color="#0891b2" palette={palette} />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </SuperAdminShell>
  );
}
