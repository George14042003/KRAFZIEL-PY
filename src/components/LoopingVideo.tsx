"use client";

import { useEffect, useRef, useState } from "react";

/** A muted background video that keeps looping no matter what the page does.
 *
 * Plain `<video autoplay loop>` stalls or freezes in practice: the file is streamed (here through a dev
 * server and a tunnel), so any slow response, a recompile or a busy main thread leaves it hanging, and
 * browsers pause muted videos on their own (tab hidden, scrolled away, power saving) and do not always
 * restart them. This component
 *  - downloads the file once and plays it from memory, so playback never waits on the network again;
 *  - starts it explicitly (React renders `muted` without the DOM property, which blocks autoplay);
 *  - restarts it whenever it is paused or stalls while visible, on focus, on user input, and on a timer. */
export function LoopingVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playSrc, setPlaySrc] = useState<string | null>(null);

  // Fetch once, play from a blob URL; fall back to streaming the original if that fails.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPlaySrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPlaySrc(src);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !playSrc) return;
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;

    let visible = true;
    const keepPlaying = () => {
      if (visible && !document.hidden && v.paused) void v.play().catch(() => {});
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        keepPlaying();
      },
      { threshold: 0 },
    );
    io.observe(v);

    keepPlaying();
    const videoEvents = ["pause", "stalled", "waiting", "canplay", "loadeddata", "ended"] as const;
    videoEvents.forEach((e) => v.addEventListener(e, keepPlaying));
    document.addEventListener("visibilitychange", keepPlaying);
    window.addEventListener("focus", keepPlaying);
    window.addEventListener("pageshow", keepPlaying);
    // Any real interaction also counts as permission to start, if autoplay was refused earlier.
    const onInput = () => keepPlaying();
    window.addEventListener("pointerdown", onInput, { passive: true });
    window.addEventListener("keydown", onInput, { passive: true });
    window.addEventListener("scroll", onInput, { passive: true });
    const watchdog = window.setInterval(keepPlaying, 2000);

    return () => {
      io.disconnect();
      videoEvents.forEach((e) => v.removeEventListener(e, keepPlaying));
      document.removeEventListener("visibilitychange", keepPlaying);
      window.removeEventListener("focus", keepPlaying);
      window.removeEventListener("pageshow", keepPlaying);
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("scroll", onInput);
      window.clearInterval(watchdog);
    };
  }, [playSrc]);

  if (!playSrc) return null;
  return <video ref={ref} className={className} src={playSrc} autoPlay muted loop playsInline preload="auto" />;
}
