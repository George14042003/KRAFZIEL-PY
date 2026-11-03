"use client";

import { useEffect, useRef, useState } from "react";

const NUMBER = /^(-?\d+(?:\.\d+)?)(.*)$/;

/** Counts a number up from zero when it first appears (and tweens when it changes).
 * Accepts numbers or strings with a numeric prefix, e.g. "42%". Anything else renders as is.
 * Honours prefers-reduced-motion by showing the final value immediately. */
export function CountUp({ value, durationMs = 1100 }: { value: number | string; durationMs?: number }) {
  const text = String(value);
  const match = NUMBER.exec(text);
  const target = match ? Number(match[1]) : null;
  const suffix = match ? match[2] : "";
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;

  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const snap = requestAnimationFrame(() => {
        fromRef.current = target;
        setShown(target);
      });
      return () => cancelAnimationFrame(snap);
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (target - from) * eased;
      fromRef.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  if (target === null) return <>{text}</>;
  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  );
}
