"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { CountUp } from "@/components/aurora/CountUp";
import { useSession } from "@/hooks/useSession";
import { getMyPortal, type PortalCandidate, type PortalInterview } from "@/lib/candidates";
import s from "./candidate.module.css";
import { ArrowIcon, CalendarIcon, STATUS_COLORS, labelize } from "./ui";

/** Open roles live on the main Nextenti site. */
const SEARCH_JOBS_URL = "https://nextenti.ai/search-jobs";

const STAGES = ["pending", "reviewed", "interviewing", "offered", "hired"];

function isUpcoming(interview: PortalInterview): boolean {
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

export function CandidateApp() {
  const { user, loading } = useSession("candidate");
  const [candidate, setCandidate] = useState<PortalCandidate | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyPortal()
      .then((res) => setCandidate(res.candidate))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your info."))
      .finally(() => setDataLoading(false));
  }, [user]);

  if (loading || !user) return <AuroraLoading />;

  const firstName = user.full_name.split(" ")[0];
  const upcomingInterviews = (candidate?.interviews ?? [])
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const totalInterviews = candidate?.interviews.length ?? 0;
  const completedInterviews = (candidate?.interviews ?? []).filter((i) => i.status === "completed").length;
  const offerCount = candidate?.offers.length ?? 0;
  const stageIndex = candidate ? STAGES.indexOf(candidate.status) : -1;
  const stageColor = candidate ? STATUS_COLORS[candidate.status] ?? "#8B93A7" : "#8B93A7";

  return (
    <>
      <section className={s.hero}>
        <div className={s.heroLeft}>
          <span className={s.pill}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-ink)" aria-hidden="true">
              <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
            </svg>
            AI-powered interviews
          </span>
          <p className={s.welcome}>Welcome back, {firstName}</p>
          <h1 className={s.h1}>
            Find your <em>next role</em> with Krafziel.
          </h1>
          <p className={s.lead}>Your interviews, offers and applications at a glance.</p>
          <a href={SEARCH_JOBS_URL} className={s.cta}>
            Browse Open Roles
            <span className={s.ctaDot}>
              <ArrowIcon />
            </span>
          </a>
        </div>

        <div className={`${aurora.glass} ${aurora.card} ${s.heroRight}`}>
          <div className={s.cardTitle}>
            <h2>Your status</h2>
            <span>Where you are in the process</span>
          </div>
          {dataLoading ? (
            <p className={s.muted}>Loading…</p>
          ) : candidate ? (
            <div className={s.stage}>
              <div className={s.stageName} style={{ color: stageColor }}>
                {labelize(candidate.status)}
              </div>
              <div className={s.track} aria-hidden="true">
                {STAGES.map((st, i) => (
                  <i key={st} style={i <= stageIndex ? { background: stageColor } : undefined} />
                ))}
              </div>
              <div className={s.steps}>
                {STAGES.map((st, i) => (
                  <span key={st} className={i === stageIndex ? s.stepOn : undefined}>
                    {labelize(st)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className={s.muted}>You are not in the pipeline yet.</p>
          )}
        </div>
      </section>

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {!dataLoading && !candidate ? (
        <div className={`${aurora.glass} ${aurora.card} ${s.emptyCard}`}>
          <span className={s.emptyTitle}>You&apos;re not in our pipeline yet</span>
          <p className={s.emptyText}>
            Once a recruiter adds you and schedules an interview, everything will show up here
            automatically &mdash; no extra steps needed.
          </p>
        </div>
      ) : (
        <>
          <section className={s.statRow}>
            <Link href="/candidate/interviews" className={`${s.big} ${s.accentCard} ${aurora.lift}`} style={{ textDecoration: "none" }}>
              <div className={s.bigTop}>
                <span>Upcoming interviews</span>
                <span className={s.ctaDot}>
                  <ArrowIcon />
                </span>
              </div>
              <div>
                <div className={s.bigNum}>
                  <CountUp value={upcomingInterviews.length} />
                </div>
                <div className={s.bigCap}>Scheduled ahead</div>
              </div>
            </Link>
            <Link href="/candidate/offers" className={`${s.big} ${s.violetCard} ${aurora.lift}`} style={{ textDecoration: "none" }}>
              <div className={s.bigTop}>
                <span>Offers</span>
                <span className={aurora.chip} style={{ background: "rgba(255,255,255,.2)" }}>
                  Extended to you
                </span>
              </div>
              <div>
                <div className={s.bigNum}>
                  <CountUp value={offerCount} />
                </div>
                <div className={s.bigCap} style={{ color: "#EEE9FF" }}>
                  Offers out to you
                </div>
              </div>
            </Link>
            <div className={s.smallGrid}>
              <div className={`${aurora.glass} ${aurora.cardSm}`}>
                <div className={s.sLabel}>Total interviews</div>
                <div className={s.sVal}>
                  <CountUp value={totalInterviews} />
                </div>
                <div className={s.sFoot}>All time</div>
              </div>
              <div className={`${aurora.glass} ${aurora.cardSm}`}>
                <div className={s.sLabel}>Completed</div>
                <div className={s.sVal}>
                  <CountUp value={completedInterviews} />
                </div>
                <div className={s.sFoot}>Interviews finished</div>
              </div>
            </div>
          </section>

          <section className={`${aurora.glass} ${aurora.card}`}>
            <div className={s.cardTitle}>
              <h2>Upcoming interviews</h2>
              <span>{upcomingInterviews.length} scheduled</span>
            </div>
            {dataLoading ? (
              <p className={s.muted}>Loading…</p>
            ) : upcomingInterviews.length === 0 ? (
              <div className={s.empty}>
                <span className={s.emptyCircle}>
                  <CalendarIcon />
                </span>
                Nothing scheduled yet.
              </div>
            ) : (
              <ul className={s.list}>
                {upcomingInterviews.map((interview) => (
                  <li key={interview.id} className={s.item}>
                    <div>
                      <div className={s.itemTitle}>
                        {interview.interview_type} interview with {interview.interviewer_name}
                      </div>
                      <div className={s.itemWhen}>{formatWhen(interview.scheduled_at)}</div>
                    </div>
                    {interview.interview_type === "video" && (
                      <Link href={`/call/${interview.id}`} target="_blank" className={`${aurora.btn} ${aurora.btnAccent} ${aurora.btnSm}`}>
                        Join Call
                      </Link>
                    )}
                    {interview.interview_type === "bot" && (
                      <Link href={`/bot-interview/${interview.id}`} target="_blank" className={`${aurora.btn} ${aurora.btnAccent} ${aurora.btnSm}`}>
                        Join the interview
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className={`${aurora.glass} ${aurora.card} ${s.tutorial}`}>
        <div className={s.cardTitle} style={{ marginBottom: 0 }}>
          <h2>Tutorial</h2>
          <span>New here? Watch how the AI interview engine works before your interview.</span>
        </div>
        <video
          suppressHydrationWarning
          className={s.video}
          style={{ maxWidth: 720 }}
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="auto"
          aria-label="Explainer video walking through how the NAIE AI interview engine works"
        >
          <source src="/videos/ai_interview_engine_explainer.mp4" type="video/mp4" />
        </video>
      </section>
    </>
  );
}
