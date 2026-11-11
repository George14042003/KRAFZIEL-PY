"use client";

import { useEffect, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalCandidate } from "@/lib/candidates";
import s from "../candidate.module.css";
import { StatusChip } from "../ui";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className={aurora.lbl}>{label}</span>
      <div className={s.fVal}>{value}</div>
    </div>
  );
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
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

  if (loading || !user) return <AuroraLoading />;

  return (
    <>
      <AuroraPageHeader eyebrow="Account" title="Profile" subtitle="Your account and pipeline details." />

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      <div className={aurora.two}>
        <section className={`${aurora.glass} ${aurora.card}`}>
          <div className={s.profHead}>
            <span className={s.avatar}>{initialsFor(user.full_name)}</span>
            <h2>Account</h2>
          </div>
          <div className={s.fields}>
            <Field label="Full Name" value={user.full_name} />
            <Field label="Login Email" value={user.email} />
            <Field label="Email Verified" value={user.is_verified ? "Yes" : "No"} />
          </div>
        </section>

        {!dataLoading && !candidate ? (
          <section className={`${aurora.glass} ${aurora.card} ${s.emptyCard}`}>
            <span className={s.emptyTitle}>Not in the pipeline yet</span>
            <p className={s.emptyText}>
              You&apos;re not in our pipeline yet, so there&apos;s no candidate record to show. Once a
              recruiter adds you, your pipeline details will appear here.
            </p>
          </section>
        ) : (
          candidate && (
            <section className={`${aurora.glass} ${aurora.card}`}>
              <div className={s.profHead}>
                <h2>Pipeline Details</h2>
              </div>
              <div className={s.fields}>
                <Field label="Name on File" value={candidate.applicant_name} />
                <Field label="Contact Email" value={candidate.applicant_email} />
                <Field label="Phone" value={candidate.phone ?? "—"} />
                <Field label="Source" value={candidate.source ?? "—"} />
                <Field label="Status" value={<StatusChip status={candidate.status} />} />
              </div>
              <p className={s.note}>
                Spot something that needs updating? Contact your recruiter &mdash; these details are
                managed by the Elzuron team.
              </p>
            </section>
          )
        )}
      </div>
    </>
  );
}
