"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import aurora from "@/components/aurora/aurora.module.css";
import { AuroraLoading } from "@/components/aurora/AuroraLoading";
import { AuroraPageHeader } from "@/components/aurora/AuroraPageHeader";
import { BotAvatar } from "@/components/BotAvatar";
import { countWords, useSpeechAnswer } from "@/hooks/useSpeechAnswer";
import { useSession } from "@/hooks/useSession";
import {
  clearHistory,
  evaluateMock,
  getMockOptions,
  loadHistory,
  saveSession,
  startMock,
  summariseMock,
  type MockFeedback,
  type MockOptions,
  type MockQuestion,
  type MockRound,
  type MockSession,
  type MockSetup,
} from "@/lib/mockInterview";
import s from "./mock.module.css";

type Stage = "setup" | "starting" | "question" | "summary";

const DEFAULT_SETUP: MockSetup = { interview_type: "mixed", field: null, role: "", difficulty: "medium", count: 5 };
const COUNTS = [3, 5, 8];

function scoreColor(score: number): string {
  return score >= 8 ? "#34d399" : score >= 6 ? "#c8f751" : score >= 4 ? "#fbbf24" : "#fb7185";
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function FeedbackView({ fb, question, showStar }: { fb: MockFeedback; question: MockQuestion; showStar: boolean }) {
  const m = fb.metrics;
  return (
    <div className={s.col}>
      <div className={s.fbHead}>
        <span className={s.scoreBubble} style={{ background: scoreColor(fb.score) }}>
          <b>{fb.score}</b>
          <small>/ 10</small>
        </span>
        <div>
          <div className={s.verdict}>{fb.verdict}</div>
          <p className={s.muted}>{fb.ai ? "AI coach feedback" : "Instant feedback on structure, detail and delivery"}</p>
        </div>
      </div>

      {showStar && (
        <div className={s.starRow} aria-label="STAR structure check">
          {(["situation", "task", "action", "result"] as const).map((k) => (
            <span key={k} className={`${s.star} ${fb.star[k] ? s.starOn : ""}`}>
              {fb.star[k] ? "✓" : "○"} {k[0].toUpperCase() + k.slice(1)}
            </span>
          ))}
        </div>
      )}

      <div className={s.fbCols}>
        <div>
          <h3 className={`${s.fbTitle} ${s.good}`}>What worked</h3>
          <ul className={s.bullets}>
            {fb.strengths.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={`${s.fbTitle} ${s.fix}`}>Improve next time</h3>
          <ul className={s.bullets}>
            {fb.improvements.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className={s.fbTitle}>{fb.model_answer ? "A stronger version" : "What a strong answer covers"}</h3>
        <p className={s.model}>{fb.model_answer ?? question.tip}</p>
        {fb.model_answer && <p className={s.muted}>Use it as a pattern, not a script. Replace any [placeholders] with your own real details.</p>}
      </div>

      <div className={s.metrics}>
        <span>
          <b>{m.word_count}</b> words
        </span>
        <span>
          <b>{m.numbers}</b> numbers or figures
        </span>
        <span>
          <b>{m.filler_words}</b> filler words
        </span>
        <span>
          <b>{m.hedges}</b> hedges
        </span>
      </div>
    </div>
  );
}

export function MockInterviewClient() {
  const { user, loading } = useSession("candidate");
  const [options, setOptions] = useState<MockOptions | null>(null);
  const [history, setHistory] = useState<MockSession[]>([]);
  const [setup, setSetup] = useState<MockSetup>(DEFAULT_SETUP);
  const [voice, setVoice] = useState(false);
  const [stage, setStage] = useState<Stage>("setup");
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<MockFeedback | null>(null);
  const [rounds, setRounds] = useState<MockRound[]>([]);
  const [session, setSession] = useState<MockSession | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [width, setWidth] = useState(1024);

  const speech = useSpeechAnswer();
  const speechRef = useRef(speech);
  useEffect(() => {
    speechRef.current = speech;
  });
  const voiceAvailable = speech.supported && speech.speechSupported;
  const useVoice = voice && voiceAvailable;

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!user) return;
    getMockOptions()
      .then(setOptions)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load mock interviews."))
      .finally(() => setHistory(loadHistory(user.id)));
  }, [user]);

  // Never leave the microphone or speech synthesis running when the page closes.
  useEffect(
    () => () => {
      speechRef.current.stopListening();
      window.speechSynthesis?.cancel();
    },
    []
  );

  const current = questions[index];

  // Voice mode: read the question aloud, then start listening for the answer.
  useEffect(() => {
    if (stage !== "question" || !useVoice || feedback || !current) return;
    let cancelled = false;
    (async () => {
      await speechRef.current.speak(current.text);
      if (!cancelled) speechRef.current.startListening((t) => setDraft(t));
    })();
    return () => {
      cancelled = true;
      speechRef.current.stopListening();
      window.speechSynthesis?.cancel();
    };
  }, [stage, index, useVoice, feedback, current]);

  const begin = useCallback(
    async (next: MockSetup) => {
      setError(null);
      setSetup(next);
      setStage("starting");
      try {
        const res = await startMock(next);
        if (!res.questions.length) throw new Error("No questions were available. Try a different setup.");
        setQuestions(res.questions);
        setIndex(0);
        setRounds([]);
        setDraft("");
        setFeedback(null);
        setShowTip(false);
        setStage("question");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start the mock interview.");
        setStage("setup");
      }
    },
    []
  );

  async function getFeedback() {
    if (!current || !draft.trim()) return;
    speech.stopListening();
    setBusy(true);
    setError(null);
    try {
      setFeedback(await evaluateMock(setup, current.text, draft.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function tryAgain() {
    setFeedback(null);
    setDraft("");
  }

  async function next() {
    if (!feedback || !current || !user) return;
    const updated = [...rounds.filter((r) => r.question.id !== current.id), { question: current, answer: draft.trim(), feedback }];
    setRounds(updated);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setDraft("");
      setFeedback(null);
      setShowTip(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const summary = await summariseMock(updated.map((r) => ({ question: r.question.text, score: r.feedback.score, tags: r.feedback.tags })));
      const finished: MockSession = { id: `${Date.now()}`, at: new Date().toISOString(), setup, rounds: updated, summary };
      setHistory(saveSession(user.id, finished));
      setSession(finished);
      setOpen(null);
      setStage("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build your summary. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function review(item: MockSession) {
    setSession(item);
    setOpen(null);
    setStage("summary");
  }

  function backToSetup() {
    setStage("setup");
    setSession(null);
    setError(null);
  }

  if (loading || !user) return <AuroraLoading />;

  const typeLabel = (key: string) => options?.interview_types.find((t) => t.key === key)?.label ?? key;
  const showStar = setup.interview_type === "behavioral" || setup.interview_type === "mixed";
  const words = countWords(draft);

  return (
    <>
      <AuroraPageHeader
        eyebrow="Practice"
        title="Mock interviews"
        subtitle="Rehearse with an AI interviewer, get instant feedback on every answer, and see how you improve. Practice is private and never counts toward a real interview."
      />

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      {stage === "setup" && (
        <div className={s.twoCol}>
          <section className={`${aurora.glass} ${aurora.card} ${s.col}`}>
            <h2 className={s.h2}>Set up your round</h2>

            <div>
              <span className={s.label}>Interview type</span>
              <div className={s.choices} role="radiogroup" aria-label="Interview type">
                {(options?.interview_types ?? []).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={setup.interview_type === t.key}
                    className={`${s.choice} ${setup.interview_type === t.key ? s.choiceOn : ""}`}
                    onClick={() => setSetup({ ...setup, interview_type: t.key })}
                  >
                    <span className={s.choiceTitle}>{t.label}</span>
                    <span className={s.choiceBlurb}>{t.blurb}</span>
                  </button>
                ))}
              </div>
            </div>

            {setup.interview_type === "technical" && (
              <div>
                <span className={s.label}>Role area</span>
                <div className={s.pills} role="radiogroup" aria-label="Role area">
                  {(options?.fields ?? []).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      role="radio"
                      aria-checked={setup.field === f.key}
                      className={`${s.pill} ${setup.field === f.key ? s.pillOn : ""}`}
                      onClick={() => setSetup({ ...setup, field: f.key })}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={aurora.field}>
              <label className={aurora.lbl} htmlFor="mock-role">
                Role you are preparing for (optional)
              </label>
              <input
                id="mock-role"
                className={aurora.inp}
                value={setup.role}
                maxLength={80}
                onChange={(e) => setSetup({ ...setup, role: e.target.value })}
                placeholder="e.g. Junior data analyst, retail bank"
              />
              <p className={s.muted}>{options?.ai_enabled ? "Questions are tailored to this role." : "Add a role to tailor questions when AI is enabled."}</p>
            </div>

            <div>
              <span className={s.label}>Difficulty</span>
              <div className={s.pills} role="radiogroup" aria-label="Difficulty">
                {(options?.difficulties ?? []).map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    role="radio"
                    aria-checked={setup.difficulty === d.key}
                    className={`${s.pill} ${setup.difficulty === d.key ? s.pillOn : ""}`}
                    onClick={() => setSetup({ ...setup, difficulty: d.key })}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={s.label}>Number of questions</span>
              <div className={s.pills} role="radiogroup" aria-label="Number of questions">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={setup.count === n}
                    className={`${s.pill} ${setup.count === n ? s.pillOn : ""}`}
                    onClick={() => setSetup({ ...setup, count: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={s.label}>How will you answer?</span>
              <div className={s.pills} role="radiogroup" aria-label="Answer mode">
                <button type="button" role="radio" aria-checked={!voice} className={`${s.pill} ${!voice ? s.pillOn : ""}`} onClick={() => setVoice(false)}>
                  Type
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={voice}
                  disabled={!voiceAvailable}
                  className={`${s.pill} ${voice ? s.pillOn : ""}`}
                  style={!voiceAvailable ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  onClick={() => setVoice(true)}
                >
                  Speak
                </button>
              </div>
              {!voiceAvailable && <p className={s.muted}>Speaking needs a browser with speech recognition, such as Chrome.</p>}
            </div>

            <div className={s.actions}>
              <button
                type="button"
                className={`${aurora.btn} ${aurora.btnAccent}`}
                disabled={!options || (setup.interview_type === "technical" && !setup.field)}
                onClick={() => begin(setup)}
              >
                Start mock interview
              </button>
              {setup.interview_type === "technical" && !setup.field && <span className={s.muted}>Pick a role area to continue.</span>}
            </div>
          </section>

          <section className={`${aurora.glass} ${aurora.card} ${s.col}`}>
            <h2 className={s.h2}>Your practice history</h2>
            {history.length === 0 ? (
              <p className={s.sub}>Finished rounds appear here so you can review feedback and watch your score climb. History is saved on this device.</p>
            ) : (
              <>
                <div className={s.trend} aria-label="Recent scores, oldest to newest">
                  {[...history]
                    .slice(0, 10)
                    .reverse()
                    .map((h) => (
                      <i key={h.id} style={{ height: `${Math.max(8, h.summary.average * 10)}%`, background: scoreColor(h.summary.average) }} title={`${h.summary.average}/10`} />
                    ))}
                </div>
                {history.slice(0, 6).map((h) => (
                  <div key={h.id} className={s.histItem}>
                    <div>
                      <div className={s.histTitle}>
                        {typeLabel(h.setup.interview_type)} · {h.summary.average}/10
                      </div>
                      <div className={s.histMeta}>
                        {when(h.at)} · {h.rounds.length} questions{h.setup.role ? ` · ${h.setup.role}` : ""}
                      </div>
                    </div>
                    <button type="button" className={`${aurora.btn} ${aurora.btnSm}`} onClick={() => review(h)}>
                      Review
                    </button>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    className={`${aurora.btn} ${aurora.btnSm}`}
                    onClick={() => {
                      clearHistory(user.id);
                      setHistory([]);
                    }}
                  >
                    Clear history
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {stage === "starting" && (
        <section className={`${aurora.glass} ${aurora.card}`} aria-live="polite">
          <p className={s.sub}>Preparing your questions…</p>
        </section>
      )}

      {stage === "question" && current && (
        <div className={s.col}>
          <div className={s.progressRow}>
            <span className={s.stepText}>
              Question {index + 1} of {questions.length}
            </span>
            <span className={s.focusTag}>{current.focus}</span>
          </div>

          <section className={`${aurora.glass} ${aurora.card} ${s.col}`}>
            <div className={s.qCard}>
              {useVoice && (
                <div className={s.qBot}>
                  <BotAvatar speaking={speech.speaking} mouthShape={speech.speaking ? speech.mouthShape : 0} size={Math.min(130, width - 96)} />
                </div>
              )}
              <p className={s.qText}>{current.text}</p>
            </div>

            {!feedback && (
              <>
                {showTip ? (
                  <p className={s.tip}>{current.tip}</p>
                ) : (
                  <button type="button" className={s.tipBtn} onClick={() => setShowTip(true)}>
                    Show a hint
                  </button>
                )}
                <label className={s.srOnly} htmlFor="mock-answer">
                  Your answer
                </label>
                <textarea
                  id="mock-answer"
                  className={s.answerBox}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={useVoice ? "Your speech appears here as you talk. You can edit it before submitting." : "Type your answer as you would say it in the interview…"}
                  disabled={busy}
                />
                <div className={s.metaRow}>
                  <span>
                    {words} words{words > 0 && words < 40 ? " · aim for 80 to 200" : ""}
                  </span>
                  {useVoice && speech.listening && <span className={s.listening}>● Listening…</span>}
                </div>
                <div className={s.actions}>
                  <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} disabled={busy || !draft.trim()} onClick={getFeedback}>
                    {busy ? "Analysing your answer…" : "Get feedback"}
                  </button>
                  {useVoice && !busy && (
                    <button
                      type="button"
                      className={aurora.btn}
                      onClick={() => (speech.listening ? speech.stopListening() : speech.startListening((t) => setDraft(t)))}
                    >
                      {speech.listening ? "Pause mic" : "Resume mic"}
                    </button>
                  )}
                  <button type="button" className={aurora.btn} onClick={backToSetup} disabled={busy}>
                    End session
                  </button>
                </div>
              </>
            )}
          </section>

          {feedback && (
            <section className={`${aurora.glass} ${aurora.card} ${s.col}`} aria-live="polite">
              <FeedbackView fb={feedback} question={current} showStar={showStar} />
              <div className={s.actions}>
                <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} onClick={next} disabled={busy}>
                  {busy ? "Building your summary…" : index + 1 < questions.length ? "Next question" : "Finish and see summary"}
                </button>
                <button type="button" className={aurora.btn} onClick={tryAgain} disabled={busy}>
                  Try again
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {stage === "summary" && session && (
        <div className={s.col}>
          <section className={`${aurora.glass} ${aurora.card} ${s.col}`}>
            <div className={s.sumTop}>
              <div className={s.bigScore}>
                {session.summary.average}
                <small> / 10</small>
              </div>
              <div>
                <div className={s.readiness}>{session.summary.readiness}</div>
                <p className={s.sub}>
                  {typeLabel(session.setup.interview_type)} · {session.rounds.length} questions
                  {session.setup.role ? ` · ${session.setup.role}` : ""}
                </p>
              </div>
            </div>
            <div className={s.fbCols}>
              <div>
                <h3 className={`${s.fbTitle} ${s.good}`}>Your strengths</h3>
                <ul className={s.bullets}>
                  {session.summary.strengths.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={`${s.fbTitle} ${s.fix}`}>Your next steps</h3>
                <ul className={s.bullets}>
                  {session.summary.next_steps.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className={s.actions}>
              <button type="button" className={`${aurora.btn} ${aurora.btnAccent}`} onClick={() => begin(session.setup)}>
                Practise again
              </button>
              <button type="button" className={aurora.btn} onClick={backToSetup}>
                Change setup
              </button>
            </div>
          </section>

          <section className={`${aurora.glass} ${aurora.card} ${s.col}`}>
            <h2 className={s.h2}>Answer by answer</h2>
            <ul className={s.roundList}>
              {session.rounds.map((r, i) => (
                <li key={r.question.id} className={s.roundItem}>
                  <button type="button" className={s.roundBtn} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                    <span className={s.roundScore} style={{ background: scoreColor(r.feedback.score) }}>
                      {r.feedback.score}
                    </span>
                    <span className={s.roundQ}>{r.question.text}</span>
                    <span aria-hidden="true">{open === i ? "−" : "+"}</span>
                  </button>
                  {open === i && (
                    <div className={s.roundBody}>
                      <div>
                        <h3 className={s.fbTitle}>Your answer</h3>
                        <p className={s.yourAnswer}>{r.answer}</p>
                      </div>
                      <FeedbackView
                        fb={r.feedback}
                        question={r.question}
                        showStar={session.setup.interview_type === "behavioral" || session.setup.interview_type === "mixed"}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
