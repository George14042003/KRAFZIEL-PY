import {
  clampFace,
  DEFAULT_AVATAR,
  MESH_POINTS,
  type AvatarParams,
  type FacialHair,
  type HairStyle,
} from "@/lib/avatarTypes";

/** Multi-angle face capture for the God level interview tier. MediaPipe's face
 * landmarker gives 478 landmarks plus a head-pose matrix; we use the pose to
 * guide the person through five angles, and the front frame to derive the
 * stylized avatar's colours and proportions. Everything runs in the browser. */

export type ScanAngle = "front" | "side_a" | "side_b" | "up" | "down";

export type LandmarkPoint = { x: number; y: number; z: number };

type FaceLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => {
    faceLandmarks: LandmarkPoint[][];
    facialTransformationMatrixes?: { data: ArrayLike<number> }[];
  };
  close?: () => void;
};

const MODEL_ASSET_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
// Must match the installed @mediapipe/tasks-vision version.
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

// The TFLite runtime logs a harmless "Created TensorFlow Lite XNNPACK delegate"
// line through console.error, which trips the Next.js dev overlay. Same filter
// as hooks/useProctoring.ts (they share the guard flag).
declare global {
  interface Window {
    __naieConsoleErrorPatched?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__naieConsoleErrorPatched) {
  window.__naieConsoleErrorPatched = true;
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && /XNNPACK delegate|TensorFlow Lite/i.test(first)) return;
    originalConsoleError(...args);
  };
}

let landmarkerPromise: Promise<FaceLandmarkerLike> | null = null;

export function loadFaceLandmarker(): Promise<FaceLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      const make = (delegate: "GPU" | "CPU") =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
        });
      try {
        return (await make("GPU")) as unknown as FaceLandmarkerLike;
      } catch {
        return (await make("CPU")) as unknown as FaceLandmarkerLike;
      }
    })().catch((err) => {
      landmarkerPromise = null; // let the next attempt retry
      throw err;
    });
  }
  return landmarkerPromise;
}

export type FaceReading = {
  landmarks: LandmarkPoint[];
  /** Head turn in degrees. The sign depends on the camera mirroring, so the guided
   * flow only ever compares signs against each other, never against "left"/"right". */
  yaw: number;
  /** Head tilt in degrees (same sign caveat as yaw). */
  pitch: number;
  /** Face width as a fraction of the frame width (distance from the camera, roughly). */
  faceWidth: number;
  /** Face centre, 0..1 in frame coordinates. */
  centerX: number;
  centerY: number;
};

const RAD = 180 / Math.PI;

// MediaPipe requires strictly increasing timestamps across every caller of the shared landmarker.
let lastTimestamp = 0;

export function readFace(landmarker: FaceLandmarkerLike, video: HTMLVideoElement): FaceReading | null {
  lastTimestamp = Math.max(lastTimestamp + 1, Math.round(performance.now()));
  const result = landmarker.detectForVideo(video, lastTimestamp);
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length < 468) return null;

  let yaw = 0;
  let pitch = 0;
  const m = result.facialTransformationMatrixes?.[0]?.data;
  if (m && m.length >= 16) {
    // Column-major 4x4; column 2 is the head's forward axis in camera space.
    yaw = Math.atan2(m[8], m[10]) * RAD;
    pitch = Math.asin(Math.max(-1, Math.min(1, -m[9]))) * RAD;
  }

  const left = landmarks[234];
  const right = landmarks[454];
  return {
    landmarks,
    yaw,
    pitch,
    faceWidth: Math.abs(right.x - left.x),
    centerX: (left.x + right.x) / 2,
    centerY: (landmarks[10].y + landmarks[152].y) / 2,
  };
}

/** One frame of the video, downscaled, as a JPEG (kept small: five of them are uploaded). */
export function captureFrame(video: HTMLVideoElement, maxWidth = 480): Promise<Blob | null> {
  const canvas = frameCanvas(video, maxWidth);
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82));
}

export function frameCanvas(video: HTMLVideoElement, maxWidth = 640): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// ---------- Avatar derivation ----------

type RGB = [number, number, number];

function toHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Median colour of a small square patch (robust to specular highlights). */
function samplePatch(ctx: CanvasRenderingContext2D, w: number, h: number, nx: number, ny: number, radius: number): RGB | null {
  const cx = Math.round(nx * w);
  const cy = Math.round(ny * h);
  const r = Math.max(1, Math.round(radius));
  const x0 = Math.max(0, cx - r);
  const y0 = Math.max(0, cy - r);
  const x1 = Math.min(w, cx + r + 1);
  const y1 = Math.min(h, cy + r + 1);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  }
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}

function medianColor(colors: (RGB | null)[]): RGB | null {
  const valid = colors.filter((c): c is RGB => c !== null);
  if (!valid.length) return null;
  const med = (i: number) => valid.map((c) => c[i]).sort((p, q) => p - q)[valid.length >> 1];
  return [med(0), med(1), med(2)];
}

