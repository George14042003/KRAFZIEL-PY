"use client";

import { useContext } from "react";
import { AuroraLayoutContext } from "./AuroraLayoutContext";
import styles from "./aurora.module.css";

/** In-page loading state. Inside a persistent Aurora layout it is just a spinner block
 * (the header stays put); standalone it fills the screen on the Aurora canvas. */
export function AuroraLoading({ label = "Loading…" }: { label?: string }) {
  const inLayout = useContext(AuroraLayoutContext);
  const body = (
    <div className={styles.splashBody}>
      <div className={styles.spinner} />
      <span>{label}</span>
    </div>
  );
  if (inLayout) return <div className={styles.loadingBlock}>{body}</div>;
  return (
    <div className={styles.page}>
      <div className={styles.splash}>{body}</div>
    </div>
  );
}
