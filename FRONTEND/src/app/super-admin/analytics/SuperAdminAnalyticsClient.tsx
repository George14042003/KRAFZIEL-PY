"use client";

import { useEffect, useMemo, useState } from "react";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { CountUp } from "@/components/aurora/CountUp";
import styles from "@/components/aurora/aurora.module.css";
import { useSession } from "@/hooks/useSession";
import { listOrganizations, type Organization } from "@/lib/superAdmin";
import local from "../superAdmin.module.css";

function KpiCard({
  label,
  value,
  sub,
  accent,
  violet,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
  violet?: boolean;
}) {
  const solid = accent || violet;
  return (
    <div
      className={`${solid ? "" : styles.glass} ${styles.lift}`}
      style={{
        borderRadius: "28px",
        padding: "24px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "14px",
        minWidth: 0,
        background: accent ? "var(--accent)" : violet ? "#0066ff" : undefined,
        color: accent ? "var(--on-accent)" : violet ? "#fff" : undefined,
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          opacity: solid ? 0.75 : 1,
          color: solid ? undefined : "var(--text-4)",
        }}
      >
        {label}
      </div>
      <div className={styles.display} style={{ fontWeight: 800, fontSize: "56px", lineHeight: 1, letterSpacing: "-0.04em", color: solid ? undefined : "var(--text)" }}>
        <CountUp value={value} />
      </div>
      {sub && <div style={{ fontSize: "13px", color: solid ? undefined : "var(--text-3)", opacity: solid ? 0.85 : 1 }}>{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "14px", gap: "12px" }}>
        <span style={{ fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {label}
        </span>
        <b className={styles.display} style={{ fontSize: "17px", color: "var(--text)" }}>
          {value}
        </b>
      </div>
      <div className={styles.bar}>
        <i style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%`, background: color }} />
      </div>
    </div>
  );
}

function RankCard({ title, rows, color }: { title: string; rows: { id: string; name: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={`${styles.glass} ${styles.card}`} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <h2 className={styles.display} style={{ fontWeight: 600, fontSize: "18px", margin: 0, color: "var(--text)" }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {rows.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--text-3)", margin: 0 }}>No data yet.</p>
        ) : (
          rows.map((r, i) => <BarRow key={r.id} label={r.name} value={r.value} max={max} color={i === 0 ? "var(--accent)" : color} />)
        )}
      </div>
    </div>
  );
}

export function SuperAdminAnalyticsClient() {
  const { user, loading } = useSession("super_admin");
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

  const avgCandidatesPerOrg = orgs.length === 0 ? 0 : Math.round((totals.candidates / orgs.length) * 10) / 10;

  if (loading || !user) return <AuroraLoading />;

  return (
    <>
      <AuroraPageHeader eyebrow="Platform" title="Analytics" subtitle="Cross-organization usage at a glance." />

      {error && (
        <p style={{ fontSize: "13px", color: "#FB7185", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <AuroraLoading label="Crunching the numbers…" />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <KpiCard accent label="Total Organizations" value={orgs.length} sub={`${totals.active} active · ${totals.suspended} suspended`} />
            <KpiCard violet label="Total Candidates" value={totals.candidates} sub={`~${avgCandidatesPerOrg} per org`} />
            <KpiCard label="Total Employers" value={totals.employers} sub="Employer logins" />
            <KpiCard label="Total Jobs Posted" value={totals.jobs} sub="Across all organizations" />
          </div>

          <div className={local.cols2}>
            <RankCard
              title="Top Organizations by Candidates"
              color="#C9CDE0"
              rows={byCandidates.map((o) => ({ id: o.id, name: o.name, value: o.candidate_count }))}
            />
            <RankCard
              title="Top Organizations by Employers"
              color="#C9CDE0"
              rows={byEmployers.map((o) => ({ id: o.id, name: o.name, value: o.employer_count }))}
            />
          </div>
        </>
      )}
    </>
  );
}
