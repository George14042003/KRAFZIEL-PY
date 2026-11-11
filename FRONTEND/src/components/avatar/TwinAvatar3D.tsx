"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DEFAULT_AVATAR, MESH_LENGTH, MESH_POINTS, clampFace, type AvatarMode, type AvatarParams } from "@/lib/avatarTypes";

/* ------------------------------------------------------------------ *
 * Stylized procedural 3D digital twin ("soft clay" look), plain three.js.
 *
 * Layout of the file:
 *   1. math helpers
 *   2. rig builder  (geometry that depends on AvatarParams; rebuilt on change)
 *   3. engine       (renderer, camera, lights, rAF loop, animation state machine;
 *                    lives for the whole component lifetime so the animation
 *                    clock never restarts when params change)
 *   4. React wrapper
 * ------------------------------------------------------------------ */

/* ----------------------------- helpers ----------------------------- */

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** smoothstep; works with reversed edges (a > b) as well. */
const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (cur: number, target: number, tau: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function safeColor(hex: string, fallback: string): THREE.Color {
  return new THREE.Color(/^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback);
}

function std(color: THREE.Color | number | string, roughness = 0.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

/* ------------------------------ head ------------------------------- */

interface HeadSpec {
  Rx: number;
  Ry: number;
  Rz: number;
  jaw: number;
  W: number;
  H: number;
  /** unit-sphere y of the mouth line (used by the jaw morph) */
  nyM: number;
  /** scan-derived overrides (only when AvatarParams.mesh is present) */
  xsTable?: Float32Array;
  dev?: DevField;
}

/** Height-field of z deviations (head-local units) between the scanned face and the base ellipsoid. */
interface DevField {
  x0: number;
  y0: number;
  d: number;
  nx: number;
  ny: number;
  v: Float32Array;
}

function devZ(h: HeadSpec, x: number, y: number) {
  const f = h.dev;
  if (!f) return 0;
  const gx = (x - f.x0) / f.d;
  const gy = (y - f.y0) / f.d;
  if (gx < 0 || gy < 0 || gx >= f.nx - 1 || gy >= f.ny - 1) return 0;
  const ix = gx | 0;
  const iy = gy | 0;
  const fx = gx - ix;
  const fy = gy - iy;
  const i = iy * f.nx + ix;
  const a = f.v[i];
  const b = f.v[i + 1];
  const c = f.v[i + f.nx];
  const e = f.v[i + f.nx + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
}

/** Cheek -> chin taper (x scale at unit height uy). */
function xScale(h: HeadSpec, uy: number) {
  const t = uy < 0 ? Math.min(1, -uy) : 0;
  const tb = h.xsTable;
  if (tb) {
    const f = (clamp(uy, -1, 1) + 1) * 0.5 * (tb.length - 1);
    const i = Math.min(tb.length - 2, f | 0);
    return (tb[i] + (tb[i + 1] - tb[i]) * (f - i)) * (1 + (h.jaw - 1) * 0.6 * Math.pow(t, 1.5));
  }
  const e = Math.pow(t, 1.7);
  return 1 - e * (0.72 - 0.44 * h.jaw);
}
function zScale(uy: number) {
  const t = uy < 0 ? Math.min(1, -uy) : 0;
  return 1 - 0.14 * Math.pow(t, 1.4);
}
/** z of the head surface at head-local (x, y). */
function surfZ(h: HeadSpec, x: number, y: number) {
  const uy = y / h.Ry;
  if (uy <= -1 || uy >= 1) return 0;
  const nx = x / (h.Rx * xScale(h, uy));
  const v = 1 - nx * nx - uy * uy;
  return v > 0 ? h.Rz * zScale(uy) * Math.sqrt(v) + devZ(h, x, y) : 0;
}
/** Jaw-open morph weight at unit-sphere coords. */
function jawW(h: HeadSpec, ux: number, uy: number, uz: number) {
  return ss(h.nyM + 0.012, h.nyM - 0.1, uy) * ss(0.95, 0.55, Math.abs(ux)) * ss(-0.35, 0.25, uz);
}
const JAW_DROP = 0.1;
const JAW_BACK = 0.025;

interface ShellOpts {
  field: (ux: number, uy: number, uz: number, x: number, y: number) => number;
  thick: (ux: number, uy: number, uz: number, w: number) => number;
  morph?: boolean;
  alpha?: number;
  /** per-vertex rgb multiplier from head-local position */
  tint?: (x: number, y: number, uz: number, out: number[]) => void;
}

/** A thin skin of the head ellipsoid (hair, stubble, beard) offset along the normal. */
function shellGeometry(h: HeadSpec, unit: Float32Array, index: ArrayLike<number>, opts: ShellOpts): THREE.BufferGeometry {
  const n = unit.length / 3;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const w = new Float32Array(n);
  const morph = opts.morph ? new Float32Array(n * 3) : null;
  const col = opts.alpha !== undefined ? new Float32Array(n * 4) : null;
  const col3 = opts.tint ? new Float32Array(n * 3) : null;
  const tmpC = [1, 1, 1];
  for (let i = 0; i < n; i++) {
    const ux = unit[i * 3];
    const uy = unit[i * 3 + 1];
    const uz = unit[i * 3 + 2];
    const s = xScale(h, uy);
    const zs = zScale(uy);
    const px = ux * h.Rx * s;
    const py = uy * h.Ry;
    let pz = uz * h.Rz * zs;
    let fxg = 0;
    let fyg = 0;
    if (h.dev) {
      const m = ss(0.05, 0.5, uz);
      if (m > 0) {
        pz += devZ(h, px, py) * m;
        fxg = ((devZ(h, px + 0.01, py) - devZ(h, px - 0.01, py)) / 0.02) * m;
        fyg = ((devZ(h, px, py + 0.01) - devZ(h, px, py - 0.01)) / 0.02) * m;
      }
    }
    let nxv = ux / (h.Rx * s);
    let nyv = uy / h.Ry;
    let nzv = uz / (h.Rz * zs);
    const nl = Math.hypot(nxv, nyv, nzv) || 1;
    nxv = nxv / nl - fxg;
    nyv = nyv / nl - fyg;
    nzv /= nl;
    const nl2 = Math.hypot(nxv, nyv, nzv) || 1;
    nxv /= nl2;
    nyv /= nl2;
    nzv /= nl2;
    const wi = opts.field(ux, uy, uz, px, py);
    w[i] = wi;
    const off = -0.012 + (opts.thick(ux, uy, uz, wi) + 0.012) * wi;
    pos[i * 3] = px + nxv * off;
    pos[i * 3 + 1] = py + nyv * off;
    pos[i * 3 + 2] = pz + nzv * off;
    nor[i * 3] = nxv;
    nor[i * 3 + 1] = nyv;
    nor[i * 3 + 2] = nzv;
    if (morph) {
      const jw = jawW(h, ux, uy, uz);
      morph[i * 3 + 1] = -JAW_DROP * jw;
      morph[i * 3 + 2] = -JAW_BACK * jw;
    }
    if (col3 && opts.tint) {
      opts.tint(px, py, uz, tmpC);
      col3[i * 3] = tmpC[0];
      col3[i * 3 + 1] = tmpC[1];
      col3[i * 3 + 2] = tmpC[2];
    }
    if (col) {
      col[i * 4] = 1;
      col[i * 4 + 1] = 1;
      col[i * 4 + 2] = 1;
      col[i * 4 + 3] = (opts.alpha ?? 1) * wi;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i];
    const b = index[i + 1];
    const c = index[i + 2];
    if (w[a] > 0 || w[b] > 0 || w[c] > 0) idx.push(a, b, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  if (col) g.setAttribute("color", new THREE.BufferAttribute(col, 4));
  if (col3) g.setAttribute("color", new THREE.BufferAttribute(col3, 3));
  g.setIndex(idx);
  if (morph) {
    g.morphAttributes.position = [new THREE.BufferAttribute(morph, 3)];
    g.morphTargetsRelative = true;
  }
  return g;
}

/* ------------------------------ rig -------------------------------- */

interface EyeRig {
  ball: THREE.Group;
  upper: THREE.Group;
  lower: THREE.Group;
}
interface HandRig {
  root: THREE.Group;
  f1: THREE.Group[];
  f2: THREE.Group[];
  t1: THREE.Group;
  t2: THREE.Group;
  side: number;
}
interface ArmRig {
  sx: number;
  upper: THREE.Mesh;
  fore: THREE.Mesh;
  cuff: THREE.Mesh;
  elbow: THREE.Mesh;
  hand: HandRig;
}
interface BrowRig {
  g: THREE.Group;
  baseY: number;
  s: number;
}
interface Rig {
  root: THREE.Group;
  torso: THREE.Mesh;
  headPivot: THREE.Group;
  head: THREE.Mesh;
  eyes: EyeRig[];
  brows: BrowRig[];
  arms: ArmRig[];
  pad: THREE.Group;
  pen: THREE.Group;
  topY: number;
  follow: THREE.Mesh[];
  updateMouth: (open: number, wScale: number, smile: number) => void;
  dispose: () => void;
}

const L1 = 0.62; // upper arm
const L2 = 0.58; // forearm
const SHOULDER_X = 0.56;
const SHOULDER_Y = -0.24;
const NECK_Y = 0.2; // head pivot height
const PAD_W = 0.36;
const PAD_H = 0.46;
const PAD_S = 1.3;
const HAND_S = 1.75;

/* ----------------------- scanned face mesh ----------------------- */

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

function validMesh(m: number[] | undefined): number[] | null {
  if (!m || m.length !== MESH_LENGTH) return null;
  for (let i = 0; i < m.length; i++) if (!Number.isFinite(m[i])) return null;
  return m;
}

/** Scan landmarks mapped to head-local units (chin at -Ry, cheek width = 2*Rx). */
interface MeshCtx {
  Rx: number;
  Ry: number;
  Rz: number;
  X: Float32Array;
  Y: Float32Array;
  Z: Float32Array; // z scaled but not yet aligned to the ellipsoid
  fit: (head: HeadSpec) => void;
}

function prepareMesh(mesh: number[], W: number, H: number): MeshCtx {
  const faceH = Math.max(0.3, mesh[10 * 3 + 1] - mesh[152 * 3 + 1]);
  const RyRaw = faceH / 0.72 / 2;
  // stylise: keep the head height within a friendly range
  const Ry = clamp(RyRaw, 0.5, 0.7) * H;
  const ySc = Ry / RyRaw;
  const yChin = mesh[152 * 3 + 1];
  const zS = (W + H) / 2;
  const X = new Float32Array(MESH_POINTS);
  const Y = new Float32Array(MESH_POINTS);
  const Z = new Float32Array(MESH_POINTS);
  for (let i = 0; i < MESH_POINTS; i++) {
    X[i] = mesh[i * 3] * W;
    Y[i] = (mesh[i * 3 + 1] - yChin) * ySc - Ry;
    Z[i] = mesh[i * 3 + 2] * zS;
  }
  const Rx = 0.5 * W;
  const Rz = 0.5 * (0.6 + 0.4 * W);

  const fit = (head: HeadSpec) => {
    // 1. silhouette: half-width of the face oval per height -> x scale table
    const neg: number[][] = [];
    const pos: number[][] = [];
    for (const i of FACE_OVAL) {
      (X[i] <= 0 ? neg : pos).push([Y[i], Math.abs(X[i])]);
      if (i === 10 || i === 152) pos.push([Y[i], Math.abs(X[i])]);
    }
    neg.sort((a, b) => a[0] - b[0]);
    pos.sort((a, b) => a[0] - b[0]);
    const interp = (arr: number[][], y: number) => {
      if (!arr.length) return Rx;
      if (y <= arr[0][0]) return arr[0][1];
      for (let k = 1; k < arr.length; k++) {
        if (y <= arr[k][0]) {
          const t = (y - arr[k - 1][0]) / Math.max(1e-5, arr[k][0] - arr[k - 1][0]);
          return arr[k - 1][1] + (arr[k][1] - arr[k - 1][1]) * t;
        }
      }
      return arr[arr.length - 1][1];
    };
    const N = 65;
    const table = new Float32Array(N);
    const yTop = Y[10];
    const yBot = Y[152];
    for (let k = 0; k < N; k++) {
      const uy = -1 + (2 * k) / (N - 1);
      const y = uy * Ry;
      const tt = uy < 0 ? Math.min(1, -uy) : 0;
      const base = 1 - Math.pow(tt, 1.7) * 0.28;
      const hw = (interp(neg, y) + interp(pos, y)) / 2;
      const xsm = clamp(hw / (Rx * Math.sqrt(Math.max(0.05, 1 - uy * uy))), 0.4, 1.15);
      const wgt = ss(yBot, yBot + 0.12, y) * ss(yTop, yTop - 0.12, y);
      table[k] = base + (xsm - base) * wgt;
    }
    head.xsTable = table;

    // 2. depth: deviation of every landmark from the base ellipsoid, aligned at the face oval
    const zp = new Float32Array(MESH_POINTS);
    for (let i = 0; i < MESH_POINTS; i++) zp[i] = surfZ(head, X[i], Y[i]);
    let sum = 0;
    let cnt = 0;
    for (const i of FACE_OVAL) {
      if (zp[i] > 0.02) {
        sum += Z[i] - zp[i];
        cnt++;
      }
    }
    const zOff = cnt ? -sum / cnt : 0;
    const dd = 0.0125;
    const x0 = -Rx;
    const y0 = -Ry;
    const nx = Math.ceil((2 * Rx) / dd) + 1;
    const ny = Math.ceil((1.7 * Ry) / dd) + 1;
    const num = new Float32Array(nx * ny);
    const den = new Float32Array(nx * ny);
    const sig = 0.055;
    const rad = Math.ceil((3 * sig) / dd);
    for (let i = 0; i < MESH_POINTS; i++) {
      if (zp[i] <= 0.02) continue;
      const d = clamp(Z[i] + zOff - zp[i], -0.08, 0.12);
      const cx = Math.round((X[i] - x0) / dd);
      const cy = Math.round((Y[i] - y0) / dd);
      for (let gy = cy - rad; gy <= cy + rad; gy++) {
        if (gy < 0 || gy >= ny) continue;
        for (let gx = cx - rad; gx <= cx + rad; gx++) {
          if (gx < 0 || gx >= nx) continue;
          const ex = x0 + gx * dd - X[i];
          const ey = y0 + gy * dd - Y[i];
          const w = Math.exp(-(ex * ex + ey * ey) / (2 * sig * sig));
          num[gy * nx + gx] += w * d;
          den[gy * nx + gx] += w;
        }
      }
    }
    const v = new Float32Array(nx * ny);
    for (let gy = 0; gy < ny; gy++) {
      for (let gx = 0; gx < nx; gx++) {
        const i = gy * nx + gx;
        if (den[i] < 1e-4) continue;
        const x = x0 + gx * dd;
        const y = y0 + gy * dd;
        const uy = y / Ry;
        const nxv = x / (Rx * xScale(head, uy));
        const edge = ss(1.0, 0.72, Math.abs(nxv)) * ss(-0.97, -0.8, uy);
        v[i] = (num[i] / den[i]) * ss(0.25, 1.0, den[i]) * edge;
      }
    }
    // light blur so the surface is smooth (no landmark-grid bumps)
    const tmp = new Float32Array(v.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let gy = 1; gy < ny - 1; gy++) {
        for (let gx = 1; gx < nx - 1; gx++) {
          const i = gy * nx + gx;
          tmp[i] = v[i] * 0.4 + (v[i - 1] + v[i + 1] + v[i - nx] + v[i + nx]) * 0.15;
        }
      }
      v.set(tmp);
    }
    head.dev = { x0, y0, d: dd, nx, ny, v };
  };
  return { Rx, Ry, Rz, X, Y, Z, fit };
}

function buildHand(side: number, skin: THREE.Material): HandRig {
  const root = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin);
  palm.scale.set(0.062, 0.076, 0.036);
  palm.position.y = -0.07;
  root.add(palm);
  const f1: THREE.Group[] = [];
  const f2: THREE.Group[] = [];
  const lens = [0.05, 0.058, 0.054, 0.042];
  for (let i = 0; i < 4; i++) {
    const r = 0.0125;
    const len = lens[i];
    const g1 = new THREE.Group();
    g1.position.set(-0.0435 + i * 0.029, -0.125, 0);
    const m1 = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), skin);
    m1.position.y = -(len / 2 + r);
    g1.add(m1);
    const g2 = new THREE.Group();
    g2.position.y = -(len + r * 1.6);
    const m2 = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.92, len * 0.8, 3, 8), skin);
    m2.position.y = -(len * 0.4 + r * 0.92);
    g2.add(m2);
    g1.add(g2);
    root.add(g1);
    f1.push(g1);
    f2.push(g2);
  }
  const t1 = new THREE.Group();
  t1.position.set(side * 0.05, -0.045, 0.012);
  const tm1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0145, 0.036, 3, 8), skin);
  tm1.position.y = -0.033;
  t1.add(tm1);
  const t2 = new THREE.Group();
  t2.position.y = -0.062;
  const tm2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0135, 0.03, 3, 8), skin);
  tm2.position.y = -0.028;
  t2.add(tm2);
  t1.add(t2);
  root.add(t1);
  return { root, f1, f2, t1, t2, side };
}

