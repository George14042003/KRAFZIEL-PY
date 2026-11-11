"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import aurora from "@/components/aurora/aurora.module.css";
import local from "./offers.module.css";
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

const COLS = "1.6fr 1.2fr 1.2fr 1.2fr 1.2fr 1.3fr";

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
    return <div className={local.fullLoading}>Loading…</div>;
  }

  async function handleStatusChange(offer: Offer, status: OfferStatus) {
    const updated = await updateOffer(offer.id, { status });
    setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  return (
    <DashboardShell user={user}>
      <AuroraPageHeader
        eyebrow="Offers"
        title="Offers"
        subtitle={`${offers.length} offers extended · across your whole team`}
        actions={
          !showForm ? (
            <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} onClick={() => setShowForm(true)}>
              + Extend Offer
            </button>
          ) : undefined
        }
      />

      {error && (
        <p className={local.error} role="alert">
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
        <div className={local.loading}>Loading offers…</div>
      ) : offers.length === 0 ? (
        <div className={`${aurora.glass} ${local.emptyCard}`}>
          <span className={local.emptyTitle}>No offers yet</span>
          <p className={local.emptyText}>Extend an offer to any candidate in your pool to see it show up here.</p>
        </div>
      ) : (
        <div className={aurora.sidebarLayout}>
          <aside className={`${aurora.glass} ${aurora.sideCard}`}>
            <span className={aurora.sideLabel}>Status</span>
            {STATUS_FILTERS.map((s) => {
              const count = s.value === "all" ? offers.length : statusCounts.get(s.value) ?? 0;
              const isActive = statusFilter === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatusFilter(s.value)}
                  className={`${aurora.fi} ${isActive ? aurora.fiOn : ""}`}
                >
                  {s.label}
                  <span className={aurora.n}>{count}</span>
                </button>
              );
            })}
          </aside>

          <div className={`${aurora.glass} ${aurora.tableCard}`}>
            <div className={aurora.tableScroll}>
              <div className={aurora.th} style={{ gridTemplateColumns: COLS }}>
                <span>Candidate</span>
                <span>Salary</span>
                <span>Start date</span>
                <span>Expires</span>
                <span>Extended</span>
                <span>Status</span>
              </div>

              {filteredOffers.length === 0 ? (
                <p className={local.empty}>No offers match this filter.</p>
              ) : (
                filteredOffers.map((offer) => {
                  const candidate = candidateMap.get(offer.candidate_id);
                  return (
                    <div key={offer.id} className={aurora.tr} style={{ gridTemplateColumns: COLS }}>
                      <Link href={`/employer/candidates/${offer.candidate_id}`} className={local.cand}>
                        {candidate?.applicant_name ?? "Unknown candidate"}
                      </Link>
                      <span className={local.salary}>{formatSalary(offer.salary, offer.currency)}</span>
                      <span className={local.cell}>{formatDate(offer.start_date)}</span>
                      <span className={local.cell}>{formatDate(offer.expires_at)}</span>
                      <span className={local.cell}>{formatDate(offer.created_at)}</span>
                      <span className={local.selectWrap}>
                        <select
                          className={`${aurora.chip} ${aurora.chipSelect}`}
                          value={offer.status}
                          onChange={(e) => handleStatusChange(offer, e.target.value as OfferStatus)}
                          aria-label="Offer status"
                        >
                          {STATUS_FILTERS.filter((s) => s.value !== "all").map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <svg
                          className={local.chev}
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          aria-hidden="true"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
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
    <form onSubmit={handleSubmit} className={`${aurora.glass} ${local.formCard}`}>
      <div className={local.grid3}>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Candidate</label>
          <select className={aurora.inp} value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            {candidates.length === 0 && <option value="">No candidates yet</option>}
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.applicant_name}
              </option>
            ))}
          </select>
        </div>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Salary</label>
          <input
            className={aurora.inp}
            required
            type="number"
            min={0}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="95000"
          />
        </div>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Currency</label>
          <input className={aurora.inp} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </div>
      </div>
      <div className={local.grid2}>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Start Date (optional)</label>
          <input className={aurora.inp} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className={aurora.field}>
          <label className={aurora.lbl}>Expires On (optional)</label>
          <input className={aurora.inp} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </div>
      <div className={aurora.field}>
        <label className={aurora.lbl}>Notes (optional)</label>
        <input className={aurora.inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && (
        <p className={local.error} role="alert">
          {error}
        </p>
      )}

      <div className={local.actions}>
        <button type="button" className={`${aurora.btn} ${aurora.btnGlass}`} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting || !candidateId} className={`${aurora.btn} ${aurora.btnAccent}`}>
          {submitting ? "Extending…" : "Extend Offer"}
        </button>
      </div>
    </form>
  );
}
