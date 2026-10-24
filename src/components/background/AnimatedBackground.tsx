"use client";

import { usePathname } from "next/navigation";
import styles from "./AnimatedBackground.module.css";

export function AnimatedBackground() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <div className={styles.bg} aria-hidden="true">
      <div className={styles.glow + " " + styles.glowOne} />
      <div className={styles.glow + " " + styles.glowTwo} />
      <div className={styles.glow + " " + styles.glowThree} />
    </div>
  );
}
