"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { BotAvatar } from "@/components/BotAvatar";
import { ConsentGate } from "@/components/interview/ConsentGate";
import { cardStyle, inputStyle, primaryButtonStyle, secondaryButtonStyle } from "@/components/dashboard/formStyles";
import { captureVideoFrame } from "@/lib/captureSnapshot";
import {
  getInterviewAttempt,
  sendInterviewHeartbeat,
  submitInterviewAttempt,
  submitInterviewConsent,
  terminateInterviewAttempt,
  uploadIdentitySnapshot,
  type InterviewAttempt,
  type SpeakingMetric,
} from "@/lib/candidates";
import { useProctoring, type ProctorViolation } from "@/hooks/useProctoring";
import { countFillerWords, countWords, useSpeechAnswer } from "@/hooks/useSpeechAnswer";

type Answer = { question: string; answer: string; revised: boolean };
type Mode = "text" | "voice";

type Stage =
  | "loading"
  | "error"
  | "already-done"
  | "not-confirmed"
  | "consent"
  | "intro"
  | "setup"
  | "question"
  | "review"
  | "submitting"
  | "done"
  | "terminated";

type TerminationReason = ProctorViolation | "connection_lost";

const VIOLATION_TEXT: Record<TerminationReason, string> = {
  tab_switch: "you switched away from this tab",
  window_blur: "this window lost focus",
  face_not_detected: "your face couldn't be detected in the camera for too long",
  screen_share_stopped: "screen sharing was stopped",
  connection_lost: "your connection to the interview was interrupted for too long",
};

