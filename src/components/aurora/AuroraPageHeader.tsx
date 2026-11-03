import type { ReactNode } from "react";
import styles from "./aurora.module.css";

/** The hero row every Aurora page opens with: eyebrow chip, big title, subtitle, actions. */
export function AuroraPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroText}>
        <span className={styles.eyebrow}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent-ink)" aria-hidden="true">
            <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
          </svg>
          {eyebrow}
        </span>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.heroActions}>{actions}</div> : null}
    </section>
  );
}
