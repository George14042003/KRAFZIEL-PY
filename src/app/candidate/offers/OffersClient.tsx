"use client";

import { useEffect, useState } from "react";
import { CANDIDATE_NAV, DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cardStyle } from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalOffer } from "@/lib/candidates";

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

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  return (
    <DashboardShell user={user} nav={CANDIDATE_NAV}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
            My Offers
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>
            Any offers extended to you will appear here.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div style={cardStyle}>
          {dataLoading ? (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Loading…</p>
          ) : offers.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No offers yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                    padding: "16px 18px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                        {formatSalary(offer.salary, offer.currency)}
                      </span>
                      <StatusBadge status={offer.status} />
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {offer.start_date ? `Start date: ${formatDate(offer.start_date)}` : "Start date to be confirmed"}
                      {offer.expires_at ? ` · Expires ${formatDate(offer.expires_at)}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
