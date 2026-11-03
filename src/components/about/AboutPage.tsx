import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import type { ReactNode } from "react";
import styles from "./AboutPage.module.css";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const PILLARS = [
  {
    title: "Screen consistently",
    body: "A bot-led first interview gives every applicant the same questions and the same evaluation, so recruiters spend their time on people worth meeting.",
    icon: (
      <>
        <rect x="4" y="7" width="16" height="12" rx="3" />
        <path d="M12 7V4M9 12h.01M15 12h.01M9.5 15.5h5" />
      </>
    ),
  },
  {
    title: "Meet face to face",
    body: "Shortlisted candidates join a live video room with the hiring team, with notes and scoring in the same place. No tool-hopping, no lost context.",
    icon: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2.5" />
        <path d="M16 10l5-3v10l-5-3" />
      </>
    ),
  },
  {
    title: "Decide with the full picture",
    body: "Sourcing, scheduling, offers and reports share one candidate record, so every hiring decision rests on a real conversation, not just a resume.",
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
];

const VALUES = [
  { title: "Conversations over keywords", body: "A resume tells you where someone has been. A conversation tells you who they are." },
  { title: "Fair by design", body: "The same questions for everyone, clear consent, and AI that supports people rather than replacing their judgement." },
  { title: "Respect everyone's time", body: "Candidates interview when it suits them, and teams only meet the people who matter." },
  { title: "Simple on purpose", body: "One room for the whole process, so the tool never gets in the way of the hire." },
];

export function AboutPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIn}>
          <Link href="/" className={styles.logo} aria-label="Krafziel — home">
            <BrandLogo height="clamp(26px, 8.5vw, 40px)" />
          </Link>
          <nav className={styles.nav} aria-label="Main">
            <Link href="/about" aria-current="page" className={styles.navOn}>
              About us
            </Link>
            <Link href="/#features">Features</Link>
            <Link href="/#how">How It Works</Link>
            <Link href="/#pricing">Pricing</Link>
          </nav>
          <Link href="/" className={styles.back}>
            ← Home page
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.glowA} aria-hidden="true" />
        <div className={styles.glowB} aria-hidden="true" />
        <div className={styles.heroIn}>
          <span className={styles.eyebrow}>About us</span>
          <h1>
            We believe great hires happen <span className={styles.grad}>live.</span>
          </h1>
          <p>
            Krafziel brings sourcing, AI screening and real face-to-face interviews into a single room, so every hiring decision is
            made on a real conversation.
          </p>
        </div>
      </section>

      <main className={styles.main}>
        <section className={styles.story}>
          <div>
            <span className={styles.kk}>Our mission</span>
            <h2>Make hiring a conversation again</h2>
          </div>
          <div className={styles.storyText}>
            <p>
              Hiring has drifted into spreadsheets, inboxes and a dozen disconnected tools. Candidates are reduced to keywords, and teams lose
              hours on interviews that were never going to work out.
            </p>
            <p>
              We built Krafziel to bring the human back. AI handles the repetitive first round consistently and fairly. People handle what people do
              best: meeting, listening and deciding. Everything stays in one place, from the first search to the signed offer.
            </p>
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.blockHead}>
            <span className={styles.kk}>What we do</span>
            <h2>One room for the whole hiring process</h2>
          </div>
          <div className={styles.pillars}>
            {PILLARS.map((p) => (
              <div key={p.title} className={styles.pillar}>
                <span className={styles.pillarIcon}>
                  <Icon>{p.icon}</Icon>
                </span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.values}>
          <div className={styles.blockHead}>
            <span className={`${styles.kk} ${styles.kkLight}`}>What we stand for</span>
            <h2>Our values</h2>
          </div>
          <div className={styles.valueGrid}>
            {VALUES.map((v, i) => (
              <div key={v.title} className={styles.value}>
                <span className={styles.valueNum}>{i + 1}</span>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.cta}>
          <h2>Ready to hire on real conversations?</h2>
          <p>Join the teams moving sourcing, screening and live interviews into a single room.</p>
          <div className={styles.ctaBtns}>
            <Link href="/login?role=employer" className={`${styles.btn} ${styles.btnPrimary}`}>
              I’m an Employer
            </Link>
            <Link href="/login?role=candidate" className={styles.btn}>
              I’m a Candidate
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Krafziel. All rights reserved.</span>
        <span className={styles.footerLinks}>
          <Link href="/about">About us</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
        </span>
      </footer>
    </div>
  );
}
