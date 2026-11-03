"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { captureFrame, loadFaceLandmarker, readFace, type FaceReading } from "@/lib/faceScan";
import {
  CENTER_FRAMES,
  CORNER_LABEL,
  CORNERS,
  cornerProgress,
  HOLD_MS,
  MIN_FACE,
  nosePose,
  shuffled,
  type CornerId,
  type NosePose,
  type VerifyAngle,
} from "@/lib/cornerVerify";
import styles from "./CornerVerification.module.css";

export type CornerShot = { angle: VerifyAngle; blob: Blob };

type Phase = "loading" | "error" | "scanning" | "done";

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;
const CENTER_POSE_LIMIT = 12; // degrees of yaw / pitch that still count as "looking straight"

/** Full-screen face verification: look at the centre, then turn toward each of the four screen corners.
 * Layout is entirely percentage / viewport based, so it adapts to any screen size or orientation, and the
 * pose checks are ratios of the face itself, so they don't depend on camera resolution. Owns its own camera
 * stream and releases it when it unmounts. */
export function CornerVerification({ onComplete }: { onComplete: (shots: CornerShot[]) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [value, setValue] = useState(0); // 0..1 progress of the active step, drives the ring
  const [faceSeen, setFaceSeen] = useState(true);
  const [flash, setFlash] = useState(0);
  const [stuck, setStuck] = useState(false);

  // Random corner order each time, so a pre-recorded clip can't be replayed to pass.
  const sequence = useMemo<VerifyAngle[]>(() => ["center", ...shuffled(CORNERS)], [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let lastDetect = 0;
    let idx = 0;
    let holdStart = 0;
    let stepStart = performance.now();
    let pauseUntil = 0;
    let finished = false;
    let base: NosePose | null = null;
    const centerPoses: NosePose[] = [];
    const shots: CornerShot[] = [];

    const stopStream = () => {
      const v = videoRef.current;
      (v?.srcObject as MediaStream | null | undefined)?.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    };

    async function start() {
      try {
        const [landmarkerResult, streamResult] = await Promise.allSettled([
          loadFaceLandmarker(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
            audio: false,
          }),
        ]);
        // A granted camera must be released when the model failed to load (or we were cancelled / have no
        // <video>), otherwise the camera stays on and every retry leaks another stream.
        const stream = streamResult.status === "fulfilled" ? streamResult.value : null;
        const video = videoRef.current;
        if (cancelled || landmarkerResult.status === "rejected" || streamResult.status === "rejected" || !video) {
          stream?.getTracks().forEach((t) => t.stop());
          if (cancelled) return;
          if (landmarkerResult.status === "rejected") throw landmarkerResult.reason;
          if (streamResult.status === "rejected") throw streamResult.reason;
          return;
        }
        const landmarker = landmarkerResult.value;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setPhase("scanning");
        stepStart = performance.now();

        const advance = async (now: number, reading: FaceReading) => {
          holdStart = 0;
          pauseUntil = Infinity; // no second capture while this one is in flight
          const blob = await captureFrame(video);
          if (!blob) {
            pauseUntil = 0;
            return;
          }
          shots.push({ angle: sequence[idx], blob });
          setFlash((n) => n + 1);
          setValue(0);
          setStuck(false);
          if (idx + 1 >= sequence.length) {
            finished = true;
            setStepIdx(sequence.length);
            setPhase("done");
            setTimeout(() => {
              if (!cancelled) onCompleteRef.current(shots);
            }, 700);
            return;
          }
          idx += 1;
          stepStart = now;
          pauseUntil = now + 700; // let the confirmation register before the next target appears
          setStepIdx(idx);
          void reading;
        };

        const handle = (reading: FaceReading | null, now: number) => {
          if (now < pauseUntil || finished) return;
          if (!reading || reading.faceWidth < MIN_FACE) {
            holdStart = 0;
            centerPoses.length = 0;
            setFaceSeen(false);
            setValue(0);
            return;
          }
          setFaceSeen(true);
          const pose = nosePose(reading);
          if (!pose) return;
          const angle = sequence[idx];

          let reached = false;
          let progress = 0;
          if (angle === "center") {
            const straight = Math.abs(reading.yaw) < CENTER_POSE_LIMIT && Math.abs(reading.pitch) < CENTER_POSE_LIMIT;
            if (straight) {
              centerPoses.push(pose);
              if (centerPoses.length > CENTER_FRAMES * 2) centerPoses.shift();
            } else {
              centerPoses.length = 0;
            }
            reached = straight && centerPoses.length >= CENTER_FRAMES;
            progress = straight ? Math.min(1, centerPoses.length / CENTER_FRAMES) : 0;
          } else if (base) {
            ({ progress, reached } = cornerProgress(pose, base, angle));
          }

          if (!reached) {
            holdStart = 0;
            setValue(progress * 0.7);
            setStuck(now - stepStart > 15000);
            return;
          }
          if (!holdStart) holdStart = now;
          const held = Math.min(1, (now - holdStart) / HOLD_MS);
          setValue(0.7 + held * 0.3);
          if (held < 1) return;

          if (angle === "center") {
            const n = centerPoses.length;
            base = {
              x: centerPoses.reduce((s, p) => s + p.x, 0) / n,
              y: centerPoses.reduce((s, p) => s + p.y, 0) / n,
            };
          }
          void advance(now, reading);
        };

        const tick = () => {
          raf = requestAnimationFrame(tick);
          const now = performance.now();
          if (now - lastDetect < 60 || finished || video.readyState < 2) return;
          lastDetect = now;
          let reading: FaceReading | null = null;
          try {
            reading = readFace(landmarker, video);
          } catch {
            return;
          }
          handle(reading, now);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera in your browser's address bar, then try again."
            : name === "NotFoundError"
              ? "No camera was found on this device."
              : "We couldn't start the face verification. Check your connection and try again."
        );
        setPhase("error");
      }
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopStream();
    };
  }, [attempt, sequence]);

  const current = sequence[Math.min(stepIdx, sequence.length - 1)];
  const doneAngles = new Set(sequence.slice(0, stepIdx));
  const scanning = phase === "scanning";

  let title = "Starting camera…";
  let hint = "";
  if (scanning) {
    if (current === "center") {
      title = "Look straight at the screen";
      hint = "Sit comfortably and keep your face inside the circle. Hold still for a moment.";
    } else {
      title = `Turn your face toward the ${CORNER_LABEL[current]} corner`;
      hint = "Follow the glowing dot with your head, keeping your face in view of the camera. Hold it there until it turns green.";
    }
  } else if (phase === "done") {
    title = "Verification complete";
    hint = "Thanks. Your interview is about to begin.";
  }

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Face verification">
      {CORNERS.map((c: CornerId) => {
        const isActive = scanning && current === c;
        const isDone = doneAngles.has(c) || phase === "done";
        return (
          <div key={c} className={`${styles.corner} ${styles[c]} ${isActive ? styles.cornerActive : ""} ${isDone ? styles.cornerDone : ""}`} aria-hidden="true">
            {isActive && (
              <svg className={styles.ringSvg} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={RING_R} className={styles.ringTrack} />
                <circle cx="50" cy="50" r={RING_R} className={styles.ringFill} strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - value)} />
              </svg>
            )}
            {isDone ? (
              <svg className={styles.tick} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <span className={styles.cornerDot} />
            )}
          </div>
        );
      })}

      <div className={styles.center} aria-live="polite">
        <div className={`${styles.faceWrap} ${scanning && faceSeen && value >= 0.7 ? styles.faceOk : ""}`}>
          <video ref={videoRef} className={styles.video} muted playsInline />
          {flash > 0 && <div key={flash} className={styles.flash} />}
        </div>

        {phase === "loading" && <div className={styles.spinner} />}

        {phase === "error" ? (
          <>
            <p className={styles.error}>{error}</p>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                setError(null);
                setPhase("loading");
                setStepIdx(0);
                setValue(0);
                setStuck(false);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            {scanning && (
              <span className={styles.step}>
                Step {Math.min(stepIdx + 1, sequence.length)} of {sequence.length}
              </span>
            )}
            <h2 className={styles.title}>{title}</h2>
            {hint && <p className={styles.hint}>{hint}</p>}
            {scanning && !faceSeen && <p className={styles.warn}>We can&apos;t see your face. Move back into view and face the light.</p>}
            {scanning && faceSeen && stuck && current !== "center" && (
              <p className={styles.warn}>Turn a little further toward the glowing dot, and keep your eyes on it.</p>
            )}
            <ol className={styles.dots} aria-hidden="true">
              {sequence.map((a, i) => (
                <li key={a} className={i < stepIdx || phase === "done" ? styles.done : i === stepIdx && scanning ? styles.on : ""} />
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
