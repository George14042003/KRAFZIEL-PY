"use client";

import { useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/aurora/CountUp";
import aurora from "@/components/aurora/aurora.module.css";
import { getPublicStats } from "@/lib/publicStats";
import styles from "./AnimatedStats.module.css";

const CARD_TONES = ["cardAccent", "cardViolet", "cardGlass", "cardGlass"] as const;

function StatCard({ label, target, active, suffix = "", tone }: { label: string; target: number; active: boolean; suffix?: string; tone: number }) {
  const toneClass = styles[CARD_TONES[tone % CARD_TONES.length]];
  return (
    <div className={`${aurora.glass} ${aurora.lift} ${styles.card} ${toneClass}`}>
      <div className={styles.value}>
        {active ? <CountUp value={target} /> : 0}
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
      <StatCard tone={0} label="Organizations hiring on Krafziel" target={stats.organizations_count} active={active} />
      <StatCard tone={1} label="Candidates in the pipeline" target={stats.candidates_count} active={active} suffix="+" />
      <StatCard tone={2} label="AI interviews completed" target={stats.interviews_completed_count} active={active} />
      <StatCard tone={3} label="Jobs posted" target={stats.jobs_posted_count} active={active} />
    </div>
  );
}
