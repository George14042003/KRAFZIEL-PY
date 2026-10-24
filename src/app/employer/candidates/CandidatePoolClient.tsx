"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useSession } from "@/hooks/useSession";
import { listCandidates, type Candidate, type CandidateStatus } from "@/lib/candidates";
import { downloadCsv } from "@/lib/exportCsv";

const SOURCE_COLORS = ["#dc2626", "#ea580c", "#7c3aed", "#0d9488", "#4338ca", "#059669", "#be185d", "#0f172a"];

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
          color: "var(--text-secondary)",
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
    <DashboardShell user={user} fitToScreen>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
          Dashboard <span style={{ color: "var(--text-faint)" }}>/</span> Candidate Pool
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
              Candidate Pool
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              {candidates.length} candidates · shared across your whole team
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handleExport}
              disabled={candidates.length === 0}
              style={{
                padding: "9px 16px",
                background: "#fff",
                color: "#334155",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: candidates.length === 0 ? "default" : "pointer",
                opacity: candidates.length === 0 ? 0.6 : 1,
              }}
            >
              ↓ Export
            </button>
            <Link
              href="/employer/candidates/new"
              style={{
                padding: "9px 16px",
                background: "#01617a",
                color: "#fff",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "13px",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              + Add Candidate
            </Link>
          </div>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        {dataLoading ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Loading candidates…</div>
        ) : candidates.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>No candidates yet</span>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0, maxWidth: "360px" }}>
              Add a candidate sourced from your ATS, referrals, or LinkedIn to start scheduling interviews.
            </p>
            <Link
              href="/employer/candidates/new"
              style={{
                marginTop: "8px",
                padding: "10px 18px",
                background: "#01617a",
                color: "#fff",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              + Add Candidate
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0 }}>
            <aside
              style={{
                width: "220px",
                flexShrink: 0,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                overflowY: "auto",
              }}
            >
              <div>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", color: "#94a3b8" }}>
                  SOURCES
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <button
                  type="button"
                  onClick={() => setSourceFilter("all")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "none",
                    background: sourceFilter === "all" ? "#e0f2fe" : "transparent",
                    color: sourceFilter === "all" ? "#01617a" : "#334155",
                    fontWeight: sourceFilter === "all" ? 700 : 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  All
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: sourceFilter === "all" ? "#bae6fd" : "#f1f5f9",
                      color: sourceFilter === "all" ? "#014a5e" : "#64748b",
                      borderRadius: "999px",
                      padding: "1px 8px",
                    }}
                  >
                    {candidates.length}
                  </span>
                </button>
                {sources.map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSourceFilter(name)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: sourceFilter === name ? "#e0f2fe" : "transparent",
                      color: sourceFilter === name ? "#01617a" : "#334155",
                      fontWeight: sourceFilter === name ? 700 : 500,
                      fontSize: "13px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {name}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        background: sourceFilter === name ? "#bae6fd" : "#f1f5f9",
                        color: sourceFilter === name ? "#014a5e" : "#64748b",
                        borderRadius: "999px",
                        padding: "1px 8px",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>Search</label>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, ID, email..."
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as CandidateStatus | "all")}
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    {STATUS_FILTERS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span style={{ fontSize: "12px", color: "#94a3b8", paddingBottom: "9px" }}>
                  {filteredCandidates.length} shown
                </span>
              </div>

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.2fr 1fr 1fr 0.8fr 0.8fr 1fr",
                    gap: "8px",
                    padding: "12px 18px",
                    borderBottom: "1px solid #e2e8f0",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    color: "#94a3b8",
                  }}
                >
                  <span>CANDIDATE</span>
                  <span>ID</span>
                  <span>SOURCE</span>
                  <span>INTERVIEWS</span>
                  <span>OFFERS</span>
                  <span>STATUS</span>
                </div>

                <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                  {filteredCandidates.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#94a3b8", padding: "24px 18px" }}>
                      No candidates match these filters.
                    </p>
                  ) : (
                    filteredCandidates.map((candidate) => {
                      const sourceKey = candidate.source?.trim() || "Unspecified";
                      const color = sourceColor(sourceKey);
                      return (
                        <Link
                          key={candidate.id}
                          href={`/employer/candidates/${candidate.id}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "2.2fr 1fr 1fr 0.8fr 0.8fr 1fr",
                            alignItems: "center",
                            gap: "8px",
                            padding: "12px 18px",
                            borderBottom: "1px solid #f1f5f9",
                            textDecoration: "none",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            <span
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                fontWeight: 800,
                                background: `${color}1a`,
                                color,
                              }}
                            >
                              {initialsFor(candidate.applicant_name)}
                            </span>
                            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  color: "#0f172a",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {candidate.applicant_name}
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#94a3b8",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {candidate.applicant_email}
                              </span>
                            </span>
                          </span>
                          <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#64748b" }}>
                            {shortId(candidate.id)}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#334155" }}>
                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                            {sourceKey}
                          </span>
                          <span style={{ fontSize: "12px", color: "#334155" }}>{candidate.interview_count}</span>
                          <span style={{ fontSize: "12px", color: "#334155" }}>{candidate.offer_count}</span>
                          <span>
                            <StatusBadge status={candidate.status} />
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>

                <div style={{ padding: "10px 18px", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {filteredCandidates.length} of {candidates.length} candidates
                    {sourceFilter !== "all" ? ` · ${sourceFilter}` : ""}
                    {statusFilter !== "all" ? ` · ${filterLabel}` : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
