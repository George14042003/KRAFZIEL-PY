import type { CSSProperties, ReactNode } from "react";
import styles from "./aurora.module.css";

/** Aurora backdrop (theme tokens, drifting glows, dot grid) for standalone pages that do not
 * live inside the signed-in shell: login, signup, password reset, homepage, pricing. */
export function AuroraCanvas({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`${styles.page} ${styles.maata}${className ? ` ${className}` : ""}`} style={style}>
      <div className={styles.glowA} aria-hidden="true" />
      <div className={styles.glowB} aria-hidden="true" />
      <div className={styles.glowC} aria-hidden="true" />
      <div className={styles.dots} aria-hidden="true" />
      {children}
    </div>
  );
}