function buildRig(p: AvatarParams, padTex: THREE.Texture | null): Rig {
  const root = new THREE.Group();
  /** meshes that carry the jaw morph in addition to the head (beards) */
  const followMeshes: THREE.Mesh[] = [];

  const fs = p.face ?? DEFAULT_AVATAR.face;
  const W = clampFace(fs.width);
  const H = clampFace(fs.height);
  const jaw = clampFace(fs.jaw);
  const eyeSp = clampFace(fs.eyeSpacing);
  const mouthWid = clampFace(fs.mouthWidth);
  const noseWid = clampFace(fs.noseWidth);
  const browH = clampFace(fs.browHeight);

  const skinC = safeColor(p.skin, DEFAULT_AVATAR.skin);
  const hairC = safeColor(p.hair, DEFAULT_AVATAR.hair);
  const eyeC = safeColor(p.eyes, DEFAULT_AVATAR.eyes);
  const shirtC = safeColor(p.shirt, DEFAULT_AVATAR.shirt);

  const skin = std(skinC, 0.62);
  const skinShade = std(skinC.clone().multiplyScalar(0.9), 0.7);
  const hairM = std(hairC, 0.66);
  hairM.polygonOffset = true;
  hairM.polygonOffsetFactor = -2;
  hairM.polygonOffsetUnits = -2;
  const shirt = std(shirtC, 0.85);
  const shirtLight = std(shirtC.clone().lerp(new THREE.Color("#ffffff"), 0.22), 0.8);

  const meshData = validMesh(p.mesh);
  const M = meshData ? prepareMesh(meshData, W, H) : null;
  const Rx = M ? M.Rx : 0.5 * W;
  const Ry = M ? M.Ry : 0.54 * H;
  const Rz = M ? M.Rz : 0.5 * (0.6 + 0.4 * W);
  const head: HeadSpec = { Rx, Ry, Rz, jaw, W, H, nyM: 0 };
  if (M) M.fit(head);
  const headCY = Ry * 0.82;

  /* feature layout: from the scan landmarks when present, else procedural */
  const mid = (a: number, b: number) => (a + b) / 2;
  const lmX = (i: number) => (M ? M.X[i] : 0);
  const lmY = (i: number) => (M ? M.Y[i] : 0);
  let exs = [-0.215 * eyeSp * (0.6 + 0.4 * W), 0.215 * eyeSp * (0.6 + 0.4 * W)];
  let eys = [0.05 * H, 0.05 * H];
  let eyeR = 0.098;
  let mouthY = -0.28 * H;
  let mouthX = 0;
  let halfW = 0.135 * mouthWid;
  let mouthK0 = 0.008;
  let upT = 0.021;
  let loT = 0.027;
  let noseX = 0;
  let noseY = -0.125 * H;
  let noseTopY = 0.005 * H;
  let noseScale = noseWid;
  let earY = -0.02 * H;
  let browPts: THREE.Vector2[][] | null = null;
  if (M) {
    const exm = [mid(lmX(33), lmX(133)), mid(lmX(263), lmX(362))];
    const cx = mid(exm[0], exm[1]);
    exs = [cx + (exm[0] - cx) * eyeSp, cx + (exm[1] - cx) * eyeSp];
    eys = [mid(mid(lmY(33), lmY(133)), mid(lmY(159), lmY(145))), mid(mid(lmY(263), lmY(362)), mid(lmY(386), lmY(374)))];
    const ew = (Math.abs(lmX(133) - lmX(33)) + Math.abs(lmX(362) - lmX(263))) / 2;
    eyeR = clamp(ew * 0.34, 0.085, 0.112);
    mouthY = mid(lmY(13), lmY(14));
    mouthX = mid(lmX(61), lmX(291));
    halfW = clamp(Math.abs(lmX(291) - lmX(61)) / 2, 0.06, 0.2) * mouthWid;
    mouthK0 = clamp(mid(lmY(61), lmY(291)) - mouthY, -0.025, 0.03);
    upT = clamp(lmY(0) - lmY(13), 0.01, 0.03);
    loT = clamp(Math.abs(lmY(17) - lmY(14)), 0.015, 0.045);
    noseX = lmX(1);
    noseY = lmY(1) - 0.012;
    noseTopY = lmY(168);
    noseScale = clamp(Math.abs(lmX(358) - lmX(129)) / 0.26, 0.75, 1.5) * noseWid * 0.8;
    earY = mid(lmY(234), lmY(454));
    browPts = [
      [70, 63, 105, 66, 107].map((i) => new THREE.Vector2(lmX(i), lmY(i))),
      [336, 296, 334, 293, 300].map((i) => new THREE.Vector2(lmX(i), lmY(i))),
    ];
  }
  const eyeAvgY = mid(eys[0], eys[1]);
  head.nyM = mouthY / Ry;

  /* torso, neck, collar */
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), shirt);
  torso.scale.set(0.76, 1.0, 0.38);
  torso.position.set(0, -1.0, -0.02);
  root.add(torso);
  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.92, 8, 20), shirt);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.set(0, -0.24, -0.02);
  shoulders.scale.set(1, 1, 1.0);
  root.add(shoulders);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.5, 20, 1), skinShade);
  neck.position.set(0, 0.0, 0);
  root.add(neck);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.034, 10, 28), shirtLight);
  collar.rotation.x = Math.PI / 2 - 0.12;
  collar.position.set(0, -0.08, 0.02);
  collar.scale.set(1, 1, 0.9);
  root.add(collar);

  /* head */
  const headPivot = new THREE.Group();
  headPivot.position.y = NECK_Y;
  root.add(headPivot);
  const face = new THREE.Group();
  face.position.y = headCY;
  headPivot.add(face);

  const sphere = new THREE.SphereGeometry(1, 64, 48);
  const unit = Float32Array.from((sphere.attributes.position as THREE.BufferAttribute).array);
  const sphereIndex = Array.from((sphere.index as THREE.BufferAttribute).array as ArrayLike<number>);
  const cheekY = (eyeAvgY + mouthY) / 2 - 0.02;
  const headGeo = shellGeometry(head, unit, sphereIndex, {
    field: () => 1,
    thick: () => 0,
    morph: true,
    tint: (x, y, uz, out) => {
      // soft cheek warmth
      const f = ss(0.1, 0.5, uz);
      const sg = 0.13;
      const wl = Math.exp(-((x - Rx * 0.55) ** 2 + (y - cheekY) ** 2) / (2 * sg * sg));
      const wr = Math.exp(-((x + Rx * 0.55) ** 2 + (y - cheekY) ** 2) / (2 * sg * sg));
      const w = (wl + wr) * f * 0.8;
      out[0] = 1;
      out[1] = 1 - 0.14 * w;
      out[2] = 1 - 0.17 * w;
    },
  });
  sphere.dispose();
  const headMat = std(skinC, 0.62);
  headMat.vertexColors = true;
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.morphTargetInfluences = [0];
  face.add(headMesh);

  /* ears */
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinShade);
    ear.scale.set(0.034, 0.07, 0.046);
    ear.position.set(s * Rx * xScale(head, earY / Ry) * 0.985, earY, -0.035);
    ear.rotation.z = s * -0.12;
    face.add(ear);
  }

  /* eyes */
  const eyeZs = [surfZ(head, exs[0], eys[0]) - 0.036, surfZ(head, exs[1], eys[1]) - 0.036];
  const white = std("#f7f4ee", 0.35);
  const irisM = std(eyeC, 0.35);
  const irisRing = std(eyeC.clone().multiplyScalar(0.55), 0.4);
  const pupilM = std("#0c0a0a", 0.3);
  const lidEdge = new THREE.MeshStandardMaterial({ color: "#2a1c18", roughness: 0.6 });
  const hiM = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const eyes: EyeRig[] = [];
  const ballGeo = new THREE.SphereGeometry(eyeR, 24, 18);
  const irisGeo = new THREE.SphereGeometry(eyeR * 1.004, 20, 8, 0, Math.PI * 2, 0, 0.6).rotateX(Math.PI / 2);
  const ringGeo = new THREE.SphereGeometry(eyeR * 1.002, 20, 8, 0, Math.PI * 2, 0, 0.66).rotateX(Math.PI / 2);
  const pupilGeo = new THREE.SphereGeometry(eyeR * 1.008, 16, 6, 0, Math.PI * 2, 0, 0.26).rotateX(Math.PI / 2);
  const upperGeo = new THREE.SphereGeometry(eyeR * 1.075, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const lowerGeo = new THREE.SphereGeometry(eyeR * 1.07, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const edgeGeo = new THREE.TorusGeometry(eyeR * 1.074, 0.0065, 6, 28).rotateX(Math.PI / 2);
  const hiGeo = new THREE.SphereGeometry(1, 10, 8);
  const eu = eyeR / 0.098;
  for (let k = 0; k < 2; k++) {
    const socket = new THREE.Group();
    socket.position.set(exs[k], eys[k], eyeZs[k]);
    const ball = new THREE.Group();
    ball.add(new THREE.Mesh(ballGeo, white));
    ball.add(new THREE.Mesh(ringGeo, irisRing));
    ball.add(new THREE.Mesh(irisGeo, irisM));
    ball.add(new THREE.Mesh(pupilGeo, pupilM));
    socket.add(ball);
    const hi = new THREE.Mesh(hiGeo, hiM);
    hi.scale.setScalar(0.017 * eu);
    hi.position.set(-0.026 * eu, 0.03 * eu, eyeR * 0.995);
    socket.add(hi);
    const hi2 = new THREE.Mesh(hiGeo, hiM);
    hi2.scale.setScalar(0.008 * eu);
    hi2.position.set(0.026 * eu, -0.028 * eu, eyeR * 0.998);
    socket.add(hi2);
    const upper = new THREE.Group();
    upper.add(new THREE.Mesh(upperGeo, skin));
    upper.add(new THREE.Mesh(edgeGeo, lidEdge));
    socket.add(upper);
    const lower = new THREE.Group();
    lower.add(new THREE.Mesh(lowerGeo, skin));
    socket.add(lower);
    face.add(socket);
    eyes.push({ ball, upper, lower });
  }

  /* brows */
  const browMat = std(hairC.clone().multiplyScalar(0.78), 0.7);
  const brows: BrowRig[] = [];
  for (let k = 0; k < 2; k++) {
    const s = k === 0 ? -1 : 1;
    let pts2: THREE.Vector2[];
    if (browPts) {
      pts2 = browPts[k].map((v) => v.clone());
      pts2.sort((a, b2) => a.x - b2.x);
      for (const v of pts2) v.y += 0.012 + (browH - 1) * 0.1;
    } else {
      pts2 = [];
      const xc0 = s * (Math.abs(exs[k]) + 0.005);
      const by = eys[k] + 0.158 * browH;
      for (let i = 0; i < 7; i++) {
        const u = -1 + (i / 6) * 2;
        const lx = u * 0.082;
        const outer = (s * lx) / 0.082;
        const ly = 0.013 * (1 - u * u) + 0.006 * outer - 0.008 * Math.max(0, outer - 0.5);
        pts2.push(new THREE.Vector2(xc0 + lx, by + ly));
      }
    }
    let xc = 0;
    let yc = 0;
    for (const v of pts2) {
      xc += v.x / pts2.length;
      yc += v.y / pts2.length;
    }
    const z0 = surfZ(head, xc, yc);
    const pts = pts2.map((v) => new THREE.Vector3(v.x - xc, v.y - yc, surfZ(head, v.x, v.y) - z0 + 0.012));
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0175, 8, false);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, browMat));
    g.position.set(xc, yc, z0);
    face.add(g);
    brows.push({ g, baseY: yc, s });
  }

  /* nose */
  {
    const nz = surfZ(head, noseX, noseY);
    const bridge = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), skin);
    const bh = Math.max(0.05, (noseTopY - noseY) * 0.5);
    bridge.scale.set(0.03 * noseScale, bh, M ? 0.028 : 0.04);
    bridge.position.set(noseX, noseY + bh * 0.9, surfZ(head, noseX, noseY + bh * 0.9) + 0.004);
    bridge.rotation.x = 0.1;
    face.add(bridge);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skin);
    tip.scale.set(0.05 * noseScale, 0.042, M ? 0.036 : 0.05);
    tip.position.set(noseX, noseY, nz + (M ? 0.012 : 0.026));
    face.add(tip);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), skinShade);
      const wx = noseX + s * 0.038 * noseScale;
      wing.scale.set(0.026 * noseScale, 0.028, 0.026);
      wing.position.set(wx, noseY - 0.006, surfZ(head, wx, noseY) + 0.004);
      face.add(wing);
    }
  }

  /* mouth (conforming ribbons, updated per frame) */
  const COLS = 21;
  const lipColor = skinC.clone().lerp(new THREE.Color("#b04a56"), 0.5);
  const lipM = std(lipColor, 0.5);
  const cavityM = std("#2e1014", 0.9);
  const teethM = std("#f3ede2", 0.5);

  const ribbon = (rows: number, withNormals: boolean) => {
    const posArr = new Float32Array(rows * COLS * 3);
    const g = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(posArr, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", attr);
    const idx: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let i = 0; i < COLS - 1; i++) {
        const a = r * COLS + i;
        const b = a + 1;
        const c = a + COLS;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    g.setIndex(idx);
    if (!withNormals) {
      const nr = new Float32Array(rows * COLS * 3);
      for (let i = 0; i < rows * COLS; i++) nr[i * 3 + 2] = 1;
      g.setAttribute("normal", new THREE.BufferAttribute(nr, 3));
    } else {
      g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(rows * COLS * 3), 3));
    }
    return { g, arr: posArr, attr };
  };
  const upLip = ribbon(3, true);
  const loLip = ribbon(3, true);
  const cavity = ribbon(2, false);
  const teeth = ribbon(2, false);
  const mUp = new THREE.Mesh(upLip.g, lipM);
  const mLo = new THREE.Mesh(loLip.g, lipM);
  const mCav = new THREE.Mesh(cavity.g, cavityM);
  const mTeeth = new THREE.Mesh(teeth.g, teethM);
  for (const m of [mUp, mLo, mCav, mTeeth]) {
    m.frustumCulled = false;
    face.add(m);
  }

  const updateMouth = (open: number, wScale: number, smile: number) => {
    const mw = halfW * wScale;
    const gapC = JAW_DROP * open;
    const U = upLip.arr;
    const Lw = loLip.arr;
    const C = cavity.arr;
    const T = teeth.arr;
    let anyGap = false;
    for (let i = 0; i < COLS; i++) {
      const u = -1 + (2 * i) / (COLS - 1);
      const x = mouthX + u * mw;
      const edge = 1 - u * u;
      const yL = mouthY + (mouthK0 + 0.03 * smile) * u * u + 0.004 * smile;
      const gap = gapC * Math.pow(edge, 0.6);
      if (gap > 0.004) anyGap = true;
      // upper lip rows: outer, ridge, inner
      const yo = yL + upT * (0.35 + 0.65 * edge);
      const yr = yL + upT * 0.48 * (0.5 + 0.5 * edge);
      U[i * 3] = x;
      U[i * 3 + 1] = yo;
      U[i * 3 + 2] = surfZ(head, x, yo) + 0.002;
      U[(COLS + i) * 3] = x;
      U[(COLS + i) * 3 + 1] = yr;
      U[(COLS + i) * 3 + 2] = surfZ(head, x, yr) + 0.004 + 0.011 * (0.4 + 0.6 * edge);
      U[(2 * COLS + i) * 3] = x;
      U[(2 * COLS + i) * 3 + 1] = yL;
      U[(2 * COLS + i) * 3 + 2] = surfZ(head, x, yL) + 0.004;
      // lower lip rows: inner, ridge, outer (displaced by the jaw)
      const yi = yL - gap;
      const yrl = yi - loT * 0.45 * (0.45 + 0.55 * edge);
      const yol = yi - loT * (0.4 + 0.6 * edge);
      const zdrop = 0.25 * gap;
      Lw[i * 3] = x;
      Lw[i * 3 + 1] = yi;
      Lw[i * 3 + 2] = surfZ(head, x, yi + gap) - zdrop + 0.004;
      Lw[(COLS + i) * 3] = x;
      Lw[(COLS + i) * 3 + 1] = yrl;
      Lw[(COLS + i) * 3 + 2] = surfZ(head, x, yrl + gap) - zdrop + 0.005 + 0.013 * (0.4 + 0.6 * edge);
      Lw[(2 * COLS + i) * 3] = x;
      Lw[(2 * COLS + i) * 3 + 1] = yol;
      Lw[(2 * COLS + i) * 3 + 2] = surfZ(head, x, yol + gap) - zdrop + 0.002;
      // cavity
      C[i * 3] = x;
      C[i * 3 + 1] = yL;
      C[i * 3 + 2] = surfZ(head, x, yL) + 0.0025;
      C[(COLS + i) * 3] = x;
      C[(COLS + i) * 3 + 1] = yi;
      C[(COLS + i) * 3 + 2] = surfZ(head, x, yi + gap) - zdrop + 0.0025;
      // upper teeth
      const tx = mouthX + (x - mouthX) * 0.8;
      const th = Math.min(gap * 0.75, 0.034) * Math.pow(edge, 0.4);
      T[i * 3] = tx;
      T[i * 3 + 1] = yL;
      T[i * 3 + 2] = surfZ(head, tx, yL) + 0.0045;
      T[(COLS + i) * 3] = tx;
      T[(COLS + i) * 3 + 1] = yL - th;
      T[(COLS + i) * 3 + 2] = surfZ(head, tx, yL - th) + 0.0045;
    }
    upLip.attr.needsUpdate = true;
    loLip.attr.needsUpdate = true;
    cavity.attr.needsUpdate = true;
    teeth.attr.needsUpdate = true;
    upLip.g.computeVertexNormals();
    loLip.g.computeVertexNormals();
    mCav.visible = anyGap;
    mTeeth.visible = anyGap;
    headMesh.morphTargetInfluences![0] = open;
  };
  updateMouth(0, 1, 0.3);

  /* facial hair */
  if (p.facialHair !== "none") {
    const beard = p.facialHair === "beard";
    const hairDark = hairC.clone();
    const mx = halfW;
    const field = (ux: number, uy: number, uz: number, x: number, y: number) => {
      const lowZone = ss(-0.36, -0.52, uy);
      const cheekZone = ss(0.7, 0.9, Math.abs(ux)) * ss(-0.16, -0.4, uy) * (beard ? 1 : 0.7);
      let w = Math.max(lowZone, cheekZone) * ss(-0.35, 0.12, uz);
      // keep the lips clear
      const dx = (x - mouthX) / (mx * 1.1);
      const dy = (y - (mouthY - 0.012)) / (beard ? 0.058 : 0.05);
      const d = Math.sqrt(dx * dx + dy * dy);
      w *= ss(0.85, 1.6, d);
      return w;
    };
    const g = shellGeometry(head, unit, sphereIndex, {
      field,
      thick: (_ux, uy, _uz, w) => (beard ? 0.034 * (1 + 0.5 * ss(-0.55, -0.85, uy)) * (0.5 + 0.5 * w) : 0.006),
      morph: true,
      alpha: beard ? undefined : 0.62,
    });
    let mat: THREE.Material;
    if (beard) {
      mat = std(hairDark.multiplyScalar(0.92), 0.8);
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: hairDark.clone().lerp(skinC, 0.15).multiplyScalar(0.8),
        roughness: 0.95,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
      });
    }
    const m = new THREE.Mesh(g, mat);
    m.morphTargetInfluences = [0];
    face.add(m);
    followMeshes.push(m);
  }

  /* hair */
  const style = p.hairStyle;
  if (style !== "bald") {
    const tSide = style === "buzz" || style === "short" || style === "bun" ? 0.12 : style === "medium" ? -0.08 : -0.22;
    const tBack = style === "buzz" || style === "short" || style === "bun" ? -0.2 : style === "medium" ? -0.5 : -0.62;
    const tFront = style === "buzz" ? 0.56 : 0.52;
    const base = style === "buzz" ? 0.016 : style === "short" ? 0.052 : style === "bun" ? 0.05 : 0.058;
    const g = shellGeometry(head, unit, sphereIndex, {
      field: (ux, uy, uz) => {
        const lateral = ss(0.2, 0.97, Math.abs(ux));
        let T = tFront + (tSide - tFront) * lateral;
        const backness = ss(0.15, -0.5, uz);
        T = lerp(T, tBack, backness);
        return ss(T, T + 0.2, uy);
      },
      thick: (ux, uy, uz, w) => {
        let t = base * (1 + 0.55 * Math.max(0, uy) * Math.max(0, uy));
        if (style !== "buzz") {
          t += 0.03 * ss(0.5, 0.88, uy) * ss(0, 0.8, uz); // quiff
          t += 0.02 * ss(0.1, -0.5, uz) * w; // fuller back
        }
        return t;
      },
    });
    face.add(new THREE.Mesh(g, hairM));
    if (style === "long") {
      const back = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), hairM);
      back.scale.set(Rx * 1.06, 0.8, 0.4);
      back.position.set(0, -Ry * 0.38, -Rz * 0.5);
      face.add(back);
      for (const s of [-1, 1]) {
        const lock = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 14), hairM);
        lock.scale.set(0.1, 0.5, 0.17);
        lock.position.set(s * (Rx * 0.97), -Ry * 0.72, -0.05);
        lock.rotation.z = s * 0.06;
        face.add(lock);
      }
    } else if (style === "medium") {
      const back = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), hairM);
      back.scale.set(Rx * 1.04, 0.42, 0.38);
      back.position.set(0, -Ry * 0.2, -Rz * 0.5);
      face.add(back);
      for (const s of [-1, 1]) {
        const lock = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), hairM);
        lock.scale.set(0.065, 0.2, 0.14);
        lock.position.set(s * (Rx * 0.95), -Ry * 0.02, -0.06);
        face.add(lock);
      }
    } else if (style === "bun") {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), hairM);
      bun.scale.setScalar(0.17);
      bun.position.set(0, Ry * 0.9, -Rz * 0.32);
      face.add(bun);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 8, 20), std(hairC.clone().multiplyScalar(0.7), 0.7));
      band.position.set(0, Ry * 0.84, -Rz * 0.3);
      band.rotation.x = Math.PI / 2 - 0.3;
      face.add(band);
    }
  }

  /* glasses */
  if (p.glasses) {
    const frameM = std("#1d1d22", 0.4);
    const lensM = new THREE.MeshStandardMaterial({
      color: "#cfe6ff",
      roughness: 0.1,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const a = 0.122 * eu;
    const b = 0.098 * eu;
    const n = 3.2;
    const outline: THREE.Vector3[] = [];
    const outline2: THREE.Vector2[] = [];
    for (let i = 0; i < 40; i++) {
      const th = (i / 40) * Math.PI * 2;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      outline.push(new THREE.Vector3(x, y, 0));
      outline2.push(new THREE.Vector2(x, y));
    }
    const rimGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 64, 0.0105, 8, true);
    const lensGeo = new THREE.ShapeGeometry(new THREE.Shape(outline2));
    const gz = Math.max(surfZ(head, exs[0], eys[0]) + 0.075, surfZ(head, exs[1], eys[1]) + 0.075, eyeZs[0] + eyeR + 0.035);
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? -1 : 1;
      const eyeY = eys[k];
      const rim = new THREE.Mesh(rimGeo, frameM);
      rim.position.set(exs[k], eyeY + 0.005, gz);
      face.add(rim);
      const lens = new THREE.Mesh(lensGeo, lensM);
      lens.position.set(exs[k], eyeY + 0.005, gz);
      face.add(lens);
      // temple arm
      const x0 = exs[k] + s * a;
      const arm = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, eyeY + 0.03, gz - 0.005),
        new THREE.Vector3(s * (Rx * 0.97), eyeY + 0.02, gz - 0.2),
        new THREE.Vector3(s * (Rx * 1.0), eyeY - 0.01, -0.14),
      ]);
      face.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 12, 0.0085, 6, false), frameM));
    }
    const bridgeC = new THREE.CatmullRomCurve3([
      new THREE.Vector3(exs[0] + a, eys[0] + 0.03, gz),
      new THREE.Vector3((exs[0] + exs[1]) / 2, (eys[0] + eys[1]) / 2 + 0.05, gz + 0.008),
      new THREE.Vector3(exs[1] - a, eys[1] + 0.03, gz),
    ]);
    face.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeC, 10, 0.0095, 6, false), frameM));
  }

  /* arms */
  const arms: ArmRig[] = [];
  const upperGeo2 = new THREE.CylinderGeometry(0.105, 0.088, L1, 16, 1);
  const foreGeo = new THREE.CylinderGeometry(0.086, 0.066, L2, 16, 1);
  const cuffGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.06, 16, 1);
  const jointGeo = new THREE.SphereGeometry(1, 16, 12);
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Mesh(jointGeo, shirt);
    shoulder.scale.setScalar(0.17);
    shoulder.position.set(sx * SHOULDER_X, SHOULDER_Y, 0);
    root.add(shoulder);
    const upper = new THREE.Mesh(upperGeo2, shirt);
    const fore = new THREE.Mesh(foreGeo, shirt);
    const cuff = new THREE.Mesh(cuffGeo, shirtLight);
    const elbow = new THREE.Mesh(jointGeo, shirt);
    elbow.scale.setScalar(0.09);
    const hand = buildHand(-sx, skin);
    hand.root.scale.setScalar(HAND_S);
    root.add(upper, fore, cuff, elbow, hand.root);
    arms.push({ sx, upper, fore, cuff, elbow, hand });
  }

  /* notepad (held in avatar's left hand, +x) */
  const pad = new THREE.Group();
  const cardM = std("#3a3f4d", 0.8);
  const back = new THREE.Mesh(new THREE.BoxGeometry(PAD_W + 0.02, PAD_H + 0.02, 0.022), cardM);
  back.position.z = -0.004;
  pad.add(back);
  const paperGeo = new THREE.PlaneGeometry(PAD_W, PAD_H);
  const paperM = new THREE.MeshStandardMaterial({ map: padTex ?? null, color: padTex ? "#ffffff" : "#f6f0dc", roughness: 0.9 });
  const paper = new THREE.Mesh(paperGeo, paperM);
  paper.position.z = 0.0075;
  pad.add(paper);
  const bind = new THREE.Mesh(new THREE.BoxGeometry(PAD_W + 0.03, 0.036, 0.034), std("#252a36", 0.5));
  bind.position.set(0, PAD_H / 2 - 0.004, 0.004);
  pad.add(bind);
  const ringGeo2 = new THREE.TorusGeometry(0.013, 0.003, 6, 12);
  const ringM = std("#c8ccd4", 0.3);
  for (let i = 0; i < 9; i++) {
    const r = new THREE.Mesh(ringGeo2, ringM);
    r.position.set(-PAD_W / 2 + 0.035 + (i * (PAD_W - 0.07)) / 8, PAD_H / 2 + 0.002, 0.012);
    r.rotation.y = Math.PI / 2;
    pad.add(r);
  }
  root.add(pad);

  /* pen */
  const pen = new THREE.Group();
  const penBody = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.3, 10), std("#1f3f8f", 0.4));
  penBody.position.y = 0.19;
  pen.add(penBody);
  const penTip = new THREE.Mesh(new THREE.ConeGeometry(0.0135, 0.05, 10), std("#d9d9de", 0.3));
  penTip.position.y = 0.025;
  penTip.rotation.x = Math.PI;
  pen.add(penTip);
  const penClip = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.07, 0.006), std("#c9ccd2", 0.3));
  penClip.position.set(0, 0.26, 0.015);
  pen.add(penClip);
  root.add(pen);

  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
    root.clear();
  };

  return { root, torso, headPivot, head: headMesh, eyes, brows, arms, pad, pen, topY: NECK_Y + 1.82 * Ry, follow: followMeshes, updateMouth, dispose };
}

