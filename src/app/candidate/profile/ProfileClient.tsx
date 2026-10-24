"use client";

import { useEffect, useState } from "react";
import { CANDIDATE_NAV, DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cardStyle, labelStyle } from "@/components/dashboard/formStyles";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalCandidate } from "@/lib/candidates";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={{ fontSize: "14px", color: "#0f172a", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export function ProfileClient() {
  const { user, loading } = useSession("candidate");
  const [candidate, setCandidate] = useState<PortalCandidate | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyPortal()
      .then((res) => setCandidate(res.candidate))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your profile."))
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
            Profile
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "2px 0 0" }}>
            Your account and pipeline details.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: "13px", color: "#fecaca", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div style={cardStyle}>
          <span
            style={{
              display: "block",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: "16px",
              borderLeft: "3px solid #01617a",
              paddingLeft: "10px",
            }}
          >
            Account
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "18px" }}>
            <Field label="Full Name" value={user.full_name} />
            <Field label="Login Email" value={user.email} />
            <Field label="Email Verified" value={user.is_verified ? "Yes" : "No"} />
          </div>
        </div>

        {!dataLoading && !candidate ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              You&apos;re not in our pipeline yet, so there&apos;s no candidate record to show. Once a
              recruiter adds you, your pipeline details will appear here.
            </p>
          </div>
        ) : (
          candidate && (
            <div style={cardStyle}>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  marginBottom: "16px",
                  borderLeft: "3px solid #01617a",
                  paddingLeft: "10px",
                }}
              >
                Pipeline Details
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "18px" }}>
                <Field label="Name on File" value={candidate.applicant_name} />
                <Field label="Contact Email" value={candidate.applicant_email} />
                <Field label="Phone" value={candidate.phone ?? "—"} />
                <Field label="Source" value={candidate.source ?? "—"} />
                <Field label="Status" value={<StatusBadge status={candidate.status} />} />
              </div>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "18px 0 0" }}>
                Spot something that needs updating? Contact your recruiter &mdash; these details are
                managed by the Nextenti team.
              </p>
            </div>
          )
        )}
      </div>
    </DashboardShell>
  );
}
