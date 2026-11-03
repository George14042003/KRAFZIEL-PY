"use client";

import { useEffect, useRef, useState } from "react";

const STOP_WORDS = new Set(
  "a an the and or but so then well um uh uhh like you know i mean basically actually just really very kind of sort of that this these those it its is are was were be been being am to of in on at for with as by from my me we our us they them their".split(
    " "
  )
);

/** Compress a spoken sentence into a short note: drop filler, keep the meaningful words. */
export function toNote(sentence: string): string {
  const words = sentence.replace(/[^\p{L}\p{N}%$+#./'\- ]/gu, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()) || /^\d/.test(w));
  const picked = (kept.length >= 3 ? kept : words).slice(0, 9);
  if (!picked.length) return "";
  const text = picked.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1) + (kept.length > 9 ? "…" : "");
}

/** Turns a growing answer (typed or transcribed) into a short list of jotted notes,
 * the way an interviewer would write down key points while someone talks.
 * `beat` increments on every new note so the avatar can flick its pen. */
export function useLiveNotes(text: string, resetKey: string | number) {
  const [notes, setNotes] = useState<string[]>([]);
  const [beat, setBeat] = useState(0);
  const consumed = useRef(0);
  const lastKey = useRef(resetKey);

  // Reset when moving on to the next question.
  useEffect(() => {
    if (lastKey.current !== resetKey) {
      lastKey.current = resetKey;
      consumed.current = 0;
      setNotes([]);
    }
  }, [resetKey]);

  useEffect(() => {
    if (lastKey.current !== resetKey) return;
    if (text.length < consumed.current) {
      // The answer was cleared or revised from scratch.
      consumed.current = 0;
    }
    const fresh = text.slice(consumed.current);
    // A "sentence" ends at punctuation, or after ~14 words of unpunctuated speech.
    const sentenceEnd = /[.!?]\s|[.!?]$/;
    let cut = -1;
    const m = sentenceEnd.exec(fresh);
    if (m) cut = m.index + 1;
    else if (fresh.trim().split(/\s+/).length >= 14) cut = fresh.length;
    if (cut < 0) return;

    const sentence = fresh.slice(0, cut);
    consumed.current += cut;
    const note = toNote(sentence);
    if (note) {
      setNotes((prev) => [...prev.slice(-4), note]);
      setBeat((b) => b + 1);
    }
  }, [text, resetKey]);

  return { notes, beat };
}
