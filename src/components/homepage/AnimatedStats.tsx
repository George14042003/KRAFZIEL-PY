"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicStats } from "@/lib/publicStats";
import styles from "./AnimatedStats.module.css";

const COUNT_UP_MS = 1400;

function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current || target <= 0) return;
    startedRef.current = true;
    const start = performance.now();
    let frame: number;
    function tick(now: number) {
      const progress = Math.min((now - start) / COUNT_UP_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target]);

  return value;
}

function StatCard({ label, target, active, suffix = "" }: { label: string; target: number; active: boolean; suffix?: string }) {
  const value = useCountUp(target, active);
  return (
    <div className={styles.card}>
      <div className={styles.value}>
        {value.toLocaleString()}
        {suffix}
      </div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}

export function AnimatedStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [stats, setStats] = useState<{
    organizations_count: number;
    candidates_count: number;
    interviews_completed_count: number;
    jobs_posted_count: number;
  } | null>(null);

  useEffect(() => {
    getPublicStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!stats) return <div ref={ref} className={styles.strip} />;

  return (
    <div ref={ref} className={styles.strip}>
      <StatCard label="Organizations hiring on Nextenti" target={stats.organizations_count} active={active} />
      <StatCard label="Candidates in the pipeline" target={stats.candidates_count} active={active} suffix="+" />
      <StatCard label="AI interviews completed" target={stats.interviews_completed_count} active={active} />
      <StatCard label="Jobs posted" target={stats.jobs_posted_count} active={active} />
    </div>
  );
}
