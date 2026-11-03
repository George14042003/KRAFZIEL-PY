"use client";

import { useEffect, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalOffer } from "@/lib/candidates";
import s from "../candidate.module.css";
import { StatusChip } from "../ui";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatSalary(salary: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(salary);
  } catch {
    return `${currency} ${salary.toLocaleString()}`;
  }
}

export function OffersClient() {
  const { user, loading } = useSession("candidate");
  const [offers, setOffers] = useState<PortalOffer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyPortal()
      .then((res) => setOffers(res.candidate?.offers ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your offers."))
      .finally(() => setDataLoading(false));
  }, [user]);

  if (loading || !user) return <AuroraLoading />;

  return (
    <>
      <AuroraPageHeader
        eyebrow="Offers"
        title="My Offers"
        subtitle={dataLoading ? "Any offers extended to you will appear here." : `${offers.length} offers extended to you`}
      />

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {dataLoading ? (
        <p className={s.muted}>Loading…</p>
      ) : offers.length === 0 ? (
        <div className={`${aurora.glass} ${aurora.card} ${s.emptyCard}`}>
          <span className={s.emptyTitle}>No offers yet</span>
          <p className={s.emptyText}>Any offers extended to you will appear here.</p>
        </div>
      ) : (
        <div className={s.offerGrid}>
          {offers.map((offer) => (
            <div key={offer.id} className={`${aurora.glass} ${aurora.card} ${aurora.lift} ${s.offer}`}>
              <div className={s.cardHead}>
                <StatusChip status={offer.status} />
              </div>
              <div className={s.offerSalary}>{formatSalary(offer.salary, offer.currency)}</div>
              <div className={s.kv}>
                <span>Start date</span>
                <b>{offer.start_date ? formatDate(offer.start_date) : "To be confirmed"}</b>
              </div>
              {offer.expires_at && (
                <div className={s.kv}>
                  <span>Expires</span>
                  <b>{formatDate(offer.expires_at)}</b>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
