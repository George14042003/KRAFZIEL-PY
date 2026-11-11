"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API has no official TS lib types; keep this loosely typed.
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean }; length: number };
};

const FILLER_WORD_PATTERN = /\b(um+|uh+|uhh+|like|you know|kind of|sort of|i guess|i mean|basically|actually)\b/gi;

export function countFillerWords(text: string): number {
  return (text.match(FILLER_WORD_PATTERN) ?? []).length;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function useSpeechAnswer() {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const listeningRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  });
  const [speechSupported] = useState(() => typeof window !== "undefined" && !!window.speechSynthesis);
  const [speaking, setSpeaking] = useState(false);
  const [mouthShape, setMouthShape] = useState(0);
  const mouthCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;

      const clearMouthCloseTimer = () => {
        if (mouthCloseTimerRef.current) {
          clearTimeout(mouthCloseTimerRef.current);
          mouthCloseTimerRef.current = null;
        }
      };

      utter.onstart = () => setSpeaking(true);
      // Word boundaries approximate syllable timing well enough to drive a
      // believable mouth rhythm without needing real audio-amplitude
      // analysis (which the SpeechSynthesis API doesn't expose).
      utter.onboundary = (event) => {
        if (event.name && event.name !== "word") return;
        const word = text.slice(event.charIndex, event.charIndex + (event.charLength || 6));
        const vowelHeavy = /[aoeu]/i.test(word);
        const shape = word.length <= 2 ? 1 : vowelHeavy ? 3 : 2;
        clearMouthCloseTimer();
        setMouthShape(shape);
        mouthCloseTimerRef.current = setTimeout(() => setMouthShape(1), 90);
      };
      utter.onend = () => {
        clearMouthCloseTimer();
        setSpeaking(false);
        setMouthShape(0);
        resolve();
      };
      utter.onerror = () => {
        clearMouthCloseTimer();
        setSpeaking(false);
        setMouthShape(0);
        resolve();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });
  }, []);

  const startListening = useCallback(
    (onUpdate: (transcript: string) => void) => {
      if (!supported) return;
      const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance };
      const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!SR) return;

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      let finalTranscript = "";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interim += transcript;
          }
        }
        onUpdate((finalTranscript + interim).trim());
      };
      recognition.onerror = () => {};
      recognition.onend = () => {
        // The browser stops recognition after a silence gap — restart it
        // transparently as long as the candidate hasn't clicked "Submit Answer".
        if (recognitionRef.current === recognition && listeningRef.current) {
          try {
            recognition.start();
          } catch {
            // already started / not restartable — ignore
          }
        }
      };

      startTimeRef.current = Date.now();
      recognitionRef.current = recognition;
      listeningRef.current = true;
      setListening(true);
      recognition.start();
    },
    [supported]
  );

  const stopListening = useCallback((): { durationSeconds: number } => {
    const durationSeconds = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
    listeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
    return { durationSeconds };
  }, []);

  // Release the mic and speech output if the page goes away mid-question.
  useEffect(
    () => () => {
      listeningRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {
          // already stopped
        }
        recognitionRef.current = null;
      }
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      if (mouthCloseTimerRef.current) clearTimeout(mouthCloseTimerRef.current);
    },
    []
  );

  return { supported, speechSupported, listening, speaking, mouthShape, speak, startListening, stopListening };
}
