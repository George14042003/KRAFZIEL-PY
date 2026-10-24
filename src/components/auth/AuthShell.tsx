import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "./AuthShell.module.css";
import { CheckIcon } from "./icons";

type AuthShellProps = {
  headline: string;
  subhead: string;
  features: string[];
  children: ReactNode;
  /** Swap sides — video/hero panel on the right, form card on the left. */
  mirrored?: boolean;
};

const SWAP_FADE_MS = 220;

export function AuthShell({ headline, subhead, features, children, mirrored = false }: AuthShellProps) {
  // The actual side-swap (via flex `order`) can't be CSS-transitioned by
  // itself — it's an instant flip. So the swap only happens while opacity is
  // briefly dipped to 0, and the fade back in masks it as one smooth motion
  // instead of a jarring switch.
  const [appliedMirrored, setAppliedMirrored] = useState(mirrored);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (mirrored === appliedMirrored) return;
    setFading(true);
    const timer = setTimeout(() => {
      setAppliedMirrored(mirrored);
      setFading(false);
    }, SWAP_FADE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrored]);

  const panelStyle = (side: "hero" | "card"): React.CSSProperties => ({
    order: appliedMirrored ? (side === "hero" ? 2 : 1) : undefined,
    opacity: fading ? 0 : 1,
    transform: fading ? "translateY(6px)" : "translateY(0)",
    transition: `opacity ${SWAP_FADE_MS}ms ease, transform ${SWAP_FADE_MS}ms ease`,
  });

  return (
    <div className={styles.shell}>
      <div className={styles.videoBg}>
        <video
          className={styles.video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className={styles.videoOverlay} />
      </div>
      <div className={styles.themeToggleWrap}>
        <ThemeToggle variant="ghost" iconColor="#fff" />
      </div>
      <div className={styles.content}>
        <aside className={styles.hero} style={panelStyle("hero")}>
          <div className={styles.heroBrand}>
            <Logo size={44} radius={12} />
            <span className={styles.heroBrandName}>Nextenti</span>
          </div>

          <div>
            <h1 className={styles.heroHeadline}>{headline}</h1>
            <p className={styles.heroSubhead} style={{ marginTop: "12px" }}>
              {subhead}
            </p>
          </div>

          <ul className={styles.heroFeatures}>
            {features.map((feature) => (
              <li key={feature} className={styles.heroFeature}>
                <span className={styles.heroFeatureIcon}>
                  <CheckIcon size={12} />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <p className={styles.heroFooter}>
            &copy; {new Date().getFullYear()} Nextenti. All rights reserved.
          </p>
        </aside>

        <div className={styles.cardWrapper} style={panelStyle("card")}>
          <div className={styles.mobileBrand}>
            <Logo size={44} radius={12} />
            <span className={styles.mobileBrandName}>Nextenti</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
