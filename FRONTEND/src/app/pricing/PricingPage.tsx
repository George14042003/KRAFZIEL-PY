"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BriefcaseIcon } from "@/components/auth/icons";
import { AuroraCanvas } from "@/components/aurora/AuroraCanvas";
import aurora from "@/components/aurora/aurora.module.css";
import { Reveal } from "@/components/homepage/Reveal";
import { PLAN_MODES, PricingPlans } from "@/components/pricing/PricingPlans";
import { formatMoney, MODE_LABELS, offerSummary } from "@/lib/billing";
import styles from "./PricingPage.module.css";

const FAQS = [
  {
    q: "Do candidates pay anything?",
    a: "No. Candidates can browse roles, apply, and take interviews for free. Subscriptions are for employers.",
  },
  {
    q: "What counts as an interview?",
    a: "Each completed bot interview or live video interview counts once against its pack. Cancelled or abandoned attempts are not counted.",
  },
  {
    q: "How do demo subscriptions work?",
    a: "Until online payments (Razorpay) go live, you can choose any plan from the Subscriptions page and it starts straight away without paying. Your organization gets exactly that plan's limits, and you can switch plan or cancel whenever you like.",
  },
  {
    q: "Do I need a plan to get started?",
    a: "No. An organization that has not chosen a plan has unlimited early access. The limits of a plan apply from the moment you choose it.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. You can switch plan, billing period or interview type at any time from the Subscriptions page, and the new limits apply immediately.",
  },
  {
    q: "What happens if I reach a limit?",
    a: "You cannot add more jobs, candidates or interviews until you choose a bigger plan or, for interviews, until the allowance resets next month. Existing candidates and results are never deleted. For a custom pack, contact sales@nextenti.ai.",
  },
  {
    q: "Is there a discount for annual billing?",
    a: "Yes. Choose annual billing and the discount shown on the toggle above is applied to every paid plan.",
  },
];

export function PricingPage() {
  return (
    <AuroraCanvas>
      <div className={styles.wrap}>
      <div className={styles.nav}>
        <Link href="/" className={styles.brandLogoPill} aria-label="Krafziel">
          <BrandLogo onLight height={42} />
        </Link>
        <nav aria-label="Site" className={`${aurora.glass} ${styles.navPill}`}>
          <Link href="/#features" className={styles.navLink}>Features</Link>
          <Link href="/#how-it-works" className={styles.navLink}>How It Works</Link>
          <Link href="/pricing" className={`${styles.navLink} ${styles.navLinkActive}`} aria-current="page">Pricing</Link>
        </nav>
        <div className={`${aurora.glass} ${styles.actionPill}`}>
          <Link href="/login?role=candidate" className={styles.loginLink}>Log in</Link>
          <Link href="/signup" className={`${aurora.btn} ${aurora.btnAccent} ${aurora.btnSm}`}>
            <BriefcaseIcon size={14} color="currentColor" />
            Get started
          </Link>
        </div>
      </div>

      <header className={styles.header}>
        <span className={styles.eyebrow}>Pricing</span>
        <h1 className={styles.title}>
          Simple plans that <span className={styles.accent}>scale</span> with your hiring
        </h1>
        <p className={styles.sub}>
          AI screening and live video interviews in one pipeline. Start free, upgrade when you need more.
        </p>

      </header>

      <PricingPlans
        variant="aurora"
        renderAfter={({ catalog, annual, discountPct }) => (
          <section className={styles.rate}>
            <Reveal>
              <h2 className={styles.faqTitle}>Rate card</h2>
              <p className={styles.modeNote}>
                Every pack at a glance. Prices are per month in INR{annual ? `, shown with ${discountPct}% off for annual billing` : ""}.
              </p>
              <div className={`${aurora.glass} ${styles.rateWrap}`}>
                <table className={styles.rateTable}>
                  <thead>
                    <tr>
                      <th>Pack</th>
                      {catalog.plans.map((p) => (
                        <th key={p.key}>{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_MODES.map((m) => (
                      <tr key={m}>
                        <th scope="row">{MODE_LABELS[m]}</th>
                        {catalog.plans.map((p) => {
                          const o = p.offers[m];
                          const per = annual ? Math.round(o.annual_paise / 12) : o.monthly_paise;
                          return (
                            <td key={p.key}>
                              <b>{o.monthly_paise > 0 ? formatMoney(per) : "₹0"}</b>
                              <span>{offerSummary(o).replace(" / month", "")}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </section>
        )}
      />

      <section className={styles.faq}>
        <Reveal>
          <h2 className={styles.faqTitle}>Frequently asked questions</h2>
        </Reveal>
        <div className={styles.faqList}>
          {FAQS.map((f) => (
            <Reveal key={f.q}>
              <details className={`${aurora.glass} ${styles.faqItem}`}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Krafziel. All rights reserved.</span>
        <Link href="/">Back to home</Link>
      </footer>
      </div>
    </AuroraCanvas>
  );
}
