"use client";

import { useState } from "react";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import styles from "@/components/aurora/aurora.module.css";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useSession } from "@/hooks/useSession";
import local from "./tutorial.module.css";

const STEPS = [
  {
    tag: "Overview",
    title: "How the NAIE engine works",
    desc: "A bird's-eye view of the interview engine.",
    headline: "Here's how the NAIE engine works.",
    body: "NAIE runs structured, conversational interviews on your behalf, adapting to each candidate and handing you a clear, comparable result.",
  },
  {
    tag: "Questioned",
    title: "How candidates are asked",
    desc: "Role-aware questions, asked one at a time.",
    headline: "Every candidate gets the right questions.",
    body: "Questions are drawn from the role and adapt with follow-ups based on what the candidate says, so each interview stays relevant and fair.",
  },
  {
    tag: "Evaluated",
    title: "How answers are scored",
    desc: "Consistent scoring against clear criteria.",
    headline: "Answers are scored, not guessed.",
    body: "Each response is assessed against the same criteria, producing transparent scores and evidence you can review side by side.",
  },
  {
    tag: "Guided",
    title: "How candidates are led through",
    desc: "A calm, guided experience start to finish.",
    headline: "Candidates are guided every step.",
    body: "The engine explains what to expect, keeps the pace comfortable and wraps up cleanly, so candidates always know where they are.",
  },
  {
    tag: "Finish",
    title: "Review the outcome",
    desc: "Recordings, scores and next actions.",
    headline: "Review the outcome and decide.",
    body: "Open the candidate profile to see recordings, scores and notes, then move them forward with a status change or an offer.",
  },
];

export function TutorialClient() {
  const { user, loading } = useSession("employer");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <DashboardShell user={user}>
      <AuroraPageHeader
        eyebrow="Tutorial"
        title="See the AI interview engine in action."
        subtitle="A walkthrough of how candidates are questioned, evaluated, and guided through the NAIE interview engine — start to finish."
      />

      <div className={local.layout}>
        <div className={`${styles.glass} ${local.player}`}>
          {playing ? (
            <div className={local.video}>
              <video src="/videos/ai-interview-engine-explainer.mp4" controls autoPlay playsInline aria-label="AI interview engine explainer" />
              <div>
                <button type="button" className={local.play} onClick={() => setPlaying(false)} style={{ padding: "0 26px" }}>
                  Back to steps
                </button>
              </div>
            </div>
          ) : (
            <div className={local.stage}>
              <span className={`${local.ring} ${local.ringA}`} aria-hidden="true" />
              <span className={`${local.ring} ${local.ringB}`} aria-hidden="true" />
              <div className={local.brandRow}>
                <span className={local.brandMark}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--on-accent)" aria-hidden="true">
                    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                  </svg>
                </span>
                KRAFZIEL · AI INTERVIEW ENGINE
              </div>
              <div key={step} className={local.stageBody}>
                <span className={local.stepPill}>{current.tag}</span>
                <h2 className={`${styles.display} ${local.stageTitle}`}>{current.headline}</h2>
                <p className={local.stageText}>{current.body}</p>
                <button type="button" className={local.play} onClick={() => setPlaying(true)}>
                  Play walkthrough
                  <span className={local.playCircle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden="true">
                      <path d="M7 4l13 8-13 8z" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className={local.foot}>
            <span className={local.footCount}>
              Step {step + 1} of {STEPS.length}
            </span>
            <div className={`${styles.bar} ${local.footBar}`}>
              <i style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "var(--accent)" }} />
            </div>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGlass} ${local.next}`}
              onClick={() => setStep(last ? 0 : step + 1)}
            >
              {last ? "Start over" : "Next step →"}
            </button>
          </div>
        </div>

        <aside className={`${styles.glass} ${local.aside}`}>
          <div className={styles.sideLabel}>Walkthrough</div>
          {STEPS.map((s, i) => (
            <button
              key={s.tag}
              type="button"
              className={`${local.step} ${i === step ? local.stepOn : ""}`}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={local.stepNum}>{i + 1}</span>
              <span>
                <span className={local.stepTitle} style={{ display: "block" }}>
                  {s.title}
                </span>
                <span className={local.stepDesc} style={{ display: "block" }}>
                  {s.desc}
                </span>
              </span>
            </button>
          ))}
        </aside>
      </div>
    </DashboardShell>
  );
}
