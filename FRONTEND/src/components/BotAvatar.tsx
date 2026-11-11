"use client";

import { useEffect, useState } from "react";

/** Mouth shapes, keyed the same way useSpeechAnswer's `mouthShape` reports them:
 * 0 = resting/closed, 1 = small/consonant, 2 = medium, 3 = wide/open vowel. */
function Mouth({ shape }: { shape: number }) {
  switch (shape) {
    case 1:
      return <rect x="41" y="66" width="18" height="4" rx="2" fill="#7a4632" />;
    case 2:
      return <ellipse cx="50" cy="67" rx="10" ry="6" fill="#7a4632" />;
    case 3:
      return <ellipse cx="50" cy="67" rx="13" ry="10" fill="#5c3324" />;
    default:
      return <path d="M40 66 Q50 70 60 66" stroke="#7a4632" strokeWidth="3" strokeLinecap="round" fill="none" />;
  }
}

/** A polished illustrated 2D interviewer avatar. Blinks while idle, and its
 * mouth cycles through viseme-like shapes synced to TTS word-boundary events
 * (see useSpeechAnswer) — an approximation of real lip-sync without needing
 * a paid photorealistic video-generation service. */
export function BotAvatar({
  speaking,
  mouthShape = 0,
  size = 96,
}: {
  speaking: boolean;
  /** 0-3, see Mouth() above. Falls back to a slow open/close cycle if omitted. */
  mouthShape?: number;
  size?: number;
}) {
  const [blink, setBlink] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(
      () => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
      },
      2600 + Math.random() * 2000
    );
    return () => clearInterval(id);
  }, []);

  // If a caller drives speaking without word-boundary data, fall back to a
  // gentle alternating shape so the avatar still looks alive.
  useEffect(() => {
    if (!speaking || mouthShape) {
      setFallbackOpen(false);
      return;
    }
    const id = setInterval(() => setFallbackOpen((v) => !v), 220);
    return () => clearInterval(id);
  }, [speaking, mouthShape]);

  const activeShape = mouthShape || (speaking && fallbackOpen ? 2 : 0);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "linear-gradient(180deg, #eef2f6, #dbe2ea)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: speaking
          ? "0 0 0 6px rgba(21,122,143,0.18), 0 8px 24px rgba(2,10,12,0.3)"
          : "0 8px 24px rgba(2,10,12,0.3)",
        transition: "box-shadow 0.25s ease",
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {/* neck + shoulders / collar */}
        <rect x="38" y="78" width="24" height="14" fill="#d8c3a5" />
        <path d="M14 100 C14 82 30 74 50 74 C70 74 86 82 86 100 Z" fill="#2b3a4a" />
        <path d="M40 78 L50 90 L60 78 L54 92 L46 92 Z" fill="#f4f6f8" />

        {/* head */}
        <ellipse cx="50" cy="46" rx="27" ry="30" fill="#e8c9a4" />
        {/* ears */}
        <ellipse cx="22" cy="48" rx="4.5" ry="6.5" fill="#e0bd95" />
        <ellipse cx="78" cy="48" rx="4.5" ry="6.5" fill="#e0bd95" />

        {/* hair */}
        <path
          d="M23 40 C21 20 34 8 50 8 C66 8 79 20 77 40 C77 30 68 22 50 22 C32 22 23 30 23 40 Z"
          fill="#3b2c22"
        />
        <path d="M23 40 C22 46 23 52 25 56 C22 50 21 44 23 40 Z" fill="#3b2c22" />
        <path d="M77 40 C78 46 77 52 75 56 C78 50 79 44 77 40 Z" fill="#3b2c22" />

        {/* eyebrows */}
        <rect x="29" y="35" width="12" height="3" rx="1.5" fill="#3b2c22" />
        <rect x="59" y="35" width="12" height="3" rx="1.5" fill="#3b2c22" />

        {/* eyes */}
        <ellipse cx="35" cy="43" rx="5" ry={blink ? 0.6 : 5} fill="#fff" style={{ transition: "ry 0.08s ease" }} />
        <ellipse cx="65" cy="43" rx="5" ry={blink ? 0.6 : 5} fill="#fff" style={{ transition: "ry 0.08s ease" }} />
        {!blink && (
          <>
            <circle cx="36" cy="44" r="2.6" fill="#3d2b1f" />
            <circle cx="66" cy="44" r="2.6" fill="#3d2b1f" />
          </>
        )}

        {/* nose */}
        <path d="M50 44 L47 58 Q50 61 53 58 Z" fill="#dcb98f" opacity="0.7" />

        {/* mouth */}
        <Mouth shape={activeShape} />
      </svg>
    </div>
  );
}
