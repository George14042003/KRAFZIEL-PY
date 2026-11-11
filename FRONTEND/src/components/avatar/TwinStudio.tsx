"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { deleteMyAvatar, getMyAvatar, saveMyAvatar } from "@/lib/avatar";
import {
  clampFace,
  DEFAULT_AVATAR,
  FACE_MAX,
  FACE_MIN,
  FACIAL_HAIR,
  HAIR_STYLES,
  type AvatarMode,
  type AvatarParams,
  type FaceShape,
} from "@/lib/avatarTypes";
import { FaceScanner } from "./FaceScanner";
import styles from "./TwinStudio.module.css";

const TwinAvatar3D = dynamic(() => import("./TwinAvatar3D").then((m) => m.TwinAvatar3D), { ssr: false });

type View = "loading" | "empty" | "consent" | "scan" | "edit" | "saved";

const FACE_FIELDS: { key: keyof FaceShape; label: string }[] = [
  { key: "width", label: "Head width" },
  { key: "height", label: "Head height" },
  { key: "jaw", label: "Jaw" },
  { key: "eyeSpacing", label: "Eye spacing" },
  { key: "browHeight", label: "Brow height" },
  { key: "noseWidth", label: "Nose width" },
  { key: "mouthWidth", label: "Mouth width" },
];

const PREVIEW_MODES: { mode: AvatarMode; label: string }[] = [
  { mode: "idle", label: "Idle" },
  { mode: "speaking", label: "Speaking" },
  { mode: "listening", label: "Listening" },
  { mode: "noting", label: "Taking notes" },
];

