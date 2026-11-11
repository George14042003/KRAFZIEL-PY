"use client";

import dynamic from "next/dynamic";
import type { AvatarMode, AvatarParams } from "@/lib/avatarTypes";
import styles from "./TwinStage.module.css";

// three.js is large and WebGL-only: load it on the client when the stage first renders.
const TwinAvatar3D = dynamic(() => import("./TwinAvatar3D").then((m) => m.TwinAvatar3D), {
  ssr: false,
  loading: () => <div className={styles.loading} />,
});

/** The twin on a soft stage with a live notes sidebar — the God level interview's "interviewer". */
export function TwinStage({
  params,
  name,
  mode,
  mouthShape,
  notes,
  noteBeat,
  question,
}: {
  params: AvatarParams;
  name: string;
  mode: AvatarMode;
  mouthShape?: number;
  notes: string[];
  noteBeat: number;
  question?: string;
}) {
  const status =
    mode === "speaking" ? "Asking" : mode === "noting" ? "Taking notes" : mode === "listening" ? "Listening" : "Ready";
  return (
    <div className={styles.stage}>
      <div className={styles.avatar}>
        <TwinAvatar3D params={params} mode={mode} mouthShape={mouthShape} noteBeat={noteBeat} notes={notes} />
        <div className={styles.nameplate}>
          <span className={`${styles.dot} ${mode === "speaking" ? styles.dotLive : ""}`} />
          <span className={styles.name}>{name}</span>
          <span className={styles.badge}>AI twin</span>
          <span className={styles.status}>{status}</span>
        </div>
      </div>
      <aside className={styles.notes} aria-label="Interviewer notes">
        <span className={styles.notesTitle}>Notes</span>
        {notes.length === 0 ? (
          <p className={styles.empty}>{mode === "speaking" ? "Listening for your answer next…" : "Key points appear here as you answer."}</p>
        ) : (
          <ul>
            {notes.map((n, i) => (
              <li key={`${i}-${n}`} className={i === notes.length - 1 ? styles.newest : undefined}>
                {n}
              </li>
            ))}
          </ul>
        )}
        {question && <span className={styles.qTag}>Q: {question.length > 70 ? `${question.slice(0, 68)}…` : question}</span>}
      </aside>
    </div>
  );
}