export function BotInterviewAttemptClient({ interviewId }: { interviewId: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [attempt, setAttempt] = useState<InterviewAttempt | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("text");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [locked, setLocked] = useState(false);
  const [hasRevised, setHasRevised] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [speakingMetrics, setSpeakingMetrics] = useState<SpeakingMetric[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [terminationReason, setTerminationReason] = useState<TerminationReason | null>(null);

  const terminatedRef = useRef(false);
  const answersRef = useRef<Answer[]>([]);
  answersRef.current = answers;

  const speech = useSpeechAnswer();

  const handleViolation = useCallback(
    (reason: ProctorViolation) => {
      if (terminatedRef.current) return;
      terminatedRef.current = true;
      speech.stopListening();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      proctoring.stopAll();
      setTerminationReason(reason);
      setStage("terminated");
      terminateInterviewAttempt(
        interviewId,
        reason,
        answersRef.current.map((a) => ({ question: a.question, answer: a.answer }))
      ).catch(() => {
        // best-effort — the candidate is already locked out client-side regardless
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interviewId]
  );

  const proctoring = useProctoring({
    active: stage === "question" || stage === "review",
    onViolation: handleViolation,
  });

  // Server-side half of proctoring: ping a heartbeat every few seconds while
  // the attempt is live, independent of the client-side tab-switch/face/
  // screen-share checks above. If the server reports back that it already
  // cancelled the interview (heartbeat gap exceeded — see MAX_HEARTBEAT_GAP_SECONDS
  // in the backend), lock the UI the same way a client-detected violation would.
  useEffect(() => {
    if (stage !== "question" && stage !== "review") return;
    const id = setInterval(() => {
      sendInterviewHeartbeat(interviewId)
        .then((result) => {
          if (result.terminated && !terminatedRef.current) {
            terminatedRef.current = true;
            speech.stopListening();
            if (typeof window !== "undefined") window.speechSynthesis?.cancel();
            proctoring.stopAll();
            setTerminationReason("connection_lost");
            setStage("terminated");
          }
        })
        .catch(() => {
          // a single missed ping is just network jitter — the next attempt
          // retries, and the server's own gap check covers genuine tampering
        });
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, interviewId]);

  useEffect(() => {
    getInterviewAttempt(interviewId)
      .then((data) => {
        setAttempt(data);
        if (data.status !== "scheduled") {
          setStage("already-done");
        } else if (data.availability_status !== "accepted") {
          setStage("not-confirmed");
        } else if (!data.consent_accepted) {
          setStage("consent");
        } else {
          setStage("intro");
        }
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Could not load this interview.");
        setStage("error");
      });
  }, [interviewId]);

  async function handleConsentAccept() {
    await submitInterviewConsent(interviewId, {
      recording_and_ai_evaluation: true,
      proctoring_and_identity_snapshot: true,
      data_storage_and_retention: true,
    });
    setStage("intro");
  }

  const questions = attempt?.questions ?? [];

  function continueToSetup() {
    setStage("setup");
  }

  function startInterview() {
    setStartedAt(Date.now());
    setQuestionIndex(0);
    setAnswers([]);
    setSpeakingMetrics([]);
    setDraft("");
    setLocked(false);
    setHasRevised(false);
    setStage("question");

    // Best-effort identity-audit snapshot — never blocks the interview from
    // starting if the capture or upload fails.
    const video = proctoring.videoRef.current;
    if (video) {
      captureVideoFrame(video)
        .then((blob) => (blob ? uploadIdentitySnapshot(interviewId, blob) : null))
        .catch(() => {});
    }
  }

  // In voice mode, speak the question aloud and start listening as soon as a new question appears.
  useEffect(() => {
    if (stage !== "question" || mode !== "voice" || locked) return;
    let cancelled = false;
    (async () => {
      await speech.speak(questions[questionIndex]);
      if (!cancelled && !locked) {
        speech.startListening((transcript) => setDraft(transcript));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, questionIndex, mode]);

  function submitAnswer() {
    if (!draft.trim()) return;
    if (mode === "voice" && speech.listening) {
      const { durationSeconds } = speech.stopListening();
      setSpeakingMetrics((prev) => [
        ...prev,
        { duration_seconds: Math.round(durationSeconds), word_count: countWords(draft), filler_word_count: countFillerWords(draft) },
      ]);
    }
    setLocked(true);
  }

  function reviseAnswer() {
    setLocked(false);
    setHasRevised(true);
    if (mode === "voice") {
      setDraft("");
      speech.startListening((transcript) => setDraft(transcript));
    }
  }

  function nextQuestion() {
    const entry: Answer = { question: questions[questionIndex], answer: draft.trim(), revised: hasRevised };
    const updated = [...answers, entry];
    setAnswers(updated);

    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
      setDraft("");
      setLocked(false);
      setHasRevised(false);
    } else {
      setStage("review");
    }
  }

  async function handleSubmitInterview() {
    setStage("submitting");
    setSubmitError(null);
    const elapsedMinutes = startedAt ? Math.round((Date.now() - startedAt) / 60000) : 5;
    try {
      await submitInterviewAttempt(
        interviewId,
        answers.map((a) => ({ question: a.question, answer: a.answer })),
        Math.min(480, Math.max(1, elapsedMinutes)),
        mode,
        mode === "voice" ? speakingMetrics : undefined
      );
      proctoring.stopAll();
      setStage("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save your interview.");
      setStage("review");
    }
  }

  const setupReady = proctoring.cameraReady && proctoring.screenReady;
  const voiceModeAvailable = speech.supported && speech.speechSupported;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
        <Logo size={34} radius={9} />
        <span style={{ fontSize: "18px", fontWeight: 800, color: "#e2e8f0" }}>Nextenti</span>
      </div>

      {/* Persistent camera preview — a single <video> element survives stage transitions so the
          stream stays attached. Shown as a small floating widget once the camera is live. */}
      <video
        ref={proctoring.videoRef}
        muted
        playsInline
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: proctoring.cameraReady && (stage === "setup" || stage === "question" || stage === "review") ? "140px" : "0px",
          height: proctoring.cameraReady && (stage === "setup" || stage === "question" || stage === "review") ? "105px" : "0px",
          borderRadius: "10px",
          objectFit: "cover",
          border: "2px solid #0e5266",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          transition: "width 0.2s, height 0.2s",
          zIndex: 50,
          background: "#000",
        }}
      />

      <div style={{ width: "100%", maxWidth: "680px" }}>
        {stage === "loading" && (
          <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>Loading…</p>
        )}

        {stage === "error" && (
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <p style={{ fontSize: "14px", color: "#dc2626", margin: 0 }}>{loadError}</p>
          </div>
        )}

        {stage === "already-done" && (
          <div style={{ ...cardStyle, textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
              {attempt?.status === "cancelled" ? "This interview has ended" : "This interview has already been completed"}
            </span>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              Reach out to your recruiter if you think this is a mistake.
            </p>
          </div>
        )}

        {stage === "not-confirmed" && (
          <div style={{ ...cardStyle, textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
              Please confirm your availability first
            </span>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              Check your email for a confirmation link before starting this interview.
            </p>
          </div>
        )}

        {stage === "consent" && (
          <ConsentGate onAccept={handleConsentAccept} />
        )}

        {stage === "terminated" && (
          <div style={{ ...cardStyle, textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#dc2626" }}>Interview ended</span>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              Your interview was ended automatically because {terminationReason ? VIOLATION_TEXT[terminationReason] : "a proctoring check failed"}.
              Any answers you&apos;d already given were saved. Reach out to your recruiter if you think this was a mistake.
            </p>
          </div>
        )}

        {stage !== "loading" &&
          stage !== "error" &&
          stage !== "already-done" &&
          stage !== "not-confirmed" &&
          stage !== "consent" &&
          stage !== "terminated" && (
          <>
            <div style={{ marginBottom: "16px", textAlign: "center" }}>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Bot Interview</h1>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                {attempt ? `Hi ${attempt.candidate_name}, let's get started.` : ""}
              </p>
            </div>

            {stage === "intro" && (
              <div className="fade-in" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Here&apos;s how this works
                </h2>

                <div style={{ borderRadius: "12px", overflow: "hidden", background: "#0a1e2b" }}>
                  <video
                    suppressHydrationWarning
                    style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }}
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    preload="auto"
                    aria-label="Explainer video walking through how the NAIE AI interview engine works"
                  >
                    <source src="/videos/ai_interview_engine_explainer.mp4" type="video/mp4" />
                  </video>
                </div>

                <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <li style={{ fontSize: "13px", color: "#334155" }}>
                    You&apos;ll be asked {questions.length} questions, one at a time.
                  </li>
                  <li style={{ fontSize: "13px", color: "#334155" }}>
                    You get one chance to revise each answer before moving on.
                  </li>
                  <li style={{ fontSize: "13px", color: "#334155" }}>
                    This interview is proctored: your camera and screen share stay on throughout, and it
                    will end automatically if you switch tabs/windows, your face isn&apos;t visible, or
                    screen sharing stops. Other AI tools (ChatGPT, etc.) are forbidden and monitored for.
                  </li>
                  <li style={{ fontSize: "13px", color: "#334155" }}>
                    At the end you&apos;ll review your full set of answers before it&apos;s submitted.
                  </li>
                </ul>

                <div>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#334155", margin: "0 0 8px" }}>
                    How would you like to answer?
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <label
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        border: `1.5px solid ${mode === "text" ? "#01617a" : "#e2e8f0"}`,
                        borderRadius: "10px",
                        cursor: "pointer",
                        background: mode === "text" ? "#f0f9ff" : "#fff",
                      }}
                    >
                      <input type="radio" name="mode" checked={mode === "text"} onChange={() => setMode("text")} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>Type my answers</span>
                    </label>
                    <label
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        border: `1.5px solid ${mode === "voice" ? "#01617a" : "#e2e8f0"}`,
                        borderRadius: "10px",
                        cursor: voiceModeAvailable ? "pointer" : "not-allowed",
                        background: mode === "voice" ? "#f0f9ff" : "#fff",
                        opacity: voiceModeAvailable ? 1 : 0.5,
                      }}
                    >
                      <input
                        type="radio"
                        name="mode"
                        checked={mode === "voice"}
                        onChange={() => voiceModeAvailable && setMode("voice")}
                        disabled={!voiceModeAvailable}
                      />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>Speak my answers</span>
                    </label>
                  </div>
                  {!voiceModeAvailable && (
                    <p style={{ fontSize: "11px", color: "#94a3b8", margin: "6px 0 0" }}>
                      Speaking mode isn&apos;t supported in this browser — try Chrome, or type your answers instead.
                    </p>
                  )}
                </div>

                <div>
                  <button type="button" style={primaryButtonStyle} onClick={continueToSetup}>
                    Continue
                  </button>
                </div>
              </div>
            )}

            {stage === "setup" && (
              <div className="fade-in" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Camera &amp; screen share required
                </h2>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  This interview is proctored. Enable your camera and share your screen to continue —
                  both stay active for the whole interview.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>1. Camera</span>
                    {proctoring.cameraReady ? (
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a" }}>Enabled ✓</span>
                    ) : (
                      <button type="button" style={secondaryButtonStyle} onClick={proctoring.requestCamera}>
                        Enable Camera
                      </button>
                    )}
                  </div>
                  {proctoring.cameraError && (
                    <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }}>{proctoring.cameraError}</p>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>2. Screen share</span>
                    {proctoring.screenReady ? (
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a" }}>Enabled ✓</span>
                    ) : (
                      <button type="button" style={secondaryButtonStyle} onClick={proctoring.requestScreenShare}>
                        Share Your Screen
                      </button>
                    )}
                  </div>
                  {proctoring.screenError && (
                    <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }}>{proctoring.screenError}</p>
                  )}
                </div>

                <div>
                  <button type="button" style={primaryButtonStyle} onClick={startInterview} disabled={!setupReady}>
                    Start Interview
                  </button>
                </div>
              </div>
            )}

            {stage === "question" && (
              <div key={questionIndex} className="fade-in" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "-2px" }}>
                  <BotAvatar
                    speaking={mode === "voice" && speech.speaking}
                    mouthShape={mode === "voice" && speech.speaking ? speech.mouthShape : 0}
                    size={128}
                  />
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textAlign: "center" }}>
                  Question {questionIndex + 1} of {questions.length}
                  {mode === "voice" && speech.listening && (
                    <span style={{ color: "#dc2626", marginLeft: "8px" }}>● Listening…</span>
                  )}
                </span>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  {questions[questionIndex]}
                </p>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  readOnly={locked}
                  rows={5}
                  placeholder={mode === "voice" ? "Your speech will appear here as you talk…" : "Type your answer…"}
                  style={{ ...inputStyle, resize: "vertical", background: locked ? "#f1f5f9" : "#f8fafc" }}
                />
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  {!locked ? (
                    <button type="button" style={primaryButtonStyle} onClick={submitAnswer} disabled={!draft.trim()}>
                      Submit Answer
                    </button>
                  ) : (
                    <>
                      {!hasRevised && (
                        <button type="button" style={secondaryButtonStyle} onClick={reviseAnswer}>
                          Revise Answer
                        </button>
                      )}
                      <button type="button" style={primaryButtonStyle} onClick={nextQuestion}>
                        {questionIndex + 1 < questions.length ? "Next Question" : "Review Answers"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {stage === "review" && (
              <div className="fade-in" style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Review Your Answers</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {answers.map((a, i) => (
                    <div key={i} style={{ borderBottom: i < answers.length - 1 ? "1px solid #e2e8f0" : "none", paddingBottom: "12px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", margin: "0 0 4px" }}>
                        {i + 1}. {a.question}
                      </p>
                      <p style={{ fontSize: "13px", color: "#0f172a", margin: 0, whiteSpace: "pre-wrap" }}>{a.answer}</p>
                    </div>
                  ))}
                </div>
                {submitError && (
                  <p style={{ fontSize: "12px", color: "#dc2626", margin: 0 }} role="alert">
                    {submitError}
                  </p>
                )}
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button type="button" style={primaryButtonStyle} onClick={handleSubmitInterview}>
                    Submit Interview
                  </button>
                </div>
              </div>
            )}

            {stage === "submitting" && (
              <div className="fade-in" style={{ ...cardStyle, textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Submitting…</p>
              </div>
            )}

            {stage === "done" && (
              <div
                className="fade-in"
                style={{ ...cardStyle, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
              >
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Interview submitted</span>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0, maxWidth: "360px" }}>
                  Thanks for completing your interview. Our team will follow up with next steps.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
