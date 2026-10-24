"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  cardStyle,
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import {
  createOffer,
  listAllOffers,
  listCandidates,
  updateOffer,
  type Candidate,
  type Offer,
  type OfferStatus,
} from "@/lib/candidates";

const STATUS_FILTERS: { value: OfferStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatSalary(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

export function OffersClient() {
  const { user, loading } = useSession("employer");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OfferStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCandidates(), listAllOffers()])
      .then(([candidatesData, offersData]) => {
        setCandidates(candidatesData);
        setOffers(offersData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load offers."))
      .finally(() => setDataLoading(false));
  }, [user]);

  const candidateMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  const statusCounts = useMemo(() => {
    const counts = new Map<OfferStatus, number>();
    for (const o of offers) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return counts;
  }, [offers]);

  const filteredOffers = useMemo(() => {
    return offers
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [offers, statusFilter]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  async function handleStatusChange(offer: Offer, status: OfferStatus) {
    const updated = await updateOffer(offer.id, { status });
    setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  return (
    <DashboardShell user={user} fitToScreen>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
          Dashboard <span style={{ color: "var(--text-faint)" }}>/</span> Offers
        </p>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
              Offers
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              {offers.length} offers extended · across your whole team
            </p>
          </div>
          {!showForm && (
            <button type="button" style={primaryButtonStyle} onClick={() => setShowForm(true)}>
              + Extend Offer
            </button>
          )}
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        {showForm && (
          <ExtendOfferForm
            candidates={candidates}
            onCreated={(offer) => {
              setOffers((prev) => [offer, ...prev]);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {dataLoading ? (
          <div style={{ color: "#94a3b8", fontSize: "13px" }}>Loading offers…</div>
        ) : offers.length === 0 ? (
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
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>No offers yet</span>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0, maxWidth: "360px" }}>
              Extend an offer to any candidate in your pool to see it show up here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0 }}>
            <aside
              style={{
                width: "200px",
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
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", color: "#94a3b8" }}>
                STATUS
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {STATUS_FILTERS.map((s) => {
                  const count = s.value === "all" ? offers.length : statusCounts.get(s.value) ?? 0;
                  const isActive = statusFilter === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStatusFilter(s.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "none",
                        background: isActive ? "#e0f2fe" : "transparent",
                        color: isActive ? "#01617a" : "#334155",
                        fontWeight: isActive ? 700 : 500,
                        fontSize: "13px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {s.label}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          background: isActive ? "#bae6fd" : "#f1f5f9",
                          color: isActive ? "#014a5e" : "#64748b",
                          borderRadius: "999px",
                          padding: "1px 8px",
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div
              style={{
                flex: 1,
                minWidth: 0,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.9fr",
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
                <span>SALARY</span>
                <span>START DATE</span>
                <span>EXPIRES</span>
                <span>EXTENDED</span>
                <span>STATUS</span>
              </div>

              <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                {filteredOffers.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#94a3b8", padding: "24px 18px" }}>
                    No offers match this filter.
                  </p>
                ) : (
                  filteredOffers.map((offer) => {
                    const candidate = candidateMap.get(offer.candidate_id);
                    return (
                      <div
                        key={offer.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.9fr",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 18px",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <Link
                          href={`/employer/candidates/${offer.candidate_id}`}
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#0f172a",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {candidate?.applicant_name ?? "Unknown candidate"}
                        </Link>
                        <span style={{ fontSize: "12px", color: "#334155" }}>
                          {formatSalary(offer.salary, offer.currency)}
                        </span>
                        <span style={{ fontSize: "12px", color: "#334155" }}>{formatDate(offer.start_date)}</span>
                        <span style={{ fontSize: "12px", color: "#334155" }}>{formatDate(offer.expires_at)}</span>
                        <span style={{ fontSize: "12px", color: "#334155" }}>{formatDate(offer.created_at)}</span>
                        <select
                          value={offer.status}
                          onChange={(e) => handleStatusChange(offer, e.target.value as OfferStatus)}
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "5px 8px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            color: "#334155",
                            background: "#fff",
                            width: "fit-content",
                          }}
                        >
                          {STATUS_FILTERS.filter((s) => s.value !== "all").map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function ExtendOfferForm({
  candidates,
  onCreated,
  onCancel,
}: {
  candidates: Candidate[];
  onCreated: (offer: Offer) => void;
  onCancel: () => void;
}) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [salary, setSalary] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!candidateId) {
      setError("Choose a candidate first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const offer = await createOffer(candidateId, {
        salary: Number(salary),
        currency,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        notes: notes || undefined,
      });
      onCreated(offer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extend the offer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Candidate</label>
          <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} style={inputStyle}>
            {candidates.length === 0 && <option value="">No candidates yet</option>}
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.applicant_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Salary</label>
          <input
            required
            type="number"
            min={0}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="95000"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Start Date (optional)</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Expires On (optional)</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
      </div>

      {error && (
        <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting || !candidateId} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Extending…" : "Extend Offer"}
        </button>
      </div>
    </form>
  );
}
