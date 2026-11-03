"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { Reveal } from "@/components/homepage/Reveal";
import {
  DEMO_NOTICE,
  formatMoney,
  listPlans,
  MODE_LABELS,
  offerSummary,
  type InterviewMode,
  type PlanCatalog,
  type PlanKey,
} from "@/lib/billing";
import styles from "./PricingPlans.module.css";

export const PLAN_MODES: InterviewMode[] = ["bot", "video", "both"];

// Short wording per plan. Everything a plan actually gives (prices, interview packs, active jobs, candidates) comes from the
// server (/billing/plans), so these cards always match what an organization receives when it subscribes.
const PLAN_COPY: Record<PlanKey, { name: string; tagline: string; cta: string; featured?: boolean }> = {
  free: { name: "Free", tagline: "A first taste of AI screening. No card needed.", cta: "Start for free" },
  starter: { name: "Starter", tagline: "For small teams hiring now and then.", cta: "Choose Starter" },
  growth: { name: "Growth", tagline: "For teams that hire every month.", cta: "Choose Growth", featured: true },
  enterprise: { name: "Enterprise", tagline: "For recruiting teams at scale, with no cap on jobs or candidates.", cta: "Choose Enterprise" },
};

/** What every plan includes, whatever its limits. */
const INCLUDED_IN_EVERY_PLAN =
  "Every plan includes AI scoring on each interview with an auto-shortlist cutoff, proctored bot interviews, live video rooms with recording, and email invitations. Plans differ only in the limits shown.";
const PLAN_ORDER: PlanKey[] = ["free", "starter", "growth", "enterprise"];

const MODE_NOTE: Record<InterviewMode, string> = {
  bot: "AI bot interviews only: candidates answer questions on their own time.",
  video: "Live video interviews only: you meet the candidate face to face, with recording.",
  both: "Bot screening plus live video rounds in one pack, cheaper than buying them separately.",
};

function CheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

type Props = {
  /** "aurora" for the dark glass /pricing page, "home" for the light marketing home page. */
  variant: "aurora" | "home";
  /** Rendered below the cards once the catalog has loaded (the /pricing rate card). */
  renderAfter?: (ctx: { catalog: PlanCatalog; annual: boolean; discountPct: number }) => ReactNode;
};

