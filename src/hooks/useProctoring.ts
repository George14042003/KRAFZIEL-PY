"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProctorViolation = "tab_switch" | "window_blur" | "face_not_detected" | "screen_share_stopped";

type FaceDetectorLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { detections: unknown[] };
};

const MODEL_ASSET_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MISSED_FACE_THRESHOLD = 5; // consecutive ~1s checks (≈5s) with no face before flagging

// The MediaPipe/TFLite WASM runtime logs a one-time, harmless "which backend
// did I pick" info line (e.g. "Created TensorFlow Lite XNNPACK delegate for
// CPU.") via console.error, not console.info — this trips Next.js's dev
// error overlay and blocks the whole screen even though nothing failed.
// Filter out just that known-benign message; everything else still surfaces.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  interface Window {
    __naieConsoleErrorPatched?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__naieConsoleErrorPatched) {
  window.__naieConsoleErrorPatched = true;
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && /XNNPACK delegate|TensorFlow Lite/i.test(first)) {
      return;
    }
    originalConsoleError(...args);
  };
}

type UseProctoringOptions = {
  /** Monitoring (tab-switch, face presence) only runs while this is true. */
  active: boolean;
  onViolation: (reason: ProctorViolation) => void;
};

export function useProctoring({ active, onViolation }: UseProctoringOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const faceDetectorRef = useRef<FaceDetectorLike | null>(null);
  const missedFaceCountRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [screenReady, setScreenReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);

  const requestCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch {
      setCameraError("Camera access is required to continue. Please allow camera permission and try again.");
      setCameraReady(false);
    }
  }, []);

  const requestScreenShare = useCallback(async () => {
    setScreenError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      const [track] = stream.getVideoTracks();
      track.addEventListener("ended", () => {
        setScreenReady(false);
        onViolation("screen_share_stopped");
      });
      setScreenReady(true);
    } catch {
      setScreenError("Screen sharing is required to continue. Please share your screen and try again.");
      setScreenReady(false);
    }
  }, [onViolation]);

  // Lazily load the face-detection model once the camera is live.
  useEffect(() => {
    if (!cameraReady) return;
    let cancelled = false;
    (async () => {
      try {
        const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate: "CPU" },
          runningMode: "VIDEO",
        });
        if (!cancelled) {
          faceDetectorRef.current = detector as unknown as FaceDetectorLike;
          setModelReady(true);
        }
      } catch {
        // Face-presence checking is best-effort; if the model fails to load
        // (offline, blocked CDN) we simply skip that check and keep tab-switch
        // + screen-share monitoring active.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cameraReady]);

  // Tab-switch / window-blur monitoring.
  useEffect(() => {
    if (!active) return;
    function handleVisibility() {
      if (document.hidden) onViolation("tab_switch");
    }
    function handleBlur() {
      onViolation("window_blur");
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [active, onViolation]);

  // Face-presence polling.
  useEffect(() => {
    if (!active || !cameraReady || !modelReady) return;
    missedFaceCountRef.current = 0;
    const id = setInterval(() => {
      const detector = faceDetectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2) return;
      try {
        const result = detector.detectForVideo(video, performance.now());
        if (!result.detections || result.detections.length === 0) {
          missedFaceCountRef.current += 1;
        } else {
          missedFaceCountRef.current = 0;
        }
        if (missedFaceCountRef.current >= MISSED_FACE_THRESHOLD) {
          onViolation("face_not_detected");
        }
      } catch {
        // transient detection error — ignore this tick
      }
    }, 1000);
    return () => clearInterval(id);
  }, [active, cameraReady, modelReady, onViolation]);

  const stopAll = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
  }, []);

  useEffect(() => stopAll, [stopAll]);

  return {
    videoRef,
    cameraReady,
    screenReady,
    cameraError,
    screenError,
    modelReady,
    requestCamera,
    requestScreenShare,
    stopAll,
  };
}