/* ----------------------------- notepad ----------------------------- */

function paintPad(tex: THREE.CanvasTexture, canvas: HTMLCanvasElement, notes?: string[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#fbf6e4";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(90,130,190,0.45)";
  ctx.lineWidth = 1.5;
  const top = 64;
  const gap = 32;
  for (let y = top; y < h - 10; y += gap) {
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(210,90,90,0.5)";
  ctx.beginPath();
  ctx.moveTo(34, 40);
  ctx.lineTo(34, h - 6);
  ctx.stroke();
  ctx.fillStyle = "#2a3550";
  ctx.font = "bold 17px 'Segoe UI', Arial, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Notes", 42, 46);
  const lines = (notes ?? []).filter((s) => s && s.trim()).slice(-7);
  if (lines.length) {
    ctx.font = "17px 'Segoe Print','Bradley Hand','Comic Sans MS',cursive";
    lines.forEach((raw, i) => {
      let s = raw.trim();
      const max = w - 52;
      while (s.length > 1 && ctx.measureText(s).width > max) s = s.slice(0, -2);
      if (s !== raw.trim()) s = s.slice(0, -1) + "…";
      ctx.fillText(s, 42, top + gap * (i + 1) - 8);
    });
  } else {
    ctx.strokeStyle = "#2a3550";
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    for (let r = 0; r < 4; r++) {
      const y = top + gap * (r + 1) - 9;
      const len = [190, 150, 205, 110][r];
      ctx.beginPath();
      ctx.moveTo(42, y);
      for (let x = 0; x < len; x += 4) {
        ctx.lineTo(42 + x, y - 3 + Math.sin(x * 0.55 + r * 2) * 3 * Math.sin(x * 0.12 + r));
      }
      ctx.stroke();
    }
  }
  tex.needsUpdate = true;
}

/* ----------------------------- engine ------------------------------ */

interface Input {
  mode: AvatarMode;
  mouthShape: number;
  noteBeat: number;
}
interface Engine {
  setParams: (p: AvatarParams) => void;
  setNotes: (n: string[] | undefined) => void;
  setInput: (i: Input) => void;
  dispose: () => void;
}

const OPEN_TBL = [0, 0.3, 0.58, 0.88];
const WID_TBL = [1, 0.86, 0.97, 1.05];

function createEngine(host: HTMLElement): Engine | null {
  if (typeof window === "undefined") return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    if (!renderer.getContext()) throw new Error("no gl");
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd2bfae, 1.25));
  const key = new THREE.DirectionalLight(0xfff0e0, 2.3);
  key.position.set(2.5, 3.5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd9ff, 1.7);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-3, 0, 4);
  scene.add(fill);

  /* notepad texture lives for the whole engine */
  const padCanvas = document.createElement("canvas");
  padCanvas.width = 256;
  padCanvas.height = 328;
  const padTex = new THREE.CanvasTexture(padCanvas);
  padTex.colorSpace = THREE.SRGBColorSpace;
  padTex.anisotropy = 4;
  paintPad(padTex, padCanvas, undefined);

  let rig: Rig | null = null;
  let params: AvatarParams = DEFAULT_AVATAR;
  const input: Input = { mode: "idle", mouthShape: 0, noteBeat: 0 };

  const reducedMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let reduced = !!reducedMq?.matches;
  const onReduced = () => {
    reduced = !!reducedMq?.matches;
  };
  reducedMq?.addEventListener?.("change", onReduced);

  /* preallocated temporaries (no allocations in the hot path) */
  const DOWN = new THREE.Vector3(0, -1, 0);
  const UP = new THREE.Vector3(0, 1, 0);
  const vS = new THREE.Vector3();
  const vE = new THREE.Vector3();
  const vW = new THREE.Vector3();
  const vD = new THREE.Vector3();
  const vP = new THREE.Vector3();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const vTip = new THREE.Vector3();
  const vPenBack = new THREE.Vector3();
  const vHandDir = new THREE.Vector3();
  const vPalm = new THREE.Vector3();
  const vTmp = new THREE.Vector3();
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();
  const qE = new THREE.Quaternion();
  const mat = new THREE.Matrix4();
  const eul = new THREE.Euler(0, 0, 0, "YXZ");
  const foreDir = [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -1, 0)];

  /* pad frame (constant orientation) */
  const qPad = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.85, 0, 0.05, "XYZ"));
  const padX = new THREE.Vector3(1, 0, 0).applyQuaternion(qPad);
  const padY = new THREE.Vector3(0, 1, 0).applyQuaternion(qPad);
  const padN = new THREE.Vector3(0, 0, 1).applyQuaternion(qPad);
  const PAD_BASE = new THREE.Vector3(0.2, -0.8, 0.64);

  const REST_R = new THREE.Vector3(-0.36, -1.1, 0.4);
  const REST_L = new THREE.Vector3(0.36, -1.1, 0.4);
  const CLASP_R = new THREE.Vector3(-0.11, -1.02, 0.52);
  const CLASP_L = new THREE.Vector3(0.11, -1.02, 0.52);

  /* animation state */
  const st = {
    t: 0,
    wI: 1,
    wS: 0,
    wL: 0,
    wN: 0,
    headX: 0,
    headY: 0,
    headZ: 0,
    gx: 0,
    gy: 0,
    sacX: 0,
    sacY: 0,
    sacTX: 0,
    sacTY: 0,
    nextSac: 1,
    glX: 0,
    glY: 0,
    glT: -1,
    nextGlance: 5,
    browRaise: 0,
    browAsym: 0,
    smile: 0.3,
    open: 0,
    mw: 1,
    emph: 0,
    lastShape: 0,
    nextEmph: 1.5,
    blinkP: -1,
    nextBlink: 2,
    dbl: false,
    nodT: -1,
    nextNod: 3,
    camLook: 1,
    noteCam: false,
    noteTimer: 2,
    flick: 0,
    lastBeat: 0,
    beatInit: false,
    penU: 0,
    penV: 0,
    penLift: 0,
    scribT: 0,
    lidOpen: 1,
    // hand style params (smoothed)
    rollR: 1.1,
    rollL: -1.1,
    curlR: 0.3,
    curlL: 0.3,
    flexR: 0,
    flexL: 0,
    thR: 0.2,
    thL: 0.2,
  };

  const penBackDir = (out: THREE.Vector3) => {
    out.set(0, 0, 0).addScaledVector(padN, 0.62).addScaledVector(padX, -0.5).addScaledVector(padY, 0.6).normalize();
  };

  /** Build a rotation whose local -y is `fingerDir` and whose local +z leans toward `palmHint`. */
  const basisQuat = (out: THREE.Quaternion, fingerDir: THREE.Vector3, palmHint: THREE.Vector3) => {
    vA.copy(fingerDir).negate().normalize(); // local y
    vB.copy(palmHint).addScaledVector(vA, -palmHint.dot(vA));
    if (vB.lengthSq() < 1e-6) vB.set(0, 0, 1);
    vB.normalize(); // local z
    vC.crossVectors(vA, vB).normalize(); // local x
    mat.makeBasis(vC, vA, vB);
    out.setFromRotationMatrix(mat);
  };

  const solveArm = (arm: ArmRig, idx: number, target: THREE.Vector3, pole: THREE.Vector3) => {
    vS.set(arm.sx * SHOULDER_X, SHOULDER_Y, 0);
    vD.copy(target).sub(vS);
    let dist = vD.length();
    dist = clamp(dist, 0.25, L1 + L2 - 0.004);
    vD.normalize();
    vW.copy(vS).addScaledVector(vD, dist);
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
    const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    vP.copy(pole).addScaledVector(vD, -pole.dot(vD));
    if (vP.lengthSq() < 1e-6) vP.set(0, 0, -1);
    vP.normalize();
    vE.copy(vS).addScaledVector(vD, a).addScaledVector(vP, hh);
    // upper arm
    vA.copy(vE).sub(vS).normalize();
    arm.upper.position.copy(vS).add(vE).multiplyScalar(0.5);
    arm.upper.quaternion.setFromUnitVectors(DOWN, vA);
    // forearm
    vB.copy(vW).sub(vE).normalize();
    foreDir[idx].copy(vB);
    arm.fore.position.copy(vE).add(vW).multiplyScalar(0.5);
    arm.fore.quaternion.setFromUnitVectors(DOWN, vB);
    arm.cuff.position.copy(vW).addScaledVector(vB, -0.03);
    arm.cuff.quaternion.copy(arm.fore.quaternion);
    arm.elbow.position.copy(vE);
    arm.hand.root.position.copy(vW);
  };

  const setFingers = (h: HandRig, curl: number, thumbIn: number) => {
    for (let i = 0; i < 4; i++) {
      const c = curl * (1 + i * 0.06);
      h.f1[i].rotation.x = -c * 1.15;
      h.f2[i].rotation.x = -c * 1.35;
    }
    h.t1.rotation.z = h.side * (0.5 - 0.45 * thumbIn);
    h.t1.rotation.x = -0.25 * curl - 0.55 * thumbIn;
    h.t2.rotation.x = -0.35 * thumbIn;
  };

  const rnd = Math.random;

  /* ------------------------------ step ------------------------------ */
  const pole0 = new THREE.Vector3();
  const tgt = new THREE.Vector3();

  function step(dt: number) {
    if (!rig) return;
    const A = reduced ? 0.4 : 1;
    st.t += dt;
    const t = st.t;
    const mode = input.mode;

    // mode weights
    st.wI = damp(st.wI, mode === "idle" ? 1 : 0, 0.13, dt);
    st.wS = damp(st.wS, mode === "speaking" ? 1 : 0, 0.13, dt);
    st.wL = damp(st.wL, mode === "listening" ? 1 : 0, 0.13, dt);
    st.wN = damp(st.wN, mode === "noting" ? 1 : 0, 0.13, dt);
    const { wI, wS, wL, wN } = st;

    // note beat -> flick
    if (!st.beatInit) {
      st.lastBeat = input.noteBeat;
      st.beatInit = true;
    } else if (input.noteBeat !== st.lastBeat) {
      st.lastBeat = input.noteBeat;
      st.flick = 1;
    }
    st.flick *= Math.exp(-dt / 0.28);

    // speech
    const speaking = mode === "speaking";
    const shape = clamp(Math.round(input.mouthShape || 0), 0, 3);
    let openT = 0;
    let widT = 1;
    if (speaking) {
      if (shape > 0) {
        openT = OPEN_TBL[shape];
        widT = WID_TBL[shape];
      } else {
        const gate = ss(-0.7, -0.2, Math.sin(t * 0.93 + 1.2));
        const syl = Math.abs(Math.sin(t * 6.4)) * (0.65 + 0.35 * Math.sin(t * 2.3 + 1));
        openT = gate * clamp(0.1 + 0.8 * syl, 0, 0.85);
        widT = 1 + 0.05 * Math.sin(t * 3.1);
      }
      if (shape === 3 && st.lastShape !== 3 && st.emph < 0.4) st.emph = 1;
      st.nextEmph -= dt;
      if (st.nextEmph <= 0) {
        st.emph = Math.max(st.emph, 0.8);
        st.nextEmph = 1.4 + rnd() * 2;
      }
    }
    st.lastShape = shape;
    st.emph *= Math.exp(-dt / 0.5);
    st.open = damp(st.open, openT, 0.05, dt);
    st.mw = damp(st.mw, widT, 0.07, dt);

    // listening nods
    if (mode === "listening") {
      if (st.nodT >= 0) {
        st.nodT += dt;
        if (st.nodT > 1.5) st.nodT = -1;
      } else {
        st.nextNod -= dt;
        if (st.nextNod <= 0) {
          st.nodT = 0;
          st.nextNod = 3 + rnd() * 3;
        }
      }
    } else {
      st.nodT = -1;
    }
    const nodV = st.nodT >= 0 ? Math.sin((Math.PI * st.nodT) / 1.5) * (0.6 + 0.4 * Math.sin((Math.PI * 2 * st.nodT) / 0.75)) : 0;

    // noting gaze cycle
    if (mode === "noting") {
      st.noteTimer -= dt;
      if (st.noteTimer <= 0) {
        st.noteCam = !st.noteCam;
        st.noteTimer = st.noteCam ? 0.8 + rnd() * 0.7 : 2.4 + rnd() * 2;
      }
    } else {
      st.noteCam = false;
      st.noteTimer = 1.5;
    }
    st.camLook = damp(st.camLook, mode === "noting" ? (st.noteCam ? 1 : 0) : 1, 0.12, dt);
    const cl = st.camLook;

    // glances (idle/listening)
    if (st.glT >= 0) {
      st.glT += dt;
      if (st.glT > 0.7) {
        st.glT = -1;
        st.glX = 0;
        st.glY = 0;
      }
    } else if (mode === "listening" || mode === "idle") {
      st.nextGlance -= dt;
      if (st.nextGlance <= 0) {
        st.glT = 0;
        st.glX = (rnd() < 0.5 ? -1 : 1) * (0.18 + rnd() * 0.1);
        st.glY = 0.04 + rnd() * 0.1;
        st.nextGlance = (mode === "listening" ? 3.5 : 5) + rnd() * 4;
      }
    }

    // saccades
    st.nextSac -= dt;
    if (st.nextSac <= 0) {
      st.sacTX = (rnd() - 0.5) * 0.09;
      st.sacTY = (rnd() - 0.5) * 0.06;
      st.nextSac = 0.5 + rnd() * 1.8;
    }
    st.sacX = damp(st.sacX, st.sacTX, 0.05, dt);
    st.sacY = damp(st.sacY, st.sacTY, 0.05, dt);

    // blink
    if (st.blinkP < 0) {
      st.nextBlink -= dt;
      if (st.nextBlink <= 0) {
        st.blinkP = 0;
        st.dbl = rnd() < 0.18;
      }
    } else {
      st.blinkP += dt / 0.16;
      if (st.blinkP >= 1) {
        st.blinkP = -1;
        if (st.dbl) {
          st.dbl = false;
          st.nextBlink = 0.1;
        } else st.nextBlink = 2 + rnd() * 3.5;
      }
    }
    const blinkF = st.blinkP < 0 ? 1 : 1 - Math.sin(Math.PI * Math.pow(st.blinkP, 0.85));

    // scribble
    st.scribT += dt * (reduced ? 0.6 : 1);
    const T = 4.2;
    const ph = (st.scribT / T) % 1;
    const lineN = Math.floor(st.scribT / T);
    const v0 = 0.1 - (lineN % 5) * 0.045;
    const v1 = 0.1 - ((lineN + 1) % 5) * 0.045;
    const sa = Math.sin(t * 23) * 0.012 + Math.sin(t * 37 + 1) * 0.006;
    if (ph < 0.82) {
      const a = ph / 0.82;
      st.penU = lerp(-0.13, 0.09, a) + sa * A;
      st.penV = v0 + (Math.sin(t * 19) * 0.007 + Math.sin(t * 31) * 0.004) * A;
      st.penLift = 0.004 + 0.005 * Math.max(0, Math.sin(t * 9));
    } else {
      const a = (ph - 0.82) / 0.18;
      const sm = ss(0, 1, a);
      st.penU = lerp(0.09, -0.13, sm);
      st.penV = lerp(v0, v1, sm);
      st.penLift = 0.004 + 0.03 * Math.sin(Math.PI * a);
    }
    const flickLift = 0.045 * st.flick;

    /* ---------- head ---------- */
    const hyT =
      wI * A * (0.07 * Math.sin(0.37 * t) + 0.03 * Math.sin(0.83 * t + 1.3)) +
      wS * A * (0.09 * Math.sin(0.8 * t) + 0.04 * Math.sin(1.7 * t + 0.5)) +
      wL * A * (0.05 * Math.sin(0.45 * t) + 0.02 * Math.sin(1.1 * t)) +
      wN * (0.1 + A * 0.02 * Math.sin(0.6 * t));
    const hxT =
      wI * A * 0.02 * Math.sin(0.52 * t + 0.5) +
      wS * (A * (0.02 + 0.03 * Math.sin(2.1 * t)) + 0.07 * A * st.emph) +
      wL * (A * 0.025 + 0.09 * A * nodV) +
      wN * (0.25 - 0.11 * cl + A * 0.008 * Math.sin(3.2 * t) + 0.06 * st.flick);
    const hzT =
      wI * A * 0.03 * Math.sin(0.29 * t + 2) +
      wS * A * 0.035 * Math.sin(1.1 * t + 1) +
      wL * (A * 0.09 + A * 0.02 * Math.sin(0.4 * t)) +
      wN * (-0.04 + A * 0.015 * Math.sin(0.5 * t));
    st.headX = damp(st.headX, hxT, 0.1, dt);
    st.headY = damp(st.headY, hyT, 0.12, dt);
    st.headZ = damp(st.headZ, hzT, 0.12, dt);
    const breath = Math.sin(1.7 * t) * A;
    rig.headPivot.rotation.set(st.headX, st.headY, st.headZ);
    rig.headPivot.position.y = NECK_Y + 0.006 * breath;
    rig.torso.scale.set(0.76 * (1 + 0.005 * breath), 1.0 * (1 + 0.012 * breath), 0.38 * (1 + 0.01 * breath));

    /* ---------- eyes ---------- */
    const gcx = -st.headY * 0.9;
    const gcy = st.headX * 0.9 - 0.1;
    const padGx = 0.05;
    const padGy = -0.36;
    const glw = (wL + 0.6 * wI) * A;
    let gxT = gcx * cl + padGx * (1 - cl) + st.sacX * A + st.glX * glw;
    let gyT = gcy * cl + padGy * (1 - cl) + st.sacY * A + st.glY * glw;
    gxT = clamp(gxT, -0.42, 0.42);
    gyT = clamp(gyT, -0.4, 0.34);
    st.gx = damp(st.gx, gxT, 0.06, dt);
    st.gy = damp(st.gy, gyT, 0.06, dt);

    const lidBase = 0.94 + 0.06 * Math.max(0, st.browRaise) - 0.12 * st.smile * 0.5;
    const lidOpen = clamp(lidBase * blinkF - Math.max(0, -st.gy) * 0.4, 0, 1);
    st.lidOpen = lidOpen;
    for (let i = 0; i < 2; i++) {
      const e = rig.eyes[i];
      e.ball.rotation.set(-st.gy, st.gx, 0);
      e.upper.rotation.x = lerp(0.8, -0.85, lidOpen);
      e.lower.rotation.x = 0.95 - 0.2 * (1 - lidOpen);
    }

    /* ---------- brows / mouth ---------- */
    const brT = wI * 0 + wS * (0.1 + 0.8 * st.emph) + wL * (0.3 + 0.3 * Math.max(0, st.glT >= 0 ? 1 : 0)) + wN * (-0.12 + 0.3 * cl);
    st.browRaise = damp(st.browRaise, brT, 0.1, dt);
    const asymT = wS * 0.12 * Math.sin(0.9 * t + 0.6) + wL * 0.05 * Math.sin(0.5 * t);
    st.browAsym = damp(st.browAsym, asymT, 0.15, dt);
    for (let i = 0; i < 2; i++) {
      const b = rig.brows[i];
      const r = st.browRaise + (i === 0 ? st.browAsym : -st.browAsym);
      b.g.position.y = b.baseY + r * 0.03;
      b.g.rotation.z = b.s * (0.05 + 0.07 * r);
    }
    const smT = wI * 0.32 + wS * (0.28 + 0.3 * st.emph) + wL * 0.5 + wN * 0.14;
    st.smile = damp(st.smile, smT, 0.15, dt);
    rig.updateMouth(st.open, st.mw, st.smile);
    for (let i = 0; i < rig.follow.length; i++) rig.follow[i].morphTargetInfluences![0] = st.open;

    /* ---------- pad + pen ---------- */
    const wPad = clamp(wN * 1.4, 0, 1);
    rig.pad.visible = wPad > 0.02;
    rig.pen.visible = wPad > 0.02;
    const pdrop = 1 - wPad;
    vPalm.copy(PAD_BASE);
    vPalm.y += -0.7 * pdrop + 0.006 * breath;
    vPalm.z += 0.1 * pdrop;
    rig.pad.position.copy(vPalm);
    rig.pad.quaternion.copy(qPad);
    rig.pad.scale.setScalar((0.4 + 0.6 * wPad) * PAD_S);

    // pen tip on the pad plane
    vTip.copy(vPalm).addScaledVector(padX, st.penU * PAD_S).addScaledVector(padY, (st.penV - 0.02) * PAD_S).addScaledVector(padN, 0.014 * PAD_S + st.penLift + flickLift);
    penBackDir(vPenBack);
    rig.pen.position.copy(vTip);
    rig.pen.quaternion.setFromUnitVectors(UP, vPenBack);

    /* ---------- arms ---------- */
    for (let k = 0; k < 2; k++) {
      const arm = rig.arms[k];
      const isR = k === 0; // arm index 0 = avatar's right hand (-x), index 1 = left (+x)
      pole0.set(arm.sx * 0.5, -0.8, -0.55).normalize();
      const rest = isR ? REST_R : REST_L;
      const clasp = isR ? CLASP_R : CLASP_L;
      // blend target position
      tgt.set(0, 0, 0);
      tgt.addScaledVector(rest, wI);
      // listening clasp (+ tiny drift)
      tgt.addScaledVector(clasp, wL);
      if (isR) {
        // speaking gesture
        const gx = -0.4 + 0.07 * Math.sin(1.9 * t + 0.5) * (0.6 + st.emph) * A;
        const gy = -0.68 + (0.05 * Math.sin(2.7 * t) + 0.1 * st.emph) * A;
        const gz = 0.64 + 0.05 * Math.sin(1.3 * t) * A;
        tgt.x += wS * gx;
        tgt.y += wS * gy;
        tgt.z += wS * gz;
      } else {
        tgt.x += wS * (rest.x + 0.02 * Math.sin(1.1 * t + 1) * A);
        tgt.y += wS * (rest.y + 0.015 * Math.sin(1.7 * t) * A);
        tgt.z += wS * rest.z;
      }
      // noting: pen hand / pad hand
      if (isR) {
        // wrist from pen grip
        vHandDir.copy(vPenBack).negate().multiplyScalar(0.62).addScaledVector(foreDir[0], 0.38).normalize();
        vTmp.copy(padN).negate();
        basisQuat(qB, vHandDir, vTmp);
        vPalm.set(0.0, -0.12 * HAND_S, 0.024 * HAND_S).applyQuaternion(qB); // grip offset from wrist
        vA.copy(vTip).addScaledVector(vPenBack, 0.1).sub(vPalm);
        tgt.addScaledVector(vA, wN);
      } else {
        vA.copy(rig.pad.position).addScaledVector(padX, 0.155 * PAD_S).addScaledVector(padY, -0.2 * PAD_S).addScaledVector(padN, -0.075);
        tgt.addScaledVector(vA, wN);
      }
      tgt.y += 0.005 * breath;

      // hand style
      const roll = isR
        ? wI * 1.5 + wS * 0.35 + wL * 1.3 + wN * 1.0
        : wI * -1.5 + wS * -1.5 + wL * -1.3 + wN * -0.7;
      const flex = wI * 0.1 + wS * 0 + wL * 0.25 + wN * (isR ? 0.1 : -0.2);
      const curl = wI * 0.5 + wS * (isR ? 0.18 + 0.1 * Math.sin(2 * t) : 0.35) + wL * 0.5 + wN * (isR ? 0.7 : 0.75);
      const thumb = wI * 0.2 + wS * (isR ? 0 : 0.2) + wL * 0.3 + wN * (isR ? 0.85 : 0.9);
      if (isR) {
        st.rollR = damp(st.rollR, roll, 0.05, dt);
        st.flexR = damp(st.flexR, flex, 0.05, dt);
        st.curlR = damp(st.curlR, curl, 0.05, dt);
        st.thR = damp(st.thR, thumb, 0.05, dt);
      } else {
        st.rollL = damp(st.rollL, roll, 0.05, dt);
        st.flexL = damp(st.flexL, flex, 0.05, dt);
        st.curlL = damp(st.curlL, curl, 0.05, dt);
        st.thL = damp(st.thL, thumb, 0.05, dt);
      }

      solveArm(arm, k, tgt, pole0);

      // hand orientation
      const rr = isR ? st.rollR : st.rollL;
      const ff = isR ? st.flexR : st.flexL;
      qA.setFromUnitVectors(DOWN, foreDir[k]);
      eul.set(ff, rr, 0, "YXZ");
      qE.setFromEuler(eul);
      qA.multiply(qE);
      if (wN > 0.001) {
        if (isR) {
          qA.slerp(qB, wN);
        } else {
          vHandDir.set(0, 0, 0).addScaledVector(padY, 0.55).addScaledVector(padX, -0.6).normalize();
          basisQuat(qB, vHandDir, padN);
          // the palm faces the pad back; thumb side is on -x for the left hand
          qA.slerp(qB, wN);
        }
      }
      arm.hand.root.quaternion.copy(qA);
      setFingers(arm.hand, isR ? st.curlR : st.curlL, isR ? st.thR : st.thL);
    }
  }

  /* ----------------------- sizing / loop / lifecycle ---------------------- */
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 2 || h < 2) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    const top = Math.max(1.28, (rig ? rig.topY : 1.2) + 0.1);
    const bottom = -1.44;
    const visH = Math.max(2.8, top - bottom);
    const cy = (top + bottom) / 2;
    const dist = Math.max(visH / (2 * tanH), 2.0 / (2 * tanH * aspect));
    camera.position.set(0, cy, dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(host);

  let raf = 0;
  let last = 0;
  let disposed = false;
  const frame = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    step(dt);
    renderer.render(scene, camera);
  };
  const start = () => {
    if (raf || disposed) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVis = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener("visibilitychange", onVis);
  const onLost = (e: Event) => e.preventDefault();
  canvas.addEventListener("webglcontextlost", onLost);

  const setParams = (p: AvatarParams) => {
    params = p;
    if (rig) {
      scene.remove(rig.root);
      rig.dispose();
      rig = null;
    }
    rig = buildRig(params, padTex);
    scene.add(rig.root);
    resize();
  };
  setParams(params);
  if (!document.hidden) start();

  return {
    setParams,
    setNotes: (n) => paintPad(padTex, padCanvas, n),
    setInput: (i) => {
      input.mode = i.mode;
      input.mouthShape = i.mouthShape;
      input.noteBeat = i.noteBeat;
    },
    dispose: () => {
      disposed = true;
      stop();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      reducedMq?.removeEventListener?.("change", onReduced);
      if (rig) {
        scene.remove(rig.root);
        rig.dispose();
        rig = null;
      }
      padTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentElement === host) host.removeChild(canvas);
    },
  };
}