const SWATCHES = [
  ["skin", "Skin"],
  ["hair", "Hair"],
  ["eyes", "Eyes"],
  ["shirt", "Shirt"],
] as const;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Employer-side setup of the digital twin that conducts God level interviews. */
export function TwinStudio() {
  const [view, setView] = useState<View>("loading");
  const [hasSaved, setHasSaved] = useState(false);
  const [params, setParams] = useState<AvatarParams>(DEFAULT_AVATAR);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<AvatarMode>("speaking");
  const [mouth, setMouth] = useState(0);

  useEffect(() => {
    getMyAvatar()
      .then((p) => {
        if (p.params) {
          setParams(p.params);
          setHasSaved(true);
          setView("saved");
        } else {
          setView("empty");
        }
      })
      .catch(() => setView("empty"));
  }, []);

  // Cycle a fake mouth shape so the speaking preview is alive without audio.
  useEffect(() => {
    if (previewMode !== "speaking") return;
    const id = setInterval(() => setMouth(Math.floor(Math.random() * 4)), 140);
    return () => clearInterval(id);
  }, [previewMode]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveMyAvatar(params);
      setHasSaved(true);
      setView("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your twin.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete your digital twin? God level interviews will stop working until you create a new one.")) return;
    try {
      await deleteMyAvatar();
      setParams(DEFAULT_AVATAR);
      setHasSaved(false);
      setView("empty");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete your twin.");
    }
  }

  const set = <K extends keyof AvatarParams>(key: K, value: AvatarParams[K]) => setParams((p) => ({ ...p, [key]: value }));
  const setFace = (key: keyof FaceShape, value: number) =>
    setParams((p) => ({ ...p, face: { ...p.face, [key]: clampFace(value) } }));

  const locked = view === "saved";

  return (
    <section className={`${aurora.glass} ${styles.card}`}>
      <div>
        <span className={styles.tag}>God level</span>
        <h2 className={`${aurora.display} ${styles.h2}`}>Digital twin</h2>
        <p className={styles.sub}>
          An animated version of you that asks candidates the questions out loud and takes notes while they answer.
          Built from a five-angle face scan; only the avatar&apos;s look is stored, never your photos.
        </p>
      </div>

      {view === "loading" && <p className={styles.sub}>Loading…</p>}

      {view === "empty" && (
        <div className={styles.cta}>
          <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} onClick={() => setView("consent")}>
            Create my digital twin
          </button>
        </div>
      )}

      {view === "consent" && (
        <div className={styles.consent}>
          <label className={styles.check}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I agree to my face being scanned in this browser to create a stylised avatar of me, and that this
              avatar will be shown to candidates as my AI twin. The scan photos are discarded after the avatar is
              created, and I can delete the twin at any time.
            </span>
          </label>
          <div className={styles.row}>
            <button
              type="button"
              className={`${aurora.btn} ${aurora.btnGlass}`}
              onClick={() => setView(hasSaved ? "saved" : "empty")}
            >
              Cancel
            </button>
            <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} disabled={!consent} onClick={() => setView("scan")}>
              Start face scan
            </button>
          </div>
        </div>
      )}

      {view === "scan" && (
        <FaceScanner
          subtitle="Your photos stay in this browser tab and are discarded after the avatar is built."
          onCancel={() => setView("consent")}
          onComplete={(result) => {
            setParams(result.params);
            setView("edit");
          }}
        />
      )}

      {(view === "edit" || view === "saved") && (
        <div className={styles.grid}>
          <div>
            <div className={styles.preview}>
              <TwinAvatar3D params={params} mode={previewMode} mouthShape={previewMode === "speaking" ? mouth : 0} noteBeat={0} />
            </div>
            <div className={styles.modes} role="group" aria-label="Preview animation">
              {PREVIEW_MODES.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  className={previewMode === m.mode ? styles.modeOn : styles.mode}
                  onClick={() => setPreviewMode(m.mode)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controls}>
            <p className={styles.sub}>
              {view === "edit"
                ? "This is your twin. Fine-tune anything that isn't quite right, then save."
                : "Your twin is active. You can now schedule God level bot interviews."}
            </p>

            <div className={styles.swatches}>
              {SWATCHES.map(([key, label]) => (
                <label key={key} className={styles.swatch}>
                  <input type="color" value={params[key]} onChange={(e) => set(key, e.target.value)} disabled={locked} />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className={styles.two}>
              <div className={aurora.field}>
                <label className={aurora.lbl}>Hair</label>
                <select
                  className={aurora.inp}
                  value={params.hairStyle}
                  disabled={locked}
                  onChange={(e) => set("hairStyle", e.target.value as AvatarParams["hairStyle"])}
                >
                  {HAIR_STYLES.map((h) => (
                    <option key={h} value={h}>{cap(h)}</option>
                  ))}
                </select>
              </div>
              <div className={aurora.field}>
                <label className={aurora.lbl}>Facial hair</label>
                <select
                  className={aurora.inp}
                  value={params.facialHair}
                  disabled={locked}
                  onChange={(e) => set("facialHair", e.target.value as AvatarParams["facialHair"])}
                >
                  {FACIAL_HAIR.map((h) => (
                    <option key={h} value={h}>{cap(h)}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className={styles.check}>
              <input type="checkbox" checked={params.glasses} disabled={locked} onChange={(e) => set("glasses", e.target.checked)} />
              <span>Glasses</span>
            </label>

            <div className={styles.sliders}>
              {FACE_FIELDS.map((f) => (
                <label key={f.key} className={styles.slider}>
                  <span>{f.label}</span>
                  <input
                    type="range"
                    min={FACE_MIN}
                    max={FACE_MAX}
                    step={0.01}
                    value={params.face[f.key]}
                    disabled={locked}
                    onChange={(e) => setFace(f.key, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <div className={styles.row}>
              {view === "edit" ? (
                <>
                  <button type="button" className={`${aurora.btn} ${aurora.btnGlass}`} onClick={() => setView("scan")}>
                    Re-scan
                  </button>
                  <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} disabled={saving} onClick={save}>
                    {saving ? "Saving…" : "Save my twin"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={`${aurora.btn} ${aurora.btnGlass}`} onClick={() => setView("edit")}>
                    Edit look
                  </button>
                  <button type="button" className={`${aurora.btn} ${aurora.btnGlass}`} onClick={() => setView("consent")}>
                    Re-scan
                  </button>
                  <button type="button" className={styles.danger} onClick={remove}>
                    Delete twin
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
