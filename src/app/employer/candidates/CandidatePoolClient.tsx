"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useSession } from "@/hooks/useSession";
import { listCandidates, type Candidate, type CandidateStatus } from "@/lib/candidates";
import { downloadCsv } from "@/lib/exportCsv";

const SOURCE_COLORS = ["#00B4FF"];

const STATUS_COLORS: Record<string, string> = {
  pending: "#0080B8",
  reviewed: "#0052CC",
  interviewing: "#0F172A",
  offered: "#3B4147",
  hired: "#007C8A",
  rejected: "#D7173E",
};

const GRID_COLUMNS = "2.4fr 1.2fr 1.3fr .9fr .8fr 1fr";

function sourceColor(source: string): string {
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  return SOURCE_COLORS[hash % SOURCE_COLORS.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function shortId(id: string): string {
  return `CND-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

const STATUS_FILTERS: { value: CandidateStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offered", label: "Offered" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

const ellipsis = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;

export function CandidatePoolClient() {
  const { user, loading } = useSession("employer");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    listCandidates()
      .then(setCandidates)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load candidates."))
      .finally(() => setDataLoading(false));
  }, [user]);

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      const key = c.source?.trim() || "Unspecified";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      const sourceKey = c.source?.trim() || "Unspecified";
      if (sourceFilter !== "all" && sourceKey !== sourceFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.applicant_name.toLowerCase().includes(q) ||
        c.applicant_email.toLowerCase().includes(q) ||
        shortId(c.id).toLowerCase().includes(q)
      );
    });
  }, [candidates, search, statusFilter, sourceFilter]);

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text-3)",
          fontSize: "14px",
        }}
      >
        Loading…
      </div>
    );
  }

  function handleExport() {
    downloadCsv(
      `candidate-pool-${new Date().toISOString().slice(0, 10)}.csv`,
      candidates.map((c) => ({
        name: c.applicant_name,
        email: c.applicant_email,
        phone: c.phone ?? "",
        source: c.source ?? "",
        status: c.status,
        interviews: c.interview_count,
        offers: c.offer_count,
        added_by: c.created_by_name ?? "",
        added_on: c.created_at.slice(0, 10),
      }))
    );
  }

  const filterLabel = STATUS_FILTERS.find((s) => s.value === statusFilter)?.label ?? "All";

  return (
    <DashboardShell user={user}>
      <AuroraPageHeader
        eyebrow="Talent"
        title="Candidate Pool"
        subtitle={`${candidates.length} candidates · shared across your whole team`}
        actions={
          <>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGlass}`}
              onClick={handleExport}
              disabled={candidates.length === 0}
            >
              ↓ Export
            </button>
            <Link href="/employer/candidates/new" className={`${styles.btn} ${styles.btnAccent}`}>
              + Add Candidate
            </Link>
          </>
        }
      />

      {error && (
        <p style={{ fontSize: "13px", color: "#C4123A", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <div style={{ color: "var(--text-3)", fontSize: "14px" }}>Loading candidates…</div>
      ) : candidates.length === 0 ? (
        <div
          className={`${styles.glass} ${styles.card}`}
          style={{
            padding: "56px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span className={styles.display} style={{ fontSize: "20px", fontWeight: 700 }}>
            No candidates yet
          </span>
          <p style={{ fontSize: "14px", color: "var(--text-3)", margin: 0, maxWidth: "380px" }}>
            Add a candidate sourced from your ATS, referrals, or LinkedIn to start scheduling interviews.
          </p>
          <Link
            href="/employer/candidates/new"
            className={`${styles.btn} ${styles.btnAccent}`}
            style={{ marginTop: "8px" }}
          >
            + Add Candidate
          </Link>
        </div>
      ) : (
        <div className={styles.sidebarLayout}>
          <aside className={`${styles.glass} ${styles.sideCard}`}>
            <span className={styles.sideLabel}>Sources</span>
            <button
              type="button"
              className={`${styles.fi} ${sourceFilter === "all" ? styles.fiOn : ""}`}
              onClick={() => setSourceFilter("all")}
            >
              All
              <span className={styles.n}>{candidates.length}</span>
            </button>
            {sources.map(([name, count]) => (
              <button
                key={name}
                type="button"
                className={`${styles.fi} ${sourceFilter === name ? styles.fiOn : ""}`}
                onClick={() => setSourceFilter(name)}
              >
                <span style={{ ...ellipsis, minWidth: 0 }}>{name}</span>
                <span className={styles.n}>{count}</span>
              </button>
            ))}
          </aside>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
            <div
              className={styles.glass}
              style={{
                borderRadius: "28px",
                padding: "20px 24px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "16px",
              }}
            >
              <div className={styles.field} style={{ flex: "1 1 300px" }}>
                <label className={styles.lbl} htmlFor="candidate-search">
                  Search
                </label>
                <input
                  id="candidate-search"
                  className={styles.inp}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, ID, email…"
                />
              </div>
              <div className={styles.field} style={{ flex: "0 0 180px" }}>
                <label className={styles.lbl} htmlFor="candidate-status">
                  Status
                </label>
                <select
                  id="candidate-status"
                  className={styles.inp}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as CandidateStatus | "all")}
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <span style={{ fontSize: "13px", color: "var(--text-3)", minHeight: "48px", display: "flex", alignItems: "center" }}>
                {filteredCandidates.length} shown
              </span>
            </div>

            <div className={`${styles.glass} ${styles.tableCard}`}>
              <div className={styles.tableScroll}>
                <div className={styles.th} style={{ gridTemplateColumns: GRID_COLUMNS }}>
                  <span>Candidate</span>
                  <span>ID</span>
                  <span>Source</span>
                  <span>Interviews</span>
                  <span>Offers</span>
                  <span>Status</span>
                </div>

                {filteredCandidates.length === 0 ? (
                  <p style={{ fontSize: "14px", color: "var(--text-4)", padding: "24px 28px", margin: 0, borderTop: "1px solid var(--line-soft)" }}>
                    No candidates match these filters.
                  </p>
                ) : (
                  filteredCandidates.map((candidate) => {
                    const sourceKey = candidate.source?.trim() || "Unspecified";
                    const color = sourceColor(sourceKey);
                    const statusColor = STATUS_COLORS[candidate.status] ?? "#6B7280";
                    const statusLabel =
                      STATUS_FILTERS.find((s) => s.value === candidate.status)?.label ?? candidate.status;
                    return (
                      <Link
                        key={candidate.id}
                        href={`/employer/candidates/${candidate.id}`}
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
                              background: `${statusColor}22`,
                              color: statusColor,
                            }}
                          >
                            {initialsFor(candidate.applicant_name)}
                          </span>
                          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <span className={styles.display} style={{ fontWeight: 600, fontSize: "14px", ...ellipsis }}>
                              {candidate.applicant_name}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--text-3)", ...ellipsis }}>
                              {candidate.applicant_email}
                            </span>
                          </span>
                        </span>
                        <span style={{ fontSize: "12.5px", fontFamily: "ui-monospace, Menlo, Consolas, monospace", color: "var(--text-3)" }}>
                          {shortId(candidate.id)}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", minWidth: 0 }}>
                          <span className={styles.dot} style={{ background: color }} />
                          <span style={ellipsis}>{sourceKey}</span>
                        </span>
                        <span style={{ fontSize: "13px" }}>{candidate.interview_count}</span>
                        <span style={{ fontSize: "13px" }}>{candidate.offer_count}</span>
                        <span>
                          <span className={styles.chip} style={{ color: statusColor, background: `${statusColor}29` }}>
                            <span className={styles.dot} style={{ background: statusColor }} />
                            {statusLabel}
                          </span>
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>

              <div className={styles.tableFoot}>
                {filteredCandidates.length} of {candidates.length} candidates
                {sourceFilter !== "all" ? ` · ${sourceFilter}` : ""}
                {statusFilter !== "all" ? ` · ${filterLabel}` : ""}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