/* ------------------------------ React ------------------------------ */

/** Procedural 3D digital-twin avatar (stylized, soft-clay look). Fills its parent. */
export function TwinAvatar3D({
  params,
  mode,
  mouthShape,
  noteBeat = 0,
  notes,
  className,
  style,
}: {
  params: AvatarParams;
  mode: AvatarMode;
  /** 0-3 while speaking; falls back to a natural talking cycle when speaking and this is 0/undefined. */
  mouthShape?: number;
  /** Increments each time a new note is jotted -> pen flick + small nod. */
  noteBeat?: number;
  /** Last few note lines, painted onto the 3D notepad. */
  notes?: string[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [failed, setFailed] = useState(false);

  const paramsKey = JSON.stringify(params);
  const notesKey = notes ? notes.join("\n") : "";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let eng: Engine | null = null;
    try {
      eng = createEngine(host);
    } catch {
      eng = null;
    }
    if (!eng) {
      const id = requestAnimationFrame(() => setFailed(true));
      return () => cancelAnimationFrame(id);
    }
    engineRef.current = eng;
    return () => {
      eng.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setParams(JSON.parse(paramsKey) as AvatarParams);
  }, [paramsKey]);

  useEffect(() => {
    engineRef.current?.setNotes(notesKey ? notesKey.split("\n") : undefined);
  }, [notesKey]);

  useEffect(() => {
    engineRef.current?.setInput({ mode, mouthShape: mouthShape ?? 0, noteBeat });
  }, [mode, mouthShape, noteBeat]);

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}
    >
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      {failed && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            style={{
              width: "min(70%, 70cqh, 220px)",
              aspectRatio: "1",
              borderRadius: "50%",
              background: "linear-gradient(180deg, #eef2f6, #cfd8e2)",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(2,10,12,0.25)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "34%",
                top: "20%",
                width: "32%",
                height: "36%",
                borderRadius: "50%",
                background: "#9aa8b8",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "14%",
                top: "62%",
                width: "72%",
                height: "70%",
                borderRadius: "50%",
                background: "#9aa8b8",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
