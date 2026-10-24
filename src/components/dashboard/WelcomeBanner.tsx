import styles from "./WelcomeBanner.module.css";
import { SparklesIcon } from "@/components/auth/icons";

// This banner only ever shows on the candidate/employer dashboards.
type Role = "candidate" | "employer";

const COPY: Record<
  Role,
  { badge: string; headingLine1: string; headingLine2: string; subhead: string }
> = {
  candidate: {
    badge: "Two-Stage AI Interview Workflow",
    headingLine1: "Build Your Career with",
    headingLine2: "Nextenti",
    subhead:
      "Apply for open roles, instantly experience our automated AI pre-screening interview, and schedule your live person-to-person interview.",
  },
  employer: {
    badge: "AI-Powered Interview Scheduling",
    headingLine1: "Hire Smarter with",
    headingLine2: "Nextenti",
    subhead:
      "Bring in candidates sourced from anywhere, track them through your pipeline, and schedule interviews in one place.",
  },
};

type WelcomeBannerProps = {
  role: Role;
  compact?: boolean;
};

export function WelcomeBanner({ role, compact = false }: WelcomeBannerProps) {
  const copy = COPY[role];

  if (compact) {
    return (
      <div className={styles.bannerCompact}>
        <div className={styles.glowCompact} />
        <span className={styles.badgeCompact}>
          <SparklesIcon size={11} color="#a5f3fc" />
          {copy.badge}
        </span>
        <h2 className={styles.headingCompact}>
          {copy.headingLine1} <span className={styles.headingAccentInline}>{copy.headingLine2}</span>
        </h2>
      </div>
    );
  }

  return (
    <div className={styles.banner}>
      <div className={styles.glow} />
      <span className={styles.badge}>
        <SparklesIcon size={12} color="#a5f3fc" />
        {copy.badge}
      </span>
      <h2 className={styles.heading}>
        {copy.headingLine1}
        <span className={styles.headingAccent}>{copy.headingLine2}</span>
      </h2>
      <p className={styles.subhead}>{copy.subhead}</p>
    </div>
  );
}