export function PricingPlans({ variant, renderAfter }: Props) {
  const [annual, setAnnual] = useState(true);
  const [mode, setMode] = useState<InterviewMode>("both");
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    listPlans().then(setCatalog).catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function retry() {
    setLoadError(false);
    load();
  }

  const discountPct = Math.round((catalog?.annual_discount ?? 0.2) * 100);
  const demo = catalog ? catalog.demo_mode !== false : true;
  const interval = annual ? "year" : "month";
  const glass = variant === "aurora" ? aurora.glass : "";
  const cards = catalog ? PLAN_ORDER.map((k) => catalog.plans.find((p) => p.key === k)).filter((p) => p !== undefined) : null;

  return (
    <div className={`${styles.root} ${variant === "aurora" ? styles.aurora : styles.home}`}>
      <div className={styles.controls}>
        <div className={styles.toggle} role="group" aria-label="Billing period">
          <button type="button" aria-pressed={!annual} className={!annual ? styles.toggleOn : styles.toggleBtn} onClick={() => setAnnual(false)}>
            Monthly
          </button>
          <button type="button" aria-pressed={annual} className={annual ? styles.toggleOn : styles.toggleBtn} onClick={() => setAnnual(true)}>
            Annual <span className={styles.save}>Save {discountPct}%</span>
          </button>
        </div>
        <div className={styles.toggle} role="group" aria-label="Interview type">
          {PLAN_MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? styles.toggleOn : styles.toggleBtn} onClick={() => setMode(m)}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <p className={styles.note}>{MODE_NOTE[mode]}</p>
        {demo && <p className={styles.demoNote}>{DEMO_NOTICE}</p>}
      </div>

      {loadError && !catalog && (
        <div className={styles.error} role="alert">
          <span>Could not load live pricing right now.</span>
          <button type="button" className={styles.retry} onClick={retry}>
            Retry
          </button>
        </div>
      )}

      <div className={styles.plans} aria-busy={!catalog && !loadError}>
        {cards
          ? cards.map((plan, i) => {
              const copy = PLAN_COPY[plan.key];
              const offer = plan.offers[mode];
              const paid = offer.monthly_paise > 0;
              const perMonth = annual ? Math.round(offer.annual_paise / 12) : offer.monthly_paise;
              const href = !paid ? "/signup" : `/employer/billing?plan=${plan.key}&mode=${mode}&interval=${interval}`;
              const label = !paid ? copy.cta : demo ? "Start demo subscription" : copy.cta;
              return (
                <Reveal key={plan.key} delayMs={i * 70} className={styles.cardWrap}>
                  <div className={`${glass} ${styles.card} ${copy.featured ? styles.featured : ""}`}>
                    {copy.featured ? <span className={styles.badge}>Most popular</span> : <span className={styles.badgeSpace} aria-hidden="true" />}
                    <h3 className={styles.planName}>{plan.name}</h3>
                    <p className={styles.tagline}>{copy.tagline}</p>
                    <div className={styles.priceRow}>
                      <span className={styles.price}>{paid ? formatMoney(perMonth) : "₹0"}</span>
                      <span className={styles.per}>{paid ? "/ month" : "forever"}</span>
                    </div>
                    <p className={styles.billed}>{paid && annual ? `${formatMoney(offer.annual_paise)} billed yearly` : " "}</p>
                    <Link href={href} className={styles.cta}>
                      {label}
                    </Link>
                    <ul className={styles.features}>
                      <li className={styles.strong}>
                        <span className={styles.check}><CheckIcon /></span>
                        {offerSummary(offer)}
                      </li>
                      <li>
                        <span className={styles.check}><CheckIcon /></span>
                        {plan.limits.jobs === null ? "Unlimited" : plan.limits.jobs} active job posting{plan.limits.jobs === 1 ? "" : "s"}
                      </li>
                      <li>
                        <span className={styles.check}><CheckIcon /></span>
                        {plan.limits.candidates === null ? "Unlimited" : plan.limits.candidates.toLocaleString("en-IN")} candidates in the pool
                      </li>
                      <li>
                        <span className={styles.check}><CheckIcon /></span>
                        Interview allowance resets every month
                      </li>
                    </ul>
                  </div>
                </Reveal>
              );
            })
          : PLAN_ORDER.map((k) => {
              const copy = PLAN_COPY[k];
              return (
                <div key={k} className={styles.cardWrap}>
                  <div className={`${glass} ${styles.card} ${copy.featured ? styles.featured : ""}`}>
                    <span className={styles.badgeSpace} aria-hidden="true" />
                    <h3 className={styles.planName}>{copy.name}</h3>
                    <p className={styles.tagline}>{copy.tagline}</p>
                    <div className={styles.priceRow}>
                      <span className={`${styles.price} ${loadError ? "" : styles.skeleton}`}>{loadError ? "—" : "₹000"}</span>
                    </div>
                    <p className={styles.billed}>{" "}</p>
                    <span className={`${styles.cta} ${styles.ctaOff}`} aria-disabled="true">
                      {loadError ? "Unavailable" : "Loading…"}
                    </span>
                    <ul className={styles.features} aria-hidden="true">
                      {[0, 1, 2, 3].map((n) => (
                        <li key={n}>
                          <span className={styles.check}><CheckIcon /></span>
                          <span className={loadError ? "" : styles.skeleton}>{loadError ? "—" : "Loading plan details"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
      </div>

      <p className={styles.included}>{INCLUDED_IN_EVERY_PLAN}</p>

      {catalog && renderAfter?.({ catalog, annual, discountPct })}
    </div>
  );
}
