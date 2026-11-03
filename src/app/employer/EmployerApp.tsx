"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import styles from "@/components/aurora/aurora.module.css";
import local from "./employerApp.module.css";
import { CountUp } from "@/components/aurora/CountUp";
import { useSession } from "@/hooks/useSession";
import { listCandidates, listAllInterviews, listAllOffers, type Candidate, type Interview, type Offer } from "@/lib/candidates";

function isUpcoming(interview: Interview): boolean {
  return interview.status === "scheduled" && new Date(interview.scheduled_at).getTime() >= Date.now();
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_META: { key: string; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "#00B4FF" },
  { key: "reviewed", label: "Reviewed", color: "#0066FF" },
  { key: "interviewing", label: "Interviewing", color: "#0F172A" },
  { key: "offered", label: "Offered", color: "#3B4147" },
  { key: "hired", label: "Hired", color: "#00E5FF" },
  { key: "rejected", label: "Rejected", color: "#FF2D55" },
];

const CALENDAR_ICON = "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4";

function Icon({ d, size = 20, sw = 2 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function EmployerApp() {
  const { user, loading } = useSession("employer");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCandidates(), listAllInterviews(), listAllOffers()])
      .then(([candidatesData, interviewsData, offersData]) => {
        setCandidates(candidatesData);
        setInterviews(interviewsData);
        setOffers(offersData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your insights."))
      .finally(() => setDataLoading(false));
  }, [user]);

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-3)",
          background: "var(--bg)",
          fontSize: "14px",
        }}
      >
        Loading…
      </div>
    );
  }

  const firstName = user.full_name.split(" ")[0];
  const upcomingInterviews = interviews.filter(isUpcoming).sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  const now = new Date();
  const activeInPipeline = candidates.filter((c) => c.status !== "hired" && c.status !== "rejected").length;
  const activePct = candidates.length ? Math.round((activeInPipeline / candidates.length) * 100) : 0;
  const interviewsToday = interviews.filter((i) => {
    const d = new Date(i.scheduled_at);
    return d.toDateString() === now.toDateString();
  }).length;
  const addedThisMonth = candidates.filter((c) => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const pendingReview = candidates.filter((c) => c.status === "pending").length;
  const hiredCount = candidates.filter((c) => c.status === "hired").length;
  const rejectedCount = candidates.filter((c) => c.status === "rejected").length;

  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const interviewsThisWeek = interviews.filter((i) => {
    const d = new Date(i.scheduled_at);
    return i.status === "scheduled" && d.getTime() >= now.getTime() && d.getTime() <= sevenDaysOut.getTime();
  }).length;

  const offersExtended = offers.length;
  const offersAccepted = offers.filter((o) => o.status === "accepted").length;
  const offersDecided = offers.filter((o) => o.status === "accepted" || o.status === "declined").length;
  const acceptanceRate = offersDecided ? Math.round((offersAccepted / offersDecided) * 100) : 0;

  const sourceCounts = (() => {
    const map = new Map<string, number>();
    candidates.forEach((c) => {
      const key = c.source?.trim() || "Unspecified";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  })();

  const interviewTypeCounts = (() => {
    const map = new Map<string, number>();
    interviews.forEach((i) => {
      map.set(i.interview_type, (map.get(i.interview_type) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  })();


  const statusRows = STATUS_META.map((s) => ({ ...s, count: candidates.filter((c) => c.status === s.key).length }));
  const totalCandidates = candidates.length;
  const maxStatus = Math.max(1, ...statusRows.map((r) => r.count));
  const maxType = Math.max(1, ...interviewTypeCounts.map((r) => r.count));
  const maxSource = Math.max(1, ...sourceCounts.map((r) => r.count));
  const nextUp = upcomingInterviews.slice(0, 4);
  const delay = (i: number) => ({ "--d": `${0.4 + i * 0.09}s` }) as CSSProperties;

  const kpis: { label: string; value: number; bar: string; foot: ReactNode }[] = [
    { label: "Total candidates", value: totalCandidates, bar: "#0066FF", foot: "in the shared pool" },
    { label: "Pending review", value: pendingReview, bar: "#00B4FF", foot: "awaiting first look" },
    {
      label: "Offers extended",
      value: offersExtended,
      bar: "#00E5FF",
      foot: offersDecided ? <span className={local.tag}>{acceptanceRate}% accepted</span> : "no decisions yet",
    },
    { label: "Hired", value: hiredCount, bar: "#3B4147", foot: `${rejectedCount} rejected` },
  ];

  return (
    <DashboardShell user={user}>
      {error && (
        <p className={local.alert} role="alert">
          {error}
        </p>
      )}

      {/* Hero */}
      <section
        className={styles.hero}
        style={{ alignItems: "center", justifyContent: "space-between", paddingTop: 52, paddingBottom: 120, marginBottom: -88 }}
      >
        <div className={local.heroBody}>
          <span className={styles.eyebrow}>AI-powered interview scheduling</span>
          <span className={local.welcome}>Welcome back, {firstName}</span>
          <h1 className={local.h1}>
            Hire smarter with <em>Krafziel</em>
          </h1>
          <p className={local.lede}>Your hiring pipeline at a glance.</p>
          <Link href="/employer/candidates" className={local.cta}>
            View Candidate Pool <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className={local.ringCard}>
          <div className={local.ring} role="img" aria-label={`${activePct} percent active in pipeline`}>
            <div className={local.ringArc} style={{ "--p": `${activePct}%` } as CSSProperties} />
            <b className={local.ringNum}>
              <CountUp value={activePct} />
            </b>
          </div>
          <span className={local.ringText}>
            <span>Active in pipeline</span>
            <b>{activeInPipeline} not yet closed</b>
            <span>
              {activePct}% of {totalCandidates} candidates
            </span>
          </span>
        </div>
      </section>

      {/* Key figures */}
      <section className={local.kpis} aria-label="Key figures">
        {kpis.map((k) => (
          <div key={k.label} className={`${styles.glass} ${styles.card} ${local.kpi}`}>
            <i className={local.kpiBar} style={{ background: k.bar }} />
            <span className={local.lab}>{k.label}</span>
            <b className={local.kpiNum}>
              <CountUp value={k.value} />
            </b>
            <span className={local.kpiFoot}>{k.foot}</span>
          </div>
        ))}
      </section>

      {/* Status + upcoming */}
      <section className={local.split}>
        <div className={`${styles.glass} ${styles.card} ${local.panel}`}>
          <div className={local.panelHead}>
            <h2 className={local.panelTitle}>Candidates by status</h2>
            <span className={local.muted}>{totalCandidates} in total</span>
          </div>
          {totalCandidates > 0 && (
            <div className={local.segments} role="img" aria-label={statusRows.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(", ")}>
              {statusRows
                .filter((s) => s.count > 0)
                .map((s, i) => (
                  <div key={s.key} className={styles.growX} style={{ flex: s.count, background: s.color, ...delay(i) }} />
                ))}
            </div>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {statusRows.map((s, i) => (
              <li key={s.key} className={local.statusRow}>
                <span className={local.statusName}>
                  <i className={local.swatch} style={{ background: s.color }} />
                  {s.label}
                </span>
                <div className={local.track}>
                  <i className={styles.growX} style={{ width: `${(s.count / maxStatus) * 100}%`, background: s.color, ...delay(i) }} />
                </div>
                <b className={local.right}>
                  <CountUp value={s.count} />
                </b>
                <span className={local.pct}>{totalCandidates ? Math.round((s.count / totalCandidates) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={local.stack}>
          <div className={`${styles.glass} ${styles.card} ${local.panel}`} style={{ flex: 1 }}>
            <div className={local.panelHead}>
              <h2 className={local.panelTitle}>Upcoming interviews</h2>
              {dataLoading || nextUp.length === 0 ? (
                <Link href="/employer/interviews" className={local.panelLink}>
                  Schedule
                </Link>
              ) : (
                <span className={local.muted}>{upcomingInterviews.length} scheduled</span>
              )}
            </div>
            {dataLoading || nextUp.length === 0 ? (
              <div className={local.empty}>
                <span className={local.emptyIcon}>
                  <Icon d={CALENDAR_ICON} size={22} sw={1.8} />
                </span>
                <b>{dataLoading ? "Loading…" : "Nothing scheduled yet"}</b>
                {!dataLoading && <span className={local.muted}>Today and the next 7 days are open.</span>}
              </div>
            ) : (
              <div className={local.upcoming}>
                {upcomingInterviews.map((interview) => {
                  const candidate = candidates.find((c) => c.id === interview.candidate_id);
                  return (
                    <Link key={interview.id} href={`/employer/candidates/${interview.candidate_id}`} className={local.upItem}>
                      <span className={local.upWho}>
                        <b>{candidate?.applicant_name ?? "Candidate"}</b>
                        <span>
                          {formatWhen(interview.scheduled_at)} · with {interview.interviewer_name}
                        </span>
                      </span>
                      <span className={styles.chip} style={{ background: "#E8F1FF", color: "#0052CC", textTransform: "capitalize" }}>
                        {interview.interview_type}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`${styles.glass} ${styles.card} ${local.strip}`}>
            {[
              { label: "Interviews today", value: interviewsToday },
              { label: "This week", value: interviewsThisWeek },
              { label: "Added this month", value: addedThisMonth },
            ].map((s) => (
              <div key={s.label} className={local.stripCell}>
                <span className={local.lab}>{s.label}</span>
                <b className={local.stripNum}>
                  <CountUp value={s.value} />
                </b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Types + sources */}
      <section className={local.halves}>
        <div className={`${styles.glass} ${styles.card} ${local.panel}`}>
          <div className={local.panelHead}>
            <h2 className={local.panelTitle}>Interviews by type</h2>
            <span className={local.muted}>{interviews.length} total</span>
          </div>
          {interviewTypeCounts.length === 0 ? (
            <p className={local.muted} style={{ margin: 0 }}>
              No interviews yet.
            </p>
          ) : (
            <ul className={local.bars}>
              {interviewTypeCounts.map((row, idx) => (
                <li key={row.label} className={local.barCol}>
                  <b>
                    <CountUp value={row.count} />
                  </b>
                  <div
                    className={`${styles.growY} ${local.barFill} ${idx === 0 ? local.barFillTop : ""}`}
                    style={{ height: `${Math.max(8, (row.count / maxType) * 170)}px`, ...delay(idx) }}
                  />
                  <span className={local.barLabel} title={row.label}>
                    {row.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${styles.glass} ${styles.card} ${local.panel}`}>
          <div className={local.panelHead}>
            <h2 className={local.panelTitle}>Candidates by source</h2>
            <span className={local.muted}>Top 6</span>
          </div>
          {sourceCounts.length === 0 ? (
            <p className={local.muted} style={{ margin: 0 }}>
              No candidates yet.
            </p>
          ) : (
            <ol className={local.rank}>
              {sourceCounts.map((row, idx) => (
                <li key={row.label} className={local.rankRow}>
                  <span className={local.rankIdx}>{idx + 1}</span>
                  <span className={local.rankName} title={row.label}>
                    {row.label}
                  </span>
                  <div className={local.rankBar}>
                    <i
                      className={`${styles.growX} ${idx === 0 ? local.rankTop : ""}`}
                      style={{ width: `${(row.count / maxSource) * 100}%`, ...delay(idx) }}
                    />
                  </div>
                  <b className={local.right}>{row.count}</b>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