const HAIR_CHOICES: Record<string, string> = {
  black: "#1c1714",
  darkBrown: "#3b2c22",
  brown: "#5a3d2b",
  blond: "#b8925a",
  gray: "#8a8a8a",
};

function nearestHair(color: RGB): string {
  let best = HAIR_CHOICES.darkBrown;
  let bestDist = Infinity;
  for (const hex of Object.values(HAIR_CHOICES)) {
    const d = colorDistance(color, hexToRgb(hex));
    if (d < bestDist) {
      bestDist = d;
      best = hex;
    }
  }
  return best;
}

const EYE_CHOICES = ["#2e1f16", "#4a3426", "#6b4a2b", "#4f6b3a", "#3c6a8a", "#5b7a96", "#6b6f78"];

function nearestEye(color: RGB): string {
  let best = EYE_CHOICES[1];
  let bestDist = Infinity;
  for (const hex of EYE_CHOICES) {
    const d = colorDistance(color, hexToRgb(hex));
    if (d < bestDist) {
      bestDist = d;
      best = hex;
    }
  }
  return best;
}

const SHIRT_FALLBACKS = ["#2b3a5a", "#2f4a46", "#4a3550", "#394152"];

function pull(ratio: number, baseline: number, strength: number): number {
  // Damped deviation from the average face so a mis-calibrated baseline can't produce a caricature.
  return clampFace(1 + (ratio / baseline - 1) * strength);
}

/** Derive stylized avatar parameters from a front-facing frame + its landmarks.
 * Colours are sampled from the photo; proportions come from landmark ratios.
 * It is a best guess — the studio lets the person fine-tune everything. */
export function deriveAvatarParams(canvas: HTMLCanvasElement, lm: LandmarkPoint[]): AvatarParams {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const px = (a: number, b: number) => Math.hypot((lm[a].x - lm[b].x) * w, (lm[a].y - lm[b].y) * h);

  const faceW = px(234, 454);
  const faceH = px(10, 152);
  const patch = Math.max(2, faceW * 0.025);

  const params: AvatarParams = JSON.parse(JSON.stringify(DEFAULT_AVATAR));

  // --- proportions (baselines are typical landmark ratios; deviation is damped) ---
  const aspect = faceH / faceW;
  params.face.width = clampFace(1 + (1.38 / aspect - 1) * 0.9);
  params.face.height = clampFace(1 + (aspect / 1.38 - 1) * 0.6);
  params.face.jaw = pull(px(172, 397) / faceW, 0.8, 0.8);
  params.face.eyeSpacing = pull(px(133, 362) / faceW, 0.23, 0.7);
  params.face.mouthWidth = pull(px(61, 291) / faceW, 0.42, 0.7);
  params.face.noseWidth = pull(px(98, 327) / faceW, 0.26, 0.7);
  const browGap = (Math.abs(lm[105].y - lm[159].y) + Math.abs(lm[334].y - lm[386].y)) / 2;
  params.face.browHeight = pull((browGap * h) / faceH, 0.11, 0.6);

  if (!ctx) return params;

  // --- skin: cheeks + forehead ---
  const skin = medianColor([
    samplePatch(ctx, w, h, lm[50].x, lm[50].y, patch),
    samplePatch(ctx, w, h, lm[280].x, lm[280].y, patch),
    samplePatch(ctx, w, h, lm[151].x, lm[151].y, patch),
  ]);
  if (skin) {
    // Webcams under indoor light skew dark/flat — nudge toward a healthier, more even tone.
    const lift = luminance(skin) < 110 ? 1.18 : 1.05;
    params.skin = toHex(mix(skin, [255, 235, 215], 0.06).map((c) => c * lift) as RGB);
  }

  // --- hair: above the forehead, plus beside the face to guess length ---
  const topY = lm[10].y - (faceH * 0.1) / h;
  const hairTop = medianColor([
    samplePatch(ctx, w, h, lm[10].x, topY, patch),
    samplePatch(ctx, w, h, lm[10].x - (faceW * 0.14) / w, topY + 0.005, patch),
    samplePatch(ctx, w, h, lm[10].x + (faceW * 0.14) / w, topY + 0.005, patch),
  ]);
  const background = medianColor([
    samplePatch(ctx, w, h, 0.04, 0.06, patch * 1.5),
    samplePatch(ctx, w, h, 0.96, 0.06, patch * 1.5),
  ]);
  const skinRgb = skin ?? hexToRgb(DEFAULT_AVATAR.skin);
  let hairStyle: HairStyle = "short";
  if (hairTop) {
    const nearSkin = colorDistance(hairTop, skinRgb) < 38;
    const nearBackground = background ? colorDistance(hairTop, background) < 22 : false;
    if (nearSkin) {
      hairStyle = "bald";
    } else {
      params.hair = nearestHair(hairTop);
      const sideEye = samplePatch(ctx, w, h, lm[234].x - (faceW * 0.1) / w, lm[234].y, patch);
      const sideJaw = samplePatch(ctx, w, h, lm[172].x - (faceW * 0.08) / w, lm[172].y, patch);
      const hairy = (c: RGB | null) => !!c && colorDistance(c, hairTop) < 46 && colorDistance(c, skinRgb) > 40;
      if (hairy(sideJaw)) hairStyle = "long";
      else if (hairy(sideEye)) hairStyle = "medium";
      else hairStyle = nearBackground ? "buzz" : "short";
    }
  }
  params.hairStyle = hairStyle;

  // --- eyes: ring around the pupil, away from the dark centre ---
  const irisR = (Math.abs(lm[469].x - lm[471].x) * w) / 2;
  if (lm.length > 473 && irisR > 1.5) {
    const ring: (RGB | null)[] = [];
    for (const idx of [468, 473]) {
      for (const [dx, dy] of [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]]) {
        ring.push(samplePatch(ctx, w, h, lm[idx].x + (dx * irisR) / w, lm[idx].y + (dy * irisR) / h, Math.max(1, irisR * 0.18)));
      }
    }
    const eye = medianColor(ring);
    if (eye) params.eyes = nearestEye(eye);
  }

  // --- facial hair: chin/jaw darker than the cheeks ---
  const chin = medianColor([
    samplePatch(ctx, w, h, lm[200].x, lm[200].y - (faceH * 0.04) / h, patch),
    samplePatch(ctx, w, h, lm[149].x + (faceW * 0.04) / w, lm[149].y - (faceH * 0.03) / h, patch),
    samplePatch(ctx, w, h, lm[378].x - (faceW * 0.04) / w, lm[378].y - (faceH * 0.03) / h, patch),
  ]);
  let facialHair: FacialHair = "none";
  if (chin) {
    const drop = luminance(skinRgb) - luminance(chin);
    if (drop > 42) facialHair = "beard";
    else if (drop > 22) facialHair = "stubble";
  }
  params.facialHair = facialHair;

  // --- shirt: below the chin if the frame shows it, otherwise a calm default ---
  const shirtY = lm[152].y + (faceH * 0.5) / h;
  const shirt = shirtY < 0.97 ? samplePatch(ctx, w, h, lm[152].x, shirtY, patch * 1.4) : null;
  params.shirt =
    shirt && saturation(shirt) < 0.75 && luminance(shirt) > 25 && luminance(shirt) < 215
      ? toHex(mix(shirt, [40, 52, 82], 0.25))
      : SHIRT_FALLBACKS[Math.floor(Math.random() * SHIRT_FALLBACKS.length)];

  return params;
}

