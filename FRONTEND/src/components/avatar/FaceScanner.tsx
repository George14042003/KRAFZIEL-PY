"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarParams } from "@/lib/avatarTypes";
import {
  buildFaceMesh,
  captureFrame,
  deriveAvatarParams,
  frameCanvas,
  FRONT_TOLERANCE,
  HOLD_MS,
  loadFaceLandmarker,
  MIN_FACE_WIDTH,
  PITCH_THRESHOLD,
  readFace,
  SCAN_STEPS,
  YAW_THRESHOLD,
  type FaceReading,
  type ScanAngle,
} from "@/lib/faceScan";
import styles from "./FaceScanner.module.css";

export type FaceScanResult = {
  shots: { angle: ScanAngle; blob: Blob }[];
  params: AvatarParams;
};

type Phase = "loading" | "camera-error" | "scanning" | "done";

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

/** Guided five-angle face capture. Owns its own camera stream (a second stream on
 * the same device is fine alongside proctoring) and releases it when finished. */
export function FaceScanner({
  onComplete,
  onCancel,
  subtitle,
}: {
  onComplete: (result: FaceScanResult) => void;
  onCancel?: () => void;
  subtitle?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [hold, setHold] = useState(0); // 0..1 progress of the current hold
  const [faceSeen, setFaceSeen] = useState(false);
  const [flash, setFlash] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const run = useRef({
    stepIdx: 0,
    holdStart: 0,
    stepStart: 0,
    sideSign: 0,
    pitchSign: 0,
    pause: 0,
    shots: [] as { angle: ScanAngle; blob: Blob }[],
    params: null as AvatarParams | null,
    frontFrames: [] as FaceReading["landmarks"][],
    finished: false,
  });

  const stopStream = useCallback(() => {
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null | undefined;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let lastDetect = 0;
    const state = run.current;
    state.stepIdx = 0;
    state.holdStart = 0;
    state.stepStart = performance.now();
    state.sideSign = 0;
    state.pitchSign = 0;
    state.pause = 0;
    state.shots = [];
    state.params = null;
    state.frontFrames = [];
    state.finished = false;

    async function start() {
      try {
        const [landmarker, stream] = await Promise.all([
          loadFaceLandmarker(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
            audio: false,
          }),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setPhase("scanning");

        const tick = () => {
          raf = requestAnimationFrame(tick);
          const now = performance.now();
          if (now - lastDetect < 60 || state.finished || video.readyState < 2) return;
          lastDetect = now;
          let reading: FaceReading | null = null;
          try {
            reading = readFace(landmarker, video);
          } catch {
            return;
          }
          void handleReading(reading, now);
        };

        const handleReading = async (reading: FaceReading | null, now: number) => {
          if (now < state.pause) return;
          if (!reading || reading.faceWidth < MIN_FACE_WIDTH || Math.abs(reading.centerX - 0.5) > 0.22) {
            state.holdStart = 0;
            setFaceSeen(!!reading);
            setHold(0);
            return;
          }
          setFaceSeen(true);
          const step = SCAN_STEPS[state.stepIdx];
          const { yaw, pitch } = reading;
          let ok = false;
          let magnitude = 0; // how far along the pose we are, 0..1, for the progress ring

          switch (step.angle) {
            case "front":
              ok = Math.abs(yaw) < FRONT_TOLERANCE && Math.abs(pitch) < FRONT_TOLERANCE;
              magnitude = ok ? 1 : 0.2;
              break;
            case "side_a":
              ok = Math.abs(yaw) >= YAW_THRESHOLD && Math.abs(pitch) < 22;
              magnitude = Math.min(1, Math.abs(yaw) / YAW_THRESHOLD);
              if (ok) state.sideSign = Math.sign(yaw);
              break;
            case "side_b":
              ok = yaw * state.sideSign <= -YAW_THRESHOLD && Math.abs(pitch) < 22;
              magnitude = Math.min(1, Math.max(0, (-yaw * state.sideSign) / YAW_THRESHOLD));
              break;
            case "up":
              ok = Math.abs(pitch) >= PITCH_THRESHOLD && Math.abs(yaw) < 20;
              magnitude = Math.min(1, Math.abs(pitch) / PITCH_THRESHOLD);
              if (ok) state.pitchSign = Math.sign(pitch);
              break;
            case "down":
              ok = pitch * state.pitchSign <= -PITCH_THRESHOLD && Math.abs(yaw) < 20;
              magnitude = Math.min(1, Math.max(0, (-pitch * state.pitchSign) / PITCH_THRESHOLD));
              break;
          }

          if (!ok) {
            state.holdStart = 0;
            // Ring fills with how close the pose is, so the person sees it registering.
            setHold(Math.min(0.85, magnitude * 0.85));
            setStuck(now - state.stepStart > 20000);
            return;
          }

          if (step.angle === "front" && state.frontFrames.length < 24) {
            state.frontFrames.push(reading.landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })));
          }
          if (!state.holdStart) state.holdStart = now;
          const progress = Math.min(1, (now - state.holdStart) / HOLD_MS);
          setHold(0.85 + progress * 0.15);
          if (progress < 1) return;

          // Step done: capture the frame (and derive the avatar from the front one).
          state.holdStart = 0;
          const blob = await captureFrame(video);
          if (blob) state.shots.push({ angle: step.angle, blob });
          if (step.angle === "front") {
            const canvas = frameCanvas(video, 640);
            if (canvas) {
              state.params = deriveAvatarParams(canvas, reading.landmarks);
              const mesh = buildFaceMesh(state.frontFrames, canvas.width, canvas.height);
              if (mesh) state.params.mesh = mesh;
            }
          }
          setFlash((n) => n + 1);
          setStuck(false);
          setHold(0);

          if (state.stepIdx + 1 >= SCAN_STEPS.length) {
            state.finished = true;
            if (!state.params) {
              setError("We couldn't read your face clearly. Please try again in better light.");
              setPhase("camera-error");
              return;
            }
            setStepIdx(SCAN_STEPS.length);
            setPhase("done");
            const result: FaceScanResult = { shots: state.shots, params: state.params };
            setTimeout(() => {
              if (!cancelled) onCompleteRef.current(result);
            }, 900);
            return;
          }
          state.stepIdx += 1;
          state.stepStart = now;
          state.pause = now + 700; // let them see the confirmation before the next prompt
          setStepIdx(state.stepIdx);
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
              : "We couldn't start the face scanner. Check your connection and try again."
        );
        setPhase("camera-error");
      }
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopStream();
    };
  }, [attempt, stopStream]);

  const step = SCAN_STEPS[Math.min(stepIdx, SCAN_STEPS.length - 1)];
  const completed = Math.min(stepIdx, SCAN_STEPS.length);
  const segLen = RING_C / SCAN_STEPS.length;

  return (
    <div className={styles.root}>
      <div className={styles.stage}>
        <video ref={videoRef} className={styles.video} muted playsInline />
        <div className={styles.vignette} />

        {phase === "scanning" && <div className={styles.scanline} />}

        <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true">
          <g transform="rotate(-90 50 50)">
            {SCAN_STEPS.map((s, i) => {
              const done = i < completed;
              const active = i === stepIdx && phase === "scanning";
              const fill = active ? hold * (segLen - 3) : 0;
              return (
                <g key={s.angle}>
                  <circle
                    cx="50"
                    cy="50"
                    r={RING_R}
                    className={styles.ringTrack}
                    strokeDasharray={`${segLen - 3} ${RING_C - segLen + 3}`}
                    strokeDashoffset={-i * segLen}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={RING_R}
                    className={done ? styles.ringDone : styles.ringActive}
                    strokeDasharray={`${done ? segLen - 3 : fill} ${RING_C}`}
                    strokeDashoffset={-i * segLen}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {flash > 0 && <div key={flash} className={styles.flash} />}

        {phase === "loading" && (
          <div className={styles.overlay}>
            <div className={styles.spinner} />
            <span>Starting face scanner…</span>
          </div>
        )}

        {phase === "done" && (
          <div className={styles.overlay}>
            <div className={styles.check}>
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <span>Scan complete</span>
          </div>
        )}

        {phase === "camera-error" && (
          <div className={styles.overlay}>
            <span className={styles.errorText}>{error}</span>
            <button
              type="button"
              className={styles.retry}
              onClick={() => {
                setError(null);
                setPhase("loading");
                setStepIdx(0);
                setHold(0);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <div className={styles.panel} aria-live="polite">
        {phase === "scanning" ? (
          <>
            <span className={styles.stepCount}>
              Step {stepIdx + 1} of {SCAN_STEPS.length}
            </span>
            <h3 className={styles.title}>{step.title}</h3>
            <p className={styles.hint}>
              {!faceSeen ? "We can't see your face — move into the frame and face the light." : step.hint}
            </p>
            {stuck && (
              <p className={styles.nudge}>Having trouble? Sit a little further back with light on your face.</p>
            )}
          </>
        ) : (
          subtitle && <p className={styles.hint}>{subtitle}</p>
        )}

        <ol className={styles.dots}>
          {SCAN_STEPS.map((s, i) => (
            <li
              key={s.angle}
              className={i < completed ? styles.dotDone : i === stepIdx && phase === "scanning" ? styles.dotActive : styles.dot}
            />
          ))}
        </ol>

        {onCancel && phase !== "done" && (
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
