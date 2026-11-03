"use client";

import { useEffect, useRef, useState } from "react";
import { loadFaceLandmarker, readFace } from "@/lib/faceScan";
import { playWarningSound } from "@/lib/warningSound";

export type LookAwayReason = "turned" | "no_face";
export type LookAwayWarning = { n: number; reason: LookAwayReason; at: number };

/** Degrees the head may turn from where it was at the start before it counts as looking away. */
const YAW_LIMIT = 28;
const PITCH_LIMIT = 22;
// How far off-centre the starting pose may be (camera offset) before it is not trusted as the baseline.
const BASE_YAW_TOLERANCE = 12;
const BASE_PITCH_TOLERANCE = 15;
const MIN_FACE_WIDTH = 0.08;
const CHECK_EVERY_MS = 250;
const CALIBRATION_SAMPLES = 8;
const CALIBRATION_MAX_MS = 6000;
/** How long the person must stay turned away / out of frame before it counts. */
const TURNED_MS = 1500;
const NO_FACE_MS = 2500;
/** While someone stays away, they are warned again this often; after coming back, a new episode warns at once. */
const REPEAT_WARNING_MS = 6000;
const RETURN_MS = 800;
/** Never two warnings closer together than this, however quickly someone looks away and back. */
const MIN_GAP_MS = 3000;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

type Options = {
  /** Watching only runs while this is true (during the questions). */
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Warnings allowed. The warning after this many ends the interview. */
  maxWarnings: number;
  onExceeded: () => void;
};

/** Counts how many times the candidate turns their face away from the screen (or leaves the frame) and plays a
 * warning sound each time. Head direction is measured against their own starting pose, so it works wherever
 * their camera sits. Everything runs in the browser. */
export function useLookAwayWarnings({ active, videoRef, maxWarnings, onExceeded }: Options) {
  const [warnings, setWarnings] = useState(0);
  const [latest, setLatest] = useState<LookAwayWarning | null>(null);
  const [calibrated, setCalibrated] = useState(false);
  const exceededRef = useRef(onExceeded);
  const maxRef = useRef(maxWarnings);

  useEffect(() => {
    exceededRef.current = onExceeded;
    maxRef.current = maxWarnings;
  });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const yaws: number[] = [];
    const pitches: number[] = [];
    let base: { yaw: number; pitch: number } | null = null;
    let calibrationStart = 0;
    let awaySince = 0;
    let awayReason: LookAwayReason = "turned";
    let backSince = 0;
    let lastWarningAt = 0;
    let count = 0;
    let ended = false;

    loadFaceLandmarker()
      .then((landmarker) => {
        if (cancelled) return;
        calibrationStart = performance.now();
        timer = setInterval(() => {
          const video = videoRef.current;
          if (ended || !video || video.readyState < 2) return;
          const now = performance.now();
          let reading = null;
          try {
            reading = readFace(landmarker, video);
          } catch {
            return;
          }
          const present = !!reading && reading.faceWidth >= MIN_FACE_WIDTH;

          if (!base) {
            // The first moments of the interview define "looking at the screen" for this person and camera.
            if (present && reading) {
              yaws.push(reading.yaw);
              pitches.push(reading.pitch);
            }
            if (yaws.length >= CALIBRATION_SAMPLES || (now - calibrationStart > CALIBRATION_MAX_MS && yaws.length >= 3)) {
              // A start pose well off-centre (e.g. already turned toward a second screen) must not become
              // "straight": measure from dead centre instead.
              const yaw0 = median(yaws);
              const pitch0 = median(pitches);
              base = Math.abs(yaw0) > BASE_YAW_TOLERANCE || Math.abs(pitch0) > BASE_PITCH_TOLERANCE
                ? { yaw: 0, pitch: 0 }
                : { yaw: yaw0, pitch: pitch0 };
              setCalibrated(true);
            } else if (now - calibrationStart > CALIBRATION_MAX_MS) {
              // Never showed a face during calibration: hiding the camera from the start must not avoid warnings.
              // Fall back to "straight on" and let the missing-face rule below warn.
              base = { yaw: 0, pitch: 0 };
              setCalibrated(true);
            }
            return;
          }

          const turned = present && !!reading && (Math.abs(reading.yaw - base.yaw) > YAW_LIMIT || Math.abs(reading.pitch - base.pitch) > PITCH_LIMIT);
          const away = !present || turned;

          if (!away) {
            if (!backSince) backSince = now;
            if (awaySince && now - backSince >= RETURN_MS) awaySince = 0;
            return;
          }
          backSince = 0;
          if (!awaySince) {
            awaySince = now;
            awayReason = present ? "turned" : "no_face";
          }
          const needed = awayReason === "no_face" ? NO_FACE_MS : TURNED_MS;
          if (now - awaySince < needed) return;
          if (lastWarningAt && now - lastWarningAt < MIN_GAP_MS) return;
          // First warning of an episode fires once the threshold passes; staying away repeats it slowly.
          if (lastWarningAt && lastWarningAt >= awaySince && now - lastWarningAt < REPEAT_WARNING_MS) return;

          lastWarningAt = now;
          count += 1;
          setWarnings(count);
          setLatest({ n: count, reason: awayReason, at: Date.now() });
          playWarningSound();
          if (count > maxRef.current) {
            ended = true;
            exceededRef.current();
          }
        }, CHECK_EVERY_MS);
      })
      .catch(() => {
        // If the face model can't load (offline, blocked CDN) the other proctoring checks still run.
      });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [active, videoRef]);

  return { warnings, latest, calibrated, remaining: Math.max(0, maxWarnings - warnings) };
}