// ---------- Precise face mesh ----------

/** Average many frames of landmarks into one metric, centred, cheek-width-normalised mesh.
 * Averaging removes per-frame jitter, which is what makes single-frame landmarks look "off". */
export function buildFaceMesh(frames: LandmarkPoint[][], width: number, height: number): number[] | null {
  if (!frames.length) return null;
  const n = MESH_POINTS;
  const acc = new Float64Array(n * 3);
  for (const lm of frames) {
    // Landmark z shares x's scale; work in "pixels of width" so all axes are metric-consistent.
    const cheek = Math.hypot((lm[454].x - lm[234].x) * width, (lm[454].y - lm[234].y) * height, (lm[454].z - lm[234].z) * width);
    if (!cheek) continue;
    const cx = (lm[234].x + lm[454].x) / 2;
    const cy = (lm[234].y + lm[454].y) / 2;
    const cz = (lm[234].z + lm[454].z) / 2;
    for (let i = 0; i < n; i++) {
      acc[i * 3] += ((lm[i].x - cx) * width) / cheek;
      acc[i * 3 + 1] += (-(lm[i].y - cy) * height) / cheek;
      acc[i * 3 + 2] += (-(lm[i].z - cz) * width) / cheek;
    }
  }
  const count = frames.length;
  const out: number[] = new Array(n * 3);
  for (let i = 0; i < n * 3; i++) out[i] = Math.round((acc[i] / count) * 1000) / 1000;
  return out;
}

// ---------- Guided scan steps ----------

export type ScanStep = {
  angle: ScanAngle;
  title: string;
  hint: string;
};

export const SCAN_STEPS: ScanStep[] = [
  { angle: "front", title: "Look straight at the camera", hint: "Centre your face in the oval and hold still." },
  { angle: "side_a", title: "Slowly turn your head to one side", hint: "Keep your eyes on the screen as you turn." },
  { angle: "side_b", title: "Now turn to the other side", hint: "Go past the middle and turn the opposite way." },
  { angle: "up", title: "Tilt your chin up", hint: "Lift your chin a little and hold." },
  { angle: "down", title: "Now tilt your chin down", hint: "Lower your chin slightly and hold." },
];

export const YAW_THRESHOLD = 20;
export const PITCH_THRESHOLD = 11;
export const FRONT_TOLERANCE = 9;
export const MIN_FACE_WIDTH = 0.16;
export const HOLD_MS = 550;
