import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import type { ReactNode } from "react";
import styles from "./LegalPage.module.css";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Shared layout for the Privacy Policy and Terms pages: MAATA header, title band,
 * sticky table of contents and numbered sections. */
export function LegalPage({
  title,
  intro,
  updated,
  sections,
  other,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIn}>
          <Link href="/" className={styles.logo} aria-label="Krafziel — home">
            <BrandLogo height="clamp(26px, 8.5vw, 40px)" />
          </Link>
          <Link href="/" className={styles.back}>
            ← Back to home
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroIn}>
          <span className={styles.eyebrow}>Legal</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <span className={styles.updated}>Last updated {updated}</span>
        </div>
      </section>

      <main className={styles.main}>
        <nav className={styles.toc} aria-label="On this page">
          <span className={styles.tocTitle}>On this page</span>
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}>
              <b>{i + 1}</b>
              {s.title}
            </a>
          ))}
          <Link href={other.href} className={styles.tocOther}>
            {other.label} →
          </Link>
        </nav>

        <article className={styles.card}>
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className={styles.section}>
              <h2>
                <span>{i + 1}</span>
                {s.title}
              </h2>
              <div className={styles.body}>{s.body}</div>
            </section>
          ))}
        </article>
      </main>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Krafziel. All rights reserved.</span>
        <span className={styles.footerLinks}>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
        </span>
      </footer>
    </div>
  );
}
