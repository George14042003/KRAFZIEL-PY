import { LoopingVideo } from "@/components/LoopingVideo";
import { BrandLogo } from "@/components/BrandLogo";
import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AuroraCanvas } from "@/components/aurora/AuroraCanvas";
import aurora from "@/components/aurora/aurora.module.css";
import styles from "./AuthShell.module.css";
import { BriefcaseIcon, CheckIcon, UserIcon } from "./icons";

export type AuthRole = "candidate" | "employer";

type AuthShellProps = {
  headline: string;
  subhead: string;
  features: string[];
  children: ReactNode;
  /** Centre the card contents (confirmation / status screens). */
  centered?: boolean;
  /** Small legal line under the card. */
  footnote?: ReactNode;
  /** Role tint of the hero panel; changing it cross-fades the background glow. */
  tone?: AuthRole;
};

type HeroCopy = { headline: string; subhead: string; features: string[] };
const HERO_OUT_MS = 170;

/** Elzuron logo on a white plate; its size comes from AuthShell.module.css so it scales with the viewport. */
function BrandLogoMark() {
  return <BrandLogo />;
}

const delay = (s: number) => ({ ["--d" as string]: `${s}s` }) as CSSProperties;

export function AuthShell({ headline, subhead, features, children, centered = false, footnote, tone = "candidate" }: AuthShellProps) {
  // The old copy fades out first, then the new copy is mounted and rises in; the first paint keeps the page-load reveal.
  const [shown, setShown] = useState<HeroCopy>({ headline, subhead, features });
  const [swaps, setSwaps] = useState(0);
  const leaving = shown.headline !== headline || shown.subhead !== subhead || shown.features !== features;
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      setShown({ headline, subhead, features });
      setSwaps((n) => n + 1);
    }, HERO_OUT_MS);
    return () => clearTimeout(timer);
  }, [leaving, headline, subhead, features]);
  const enter = swaps === 0 ? aurora.reveal : styles.rise;

  return (
    <AuroraCanvas className={aurora.maata}>
      <div className={styles.stage}>
        <Link href="/" className={styles.homeBtn} aria-label="Home page">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
          </svg>
          <span className={styles.homeLabel}>Home page</span>
        </Link>
        <div className={styles.grid}>
          <aside className={styles.hero}>
            <div className={styles.heroVideoBg} aria-hidden="true">
              <LoopingVideo src="/videos/hero-bg.mp4" className={styles.heroVideo} />
            </div>
            <div className={styles.heroTints} aria-hidden="true">
              <span className={`${styles.tint} ${styles.tintCandidate} ${tone === "candidate" ? styles.tintOn : ""}`} />
              <span className={`${styles.tint} ${styles.tintEmployer} ${tone === "employer" ? styles.tintOn : ""}`} />
            </div>
            <div className={`${styles.brandPill} ${aurora.reveal}`}>
              <BrandLogoMark />
            </div>
            <div className={`${styles.heroCopy} ${leaving ? styles.heroOut : ""}`}>
              <h1 key={`h${swaps}`} className={`${styles.headline} ${enter}`} style={delay(swaps === 0 ? 0.08 : 0.02)}>
                {shown.headline}
              </h1>
              <p key={`p${swaps}`} className={`${styles.subhead} ${enter}`} style={delay(swaps === 0 ? 0.16 : 0.08)}>
                {shown.subhead}
              </p>
              <ul className={styles.features}>
                {shown.features.map((feature, i) => (
                  <li key={`${swaps}-${i}`} className={`${styles.feature} ${enter}`} style={delay(swaps === 0 ? 0.24 + i * 0.08 : 0.14 + i * 0.07)}>
                    <span className={styles.featureIcon}>
                      <CheckIcon size={14} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <p className={styles.copyright}>&copy; {new Date().getFullYear()} Elzuron. All rights reserved.</p>
          </aside>

          <div className={styles.cardCol}>
            <div className={`${styles.brandPill} ${styles.mobileBrand}`}>
              <BrandLogoMark />
            </div>
            <div className={`${aurora.glass} ${styles.card} ${centered ? styles.cardCenter : ""} ${aurora.popIn}`}>{children}</div>
            {footnote && <p className={styles.legal}>{footnote}</p>}
          </div>
        </div>
      </div>
    </AuroraCanvas>
  );
}

/** Candidate / Employer segmented control with a sliding pill. */
export function RoleTabs({ role, onChange }: { role: AuthRole; onChange: (r: AuthRole) => void }) {
  const item = (r: AuthRole, label: string, icon: ReactNode) => (
    <button
      type="button"
      className={`${styles.tab} ${role === r ? styles.tabActive : ""}`}
      aria-pressed={role === r}
      onClick={() => onChange(r)}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className={styles.tabs} role="group" aria-label="Account type" data-role={role}>
      <span className={styles.pill} aria-hidden="true" />
      {item("candidate", "Candidate", <UserIcon size={14} />)}
      {item("employer", "Employer", <BriefcaseIcon size={14} />)}
    </div>
  );
}

/**
 * Role-dependent text. Both variants share one grid cell, so the box is as tall as the longer one
 * and never jumps; only the active one is visible and exposed to assistive tech.
 */
export function RoleSwap({ role, candidate, employer }: { role: AuthRole; candidate: ReactNode; employer: ReactNode }) {
  return (
    <span className={styles.swap}>
      <span className={role === "candidate" ? styles.swapOn : styles.swapOff} aria-hidden={role !== "candidate"}>
        {candidate}
      </span>
      <span className={role === "employer" ? styles.swapOn : styles.swapOff} aria-hidden={role !== "employer"}>
        {employer}
      </span>
    </span>
  );
}
