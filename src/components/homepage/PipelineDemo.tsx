"use client";

import { useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import styles from "./PipelineDemo.module.css";

const STAGES = ["Sourced", "AI Screened", "Live Interview", "Offer"] as const;

type Candidate = { id: string; name: string; initials: string; color: string; stage: number };

const INITIAL_CANDIDATES: Candidate[] = [
  { id: "1", name: "Amara Okafor", initials: "AO", color: "#0891b2", stage: 0 },
  { id: "2", name: "Diego Ramirez", initials: "DR", color: "#10b981", stage: 1 },
  { id: "3", name: "Priya Shah", initials: "PS", color: "#7c3aed", stage: 2 },
  { id: "4", name: "Sam Rivera", initials: "SR", color: "#f59e0b", stage: 1 },
];

export function PipelineDemo() {
  const [candidates, setCandidates] = useState(INITIAL_CANDIDATES);

  function advance(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, stage: Math.min(c.stage + 1, STAGES.length - 1) } : c))
    );
  }

  function reset() {
    setCandidates(INITIAL_CANDIDATES);
  }

  return (
    <div className={`${aurora.glass} ${styles.wrap}`}>
      <div className={styles.header}>
        <span className={styles.badge}>Try it yourself</span>
        <button type="button" className={styles.resetBtn} onClick={reset}>
          Reset demo
        </button>
      </div>

      <div className={styles.board}>
        {STAGES.map((stage, stageIndex) => {
          const inStage = candidates.filter((c) => c.stage === stageIndex);
          return (
            <div key={stage} className={styles.column}>
              <div className={styles.columnHeader}>
                <span>{stage}</span>
                <span className={styles.columnCount}>{inStage.length}</span>
              </div>
              <div className={styles.columnBody}>
                {inStage.length === 0 && <div className={styles.empty}>—</div>}
                {inStage.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.card}
                    onClick={() => advance(c.id)}
                    disabled={stageIndex === STAGES.length - 1}
                    title={stageIndex === STAGES.length - 1 ? `${c.name} — offer extended` : `Click to move ${c.name} forward`}
                  >
                    <span className={styles.avatar} style={{ background: c.color }}>
                      {c.initials}
                    </span>
                    <span className={styles.cardName}>{c.name}</span>
                    {stageIndex < STAGES.length - 1 && <span className={styles.cardArrow}>→</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.hint}>Click any candidate card to move them to the next stage — this is exactly how your team&apos;s live pipeline works.</p>
    </div>
  );
}
