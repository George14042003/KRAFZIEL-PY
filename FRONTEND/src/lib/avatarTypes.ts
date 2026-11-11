/** Shared contract for the "God level" interview tier: the stylized 3D digital twin.
 *
 * Params are derived from a multi-angle face scan (see lib/faceScan.ts) and can be
 * hand-tuned afterwards. Only these derived numbers/colours are stored for an
 * employer's twin — never the scan photos. The backend validates the same ranges. */

export type HairStyle = "bald" | "buzz" | "short" | "medium" | "long" | "bun";
export type FacialHair = "none" | "stubble" | "beard";

/** Proportion multipliers, 1.0 = average. Always clamped to [FACE_MIN, FACE_MAX]. */
export type FaceShape = {
  width: number; // overall head width
  height: number; // overall head height
  jaw: number; // jaw/chin width relative to the cheeks
  eyeSpacing: number; // distance between the eyes
  mouthWidth: number;
  noseWidth: number;
  browHeight: number; // how high the brows sit above the eyes
};

export type AvatarParams = {
  version: 1;
  /** Hex colours, "#rrggbb". */
  skin: string;
  hair: string;
  eyes: string;
  shirt: string;
  hairStyle: HairStyle;
  facialHair: FacialHair;
  glasses: boolean;
  face: FaceShape;
  /** The scanned person's actual face geometry: MEDIAPIPE_MESH_POINTS landmarks as a flat
   * [x,y,z,...] array (length MESH_LENGTH), averaged over many frames. Units: 1.0 = cheek-to-cheek
   * width, origin at the face centre, +x = the person's left as seen by the camera (image right),
   * +y up, +z toward the viewer. When present the avatar head is built from it, so the
   * proportions match the person exactly; `face` multipliers are applied on top as fine-tuning. */
  mesh?: number[];
};

export const MESH_POINTS = 468;
export const MESH_LENGTH = MESH_POINTS * 3;

export const FACE_MIN = 0.75;
export const FACE_MAX = 1.25;

export const HAIR_STYLES: HairStyle[] = ["bald", "buzz", "short", "medium", "long", "bun"];
export const FACIAL_HAIR: FacialHair[] = ["none", "stubble", "beard"];

export const DEFAULT_AVATAR: AvatarParams = {
  version: 1,
  skin: "#e0b28f",
  hair: "#3b2c22",
  eyes: "#4a3426",
  shirt: "#2b3a5a",
  hairStyle: "short",
  facialHair: "none",
  glasses: false,
  face: { width: 1, height: 1, jaw: 1, eyeSpacing: 1, mouthWidth: 1, noseWidth: 1, browHeight: 1 },
};

export function clampFace(v: number): number {
  return Math.min(FACE_MAX, Math.max(FACE_MIN, Number.isFinite(v) ? v : 1));
}

/** What the avatar is doing right now (drives the animation state machine). */
export type AvatarMode = "idle" | "speaking" | "listening" | "noting";
