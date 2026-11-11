import type { FaceReading } from "@/lib/faceScan";

/** Four-corner face verification. The candidate faces a centre dot, then turns toward each screen corner
 * in a random order. Everything is measured as a ratio of the face's own size, so it behaves the same on any
 * camera resolution, screen size or distance from the screen. */

export type CornerId = "top_left" | "top_right" | "bottom_right" | "bottom_left";
export type VerifyAngle = "center" | CornerId;

export const CORNERS: CornerId[] = ["top_left", "top_right", "bottom_right", "bottom_left"];

/** Screen direction of each corner: -1 = left/up, +1 = right/down. */
export const CORNER_DIRECTION: Record<CornerId, { sx: -1 | 1; sy: -1 | 1 }> = {
  top_left: { sx: -1, sy: -1 },
  top_right: { sx: 1, sy: -1 },
  bottom_right: { sx: 1, sy: 1 },
  bottom_left: { sx: -1, sy: 1 },
};

export const CORNER_LABEL: Record<CornerId, string> = {
  top_left: "top-left",
  top_right: "top-right",
  bottom_right: "bottom-right",
  bottom_left: "bottom-left",
};

/** How far the nose must move from its centred position, as a fraction of face width / height. */
export const TURN_X = 0.06;
export const TURN_Y = 0.03;
/** The face must stay at least this wide (fraction of the frame) while turning. */
export const MIN_FACE = 0.12;
/** Centred pose must be within these ratios of straight-on to count as the calibration step. */
export const CENTER_TOLERANCE_X = 0.035;
export const CENTER_TOLERANCE_Y = 0.02;
export const HOLD_MS = 650;
export const CENTER_FRAMES = 6;

export type NosePose = { x: number; y: number };

/** Nose position relative to the face box (landmark indices from MediaPipe's 478-point mesh). */
export function nosePose(reading: FaceReading): NosePose | null {
  const lm = reading.landmarks;
  const nose = lm[1];
  const left = lm[234];
  const right = lm[454];
  const top = lm[10];
  const chin = lm[152];
  const width = Math.abs(right.x - left.x);
  const height = Math.abs(chin.y - top.y);
  if (!nose || width < 0.01 || height < 0.01) return null;
  return {
    x: (nose.x - (left.x + right.x) / 2) / width,
    y: (nose.y - (top.y + chin.y) / 2) / height,
  };
}

/** 0..1 progress toward looking at a corner, and whether the pose is there. The camera frame is unmirrored
 * while the preview is mirrored, so turning toward a screen-right corner moves the nose left in the raw frame. */
export function cornerProgress(pose: NosePose, base: NosePose, corner: CornerId): { progress: number; reached: boolean } {
  const { sx, sy } = CORNER_DIRECTION[corner];
  const dx = (pose.x - base.x) * -sx;
  const dy = (pose.y - base.y) * sy;
  const px = Math.max(0, Math.min(1, dx / TURN_X));
  const py = Math.max(0, Math.min(1, dy / TURN_Y));
  return { progress: Math.min(px, py), reached: px >= 1 && py >= 1 };
}

export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
