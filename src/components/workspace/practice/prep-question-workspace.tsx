"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock3,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  NotebookPen,
  RotateCcw,
  Send,
  SkipForward,
  Sparkles
} from "lucide-react";
import type { PrepPracticeQuestion, PrepPracticeReview } from "@/lib/practice/prep-practice";
import {
  PrepStateSaveQueue,
  type PrepStatePatch,
  type PrepStateSaveStatus
} from "@/lib/practice/prep-state-save-queue";

export function PrepQuestionWorkspace({ question }: { question: PrepPracticeQuestion }) {
  const router = useRouter();
  const initialOption = parseSavedOption(question.draftAnswer);
  const [answer, setAnswer] = useState(initialOption === null ? question.draftAnswer : "");
  const answerRef = useRef(answer);
  const [selectedOption, setSelectedOption] = useState<number | null>(initialOption);
  const [note, setNote] = useState(question.note);
  const [revealedHints, setRevealedHints] = useState(question.revealedHintCount);
  const [review, setReview] = useState<PrepPracticeReview | null>(question.review);
  const [status, setStatus] = useState(question.status);
  const [saveState, setSaveState] = useState<PrepStateSaveStatus>("idle");
  const [submitting, setSubmitting] = useState<"submit" | "skip" | null>(null);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [noteOpen, setNoteOpen] = useState(Boolean(question.note));
  const [dictationState, setDictationState] = useState<"idle" | "listening" | "stopping">("idle");
  const startedAt = useRef(Date.now());
  const mounted = useRef(true);
  const draftTimer = useRef<number | null>(null);
  const noteTimer = useRef<number | null>(null);
  const activeDictation = useRef<ActiveDictationSession | null>(null);
  const [saveQueue] = useState(
    () =>
      new PrepStateSaveQueue(
        (fields, delivery) => persistState(question, fields, delivery.retryCount),
        (nextState) => {
          if (mounted.current) setSaveState(nextState);
        }
      )
  );

  const savedDraft =
    question.format === "mcq" && selectedOption !== null ? `option:${selectedOption}` : answer;

  useEffect(() => {
    mounted.current = true;
    const flushForPageExit = () => {
      const session = activeDictation.current;
      if (session) {
        session.requestedStop = true;
        try {
          session.recognition.stop();
        } catch {
          session.finish();
        }
      }
      clearSaveTimers();
      void saveQueue.flush().catch(() => undefined);
    };
    window.addEventListener("pagehide", flushForPageExit);
    return () => {
      window.removeEventListener("pagehide", flushForPageExit);
      clearSaveTimers();
      mounted.current = false;
      const session = activeDictation.current;
      if (session) {
        session.recognition.onresult = null;
        session.recognition.onend = null;
        session.recognition.onerror = null;
        try {
          session.recognition.abort();
        } catch {
          // The browser may already have ended the recognition session.
        }
        session.finish();
      }
      void saveQueue.flush().catch(() => undefined);
    };
  }, [saveQueue]);

  function clearSaveTimers() {
    if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    draftTimer.current = null;
    noteTimer.current = null;
  }

  function scheduleDraftSave(draftAnswer: string) {
    saveQueue.enqueue({ draftAnswer });
    if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      draftTimer.current = null;
      void saveQueue.flush().catch(() => undefined);
    }, 700);
  }

  function scheduleNoteSave(nextNote: string) {
    saveQueue.enqueue({ note: nextNote });
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      noteTimer.current = null;
      void saveQueue.flush().catch(() => undefined);
    }, 900);
  }

  async function flushPendingState() {
    clearSaveTimers();
    await saveQueue.flush();
  }

  async function revealHint() {
    const next = Math.min(revealedHints + 1, question.hints.length);
    setRevealedHints(next);
    saveQueue.enqueue({ revealedHintCount: next });
    try {
      await flushPendingState();
    } catch {
      setError("That hint is open, but its progress could not be saved yet.");
    }
  }

  async function attempt(action: "submit" | "skip") {
    if (submitting) return;
    setError("");
    setSubmitting(action);
    try {
      await stopActiveDictation();
      const currentAnswer = answerRef.current;
      if (action === "submit") {
        if (question.format === "mcq" && selectedOption === null) {
          setError("Choose an option before submitting.");
          return;
        }
        if (question.format !== "mcq" && currentAnswer.trim().length < 12) {
          setError("Write a little more before submitting your answer.");
          return;
        }
      }
      await flushPendingState();
      const response = await fetch("/api/practice/attempt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          sessionKey: question.sessionKey,
          questionId: question.id,
          action,
          answer: question.format === "mcq" ? savedDraft : currentAnswer,
          selectedOptionIndex: selectedOption,
          durationMs: Date.now() - startedAt.current
        })
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as {
        data: { review: PrepPracticeReview; status: PrepPracticeQuestion["status"] };
      };
      setReview(payload.data.review);
      setStatus(payload.data.status);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your answer could not be saved.");
    } finally {
      setSubmitting(null);
    }
  }

  async function navigateAfterSave(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (navigatingTo) return;
    setError("");
    setNavigatingTo(href);
    try {
      await stopActiveDictation();
      await flushPendingState();
      router.push(href);
    } catch {
      setNavigatingTo(null);
      setError("Your latest changes could not be saved. Stay here and retry before leaving.");
    }
  }

  function toggleDictation() {
    if (activeDictation.current) {
      void stopActiveDictation();
      return;
    }
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setError("Browser dictation is unavailable here. You can type the spoken answer instead.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    let resolveFinished!: () => void;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const session: ActiveDictationSession = {
      recognition,
      consumedResultIndexes: new Set<number>(),
      requestedStop: false,
      finished,
      finish: () => undefined
    };
    let finishedOnce = false;
    session.finish = () => {
      if (finishedOnce) return;
      finishedOnce = true;
      if (activeDictation.current === session) activeDictation.current = null;
      if (mounted.current) setDictationState("idle");
      resolveFinished();
    };
    recognition.onresult = (event) => {
      const transcript = newFinalTranscript(event, session.consumedResultIndexes);
      if (transcript) {
        setAnswer((current) => {
          const next = `${current}${current ? " " : ""}${transcript}`;
          answerRef.current = next;
          scheduleDraftSave(next);
          return next;
        });
      }
    };
    recognition.onend = session.finish;
    recognition.onerror = () => {
      if (!session.requestedStop && mounted.current) {
        setError("Dictation stopped. Your existing draft is still saved.");
      }
      session.finish();
    };
    activeDictation.current = session;
    try {
      recognition.start();
      setDictationState("listening");
    } catch {
      session.finish();
      setError("Dictation could not start. You can type the spoken answer instead.");
    }
  }

  async function stopActiveDictation(): Promise<void> {
    const session = activeDictation.current;
    if (!session) return;
    session.requestedStop = true;
    if (mounted.current) setDictationState("stopping");
    try {
      session.recognition.stop();
    } catch {
      session.finish();
    }

    let timeoutId: number | null = null;
    await Promise.race([
      session.finished,
      new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(() => {
          try {
            session.recognition.abort();
          } catch {
            // The browser may have ended between stop and the fallback.
          }
          session.finish();
          resolve();
        }, 1_500);
      })
    ]);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }

  const complete = status === "COMPLETED";
  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <nav
        className="mb-5 flex flex-wrap items-center gap-2 text-sm text-cream/45"
        aria-label="Breadcrumb"
      >
        <Link
          href="/practice"
          onClick={(event) => void navigateAfterSave(event, "/practice")}
          className="transition hover:text-cream"
        >
          Practice
        </Link>
        <span>/</span>
        <Link
          href={question.sessionHref}
          onClick={(event) => void navigateAfterSave(event, question.sessionHref)}
          className="transition hover:text-cream"
        >
          {question.sessionTitle}
        </Link>
        <span>/</span>
        <span className="text-cream/75">Question {question.order}</span>
      </nav>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(21rem,0.8fr)]">
        <section className="workspace-accent-card-glow rounded-[1.6rem] border border-[color-mix(in_srgb,var(--workspace-accent)_22%,transparent)] bg-graphite-900/75 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 pb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-[color-mix(in_srgb,var(--workspace-accent)_10%,transparent)] px-2.5 py-1 font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
                {question.format}
              </span>
              <span className="capitalize text-cream/42">{question.difficulty}</span>
              <span className="inline-flex items-center gap-1 text-cream/42">
                <Clock3 size={13} /> {question.expectedMinutes} min
              </span>
            </div>
            <span className="text-xs text-cream/35">
              {question.order} of {question.totalInSession}
            </span>
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-cream/38">
            {question.chapterTitle}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.025em] text-cream">
            {question.title}
          </h1>
          <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-cream/78">
            {question.prompt}
          </p>
          <div className="mt-6 rounded-xl border border-white/7 bg-black/18 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cream/36">
              What this practices
            </p>
            <p className="mt-2 text-sm leading-6 text-cream/58">{question.objective}</p>
          </div>

          <div className="mt-7">
            {question.format === "mcq" ? (
              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-semibold text-cream/72">
                  Choose one answer
                </legend>
                {question.options.map((option, index) => {
                  const selected = selectedOption === index;
                  const correctAfterReview = review?.correctOptionIndex === index;
                  return (
                    <label
                      key={option}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${correctAfterReview ? "border-emerald-400/35 bg-emerald-400/[0.07]" : selected ? "border-[var(--workspace-accent)]/50 bg-[color-mix(in_srgb,var(--workspace-accent)_7%,transparent)]" : "border-white/8 bg-black/15 hover:border-white/15"}`}
                    >
                      <input
                        type="radio"
                        name="practice-option"
                        checked={selected}
                        onChange={() => {
                          setSelectedOption(index);
                          scheduleDraftSave(`option:${index}`);
                        }}
                        className="mt-1 accent-[var(--workspace-accent)]"
                      />
                      <span className="text-sm leading-6 text-cream/72">{option}</span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="practice-answer" className="text-sm font-semibold text-cream/72">
                    {answerLabel(question.format)}
                  </label>
                  {question.format === "spoken" ? (
                    <button
                      type="button"
                      onClick={toggleDictation}
                      disabled={dictationState === "stopping"}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-cream/60 transition hover:border-white/20 hover:text-cream"
                    >
                      {dictationState === "idle" ? <Mic size={14} /> : <MicOff size={14} />}
                      {dictationState === "listening"
                        ? "Stop dictation"
                        : dictationState === "stopping"
                          ? "Stopping dictation…"
                          : "Dictate"}
                    </button>
                  ) : null}
                </div>
                <textarea
                  id="practice-answer"
                  value={answer}
                  onChange={(event) => {
                    answerRef.current = event.target.value;
                    setAnswer(event.target.value);
                    scheduleDraftSave(event.target.value);
                  }}
                  rows={question.format === "diagram" ? 15 : 11}
                  placeholder={answerPlaceholder(question.format)}
                  className={`w-full resize-y rounded-xl border border-white/9 bg-black/25 px-4 py-3 text-sm leading-7 text-cream outline-none transition placeholder:text-cream/25 focus:border-[color-mix(in_srgb,var(--workspace-accent)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--workspace-accent)_12%,transparent)] ${question.format === "diagram" ? "font-mono" : ""}`}
                />
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className={saveState === "error" ? "text-red-300" : "text-cream/32"}>
                {saveState === "saving"
                  ? "Saving draft…"
                  : saveState === "dirty"
                    ? "Unsaved changes"
                    : saveState === "saved"
                      ? "Draft saved"
                      : saveState === "error"
                        ? "Draft save failed — retry by editing"
                        : "Saved across devices"}
              </span>
              <span className="text-cream/28">{answer.length.toLocaleString()} characters</span>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-100/80"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void attempt("submit")}
              disabled={Boolean(submitting)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--workspace-accent)] px-4 py-2.5 text-sm font-semibold text-graphite-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting === "submit" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : complete ? (
                <RotateCcw size={15} />
              ) : (
                <Send size={15} />
              )}
              {complete ? "Retry answer" : "Submit answer"}
            </button>
            <button
              type="button"
              onClick={() => void attempt("skip")}
              disabled={Boolean(submitting) || complete}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-cream/42 transition hover:bg-white/[0.04] hover:text-cream/70"
            >
              <SkipForward size={15} /> Skip for now
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[1.4rem] border border-white/8 bg-graphite-900/66 p-5">
            <div className="flex items-center gap-2">
              <Lightbulb size={17} className="text-amber-300" />
              <h2 className="font-display text-lg font-semibold text-cream">Progressive hints</h2>
            </div>
            <div className="mt-4 space-y-3">
              {question.hints.slice(0, revealedHints).map((hint, index) => (
                <div
                  key={`${hint}-${index}`}
                  className="rounded-xl border border-amber-300/12 bg-amber-300/[0.045] p-3 text-sm leading-6 text-cream/62"
                >
                  <span className="mr-2 font-semibold text-amber-200/75">{index + 1}.</span>
                  {hint}
                </div>
              ))}
            </div>
            {revealedHints < question.hints.length ? (
              <button
                type="button"
                onClick={() => void revealHint()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-300/15 px-3 py-2 text-xs font-semibold text-amber-100/65 transition hover:border-amber-300/30 hover:text-amber-100"
              >
                <Lightbulb size={14} /> Reveal hint {revealedHints + 1}
              </button>
            ) : (
              <p className="mt-4 text-xs text-cream/32">All hints revealed.</p>
            )}
          </section>

          <section className="rounded-[1.4rem] border border-white/8 bg-graphite-900/66 p-5">
            <button
              type="button"
              onClick={() => setNoteOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="inline-flex items-center gap-2 font-display text-lg font-semibold text-cream">
                <NotebookPen size={17} className="text-[var(--workspace-accent)]" /> Notes
              </span>
              <ChevronDown
                size={16}
                className={`text-cream/40 transition ${noteOpen ? "rotate-180" : ""}`}
              />
            </button>
            {noteOpen ? (
              <textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  scheduleNoteSave(event.target.value);
                }}
                rows={7}
                placeholder="Capture the mechanism, trade-off, or story you want to remember…"
                className="mt-4 w-full resize-y rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-sm leading-6 text-cream outline-none placeholder:text-cream/24 focus:border-[color-mix(in_srgb,var(--workspace-accent)_35%,transparent)]"
              />
            ) : null}
          </section>

          {review ? (
            <ReviewPanel review={review} />
          ) : (
            <section className="rounded-[1.4rem] border border-white/8 bg-graphite-900/66 p-5">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-[var(--workspace-accent)]" />
                <h2 className="font-display text-lg font-semibold text-cream">Review</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-cream/48">
                Submit your answer to unlock rubric feedback and the authored explanation.
              </p>
            </section>
          )}
        </aside>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/7 pt-5">
        {question.previousHref ? (
          <Link
            href={question.previousHref}
            onClick={(event) => void navigateAfterSave(event, question.previousHref!)}
            className="inline-flex items-center gap-2 text-sm text-cream/50 transition hover:text-cream"
          >
            <ArrowLeft size={15} /> Previous
          </Link>
        ) : (
          <Link
            href={question.sessionHref}
            onClick={(event) => void navigateAfterSave(event, question.sessionHref)}
            className="inline-flex items-center gap-2 text-sm text-cream/50 transition hover:text-cream"
          >
            <ArrowLeft size={15} /> Session
          </Link>
        )}
        {question.nextHref ? (
          <Link
            href={question.nextHref}
            onClick={(event) => void navigateAfterSave(event, question.nextHref!)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-cream/65 transition hover:border-white/20 hover:text-cream"
          >
            {navigatingTo === question.nextHref ? (
              <Loader2 size={15} className="animate-spin" />
            ) : null}
            Next question <ArrowRight size={15} />
          </Link>
        ) : (
          <Link
            href={question.sessionHref}
            onClick={(event) => void navigateAfterSave(event, question.sessionHref)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-cream/65 transition hover:border-white/20 hover:text-cream"
          >
            Review session <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </main>
  );
}

function ReviewPanel({ review }: { review: PrepPracticeReview }) {
  const strong = review.score !== null && review.score >= 0.72;
  const unverified = review.verificationStatus === "UNVERIFIED";
  return (
    <section
      aria-live="polite"
      className={`rounded-[1.4rem] border p-5 ${strong ? "border-emerald-400/20 bg-emerald-400/[0.055]" : "border-amber-300/18 bg-amber-300/[0.045]"}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.13em] ${strong ? "text-emerald-200/70" : "text-amber-100/65"}`}
      >
        Review ·{" "}
        {review.score === null
          ? unverified
            ? "Pending verification"
            : "Not scored"
          : `${Math.round(review.score * 100)}%`}
      </p>
      <h2 className="mt-2 font-display text-lg font-semibold text-cream">{review.summary}</h2>
      {review.strengths.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.11em] text-cream/35">
            What landed
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-cream/58">
            {review.strengths.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {review.missing.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.11em] text-cream/35">
            Strengthen next
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-cream/58">
            {review.missing.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {review.rubricRationale ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.11em] text-cream/35">
            Rubric rationale
          </p>
          <p className="mt-2 text-sm leading-6 text-cream/58">{review.rubricRationale}</p>
        </div>
      ) : null}
      <details className="mt-5 border-t border-white/8 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-cream/65">
          Authored explanation
        </summary>
        <p className="mt-3 text-sm leading-7 text-cream/58">{review.explanation}</p>
      </details>
    </section>
  );
}

function answerLabel(format: PrepPracticeQuestion["format"]): string {
  return format === "spoken"
    ? "Your spoken answer"
    : format === "diagram"
      ? "Your diagram outline"
      : "Your answer";
}
function answerPlaceholder(format: PrepPracticeQuestion["format"]): string {
  if (format === "spoken")
    return "Speak naturally using Dictate, or type the answer you would say aloud…";
  if (format === "diagram")
    return "Clients -> edge/cache -> services -> storage\n\nAdd ownership, data flow, failure paths, observability, and rollback…";
  return "Explain the mechanism, make the trade-offs explicit, and use a concrete example…";
}
function parseSavedOption(value: string): number | null {
  const match = /^option:(\d+)$/.exec(value);
  return match ? Number(match[1]) : null;
}
async function persistState(
  question: Pick<PrepPracticeQuestion, "sessionKey" | "id">,
  fields: PrepStatePatch,
  retryCount: number
): Promise<void> {
  const response = await fetch("/api/practice/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionKey: question.sessionKey,
      questionId: question.id,
      retryCount,
      ...fields
    }),
    // Allows the browser to finish the small state write after an SPA
    // unmount, tab close, or full-page navigation.
    keepalive: true
  });
  if (!response.ok) throw new Error(await responseMessage(response));
}
async function responseMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? "The request could not be completed.";
}

interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string } | undefined;
  isFinal?: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike | undefined };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface ActiveDictationSession {
  recognition: SpeechRecognitionLike;
  consumedResultIndexes: Set<number>;
  requestedStop: boolean;
  finished: Promise<void>;
  finish(): void;
}
export function newFinalTranscript(
  event: SpeechRecognitionEventLike,
  consumedResultIndexes: Set<number>
): string {
  const chunks: string[] = [];
  const start = Math.max(0, event.resultIndex ?? 0);
  for (let index = start; index < event.results.length; index += 1) {
    if (consumedResultIndexes.has(index)) continue;
    const result = event.results[index];
    if (!result || result.isFinal === false) continue;
    const transcript = result[0]?.transcript.trim();
    if (!transcript) continue;
    consumedResultIndexes.add(index);
    chunks.push(transcript);
  }
  return chunks.join(" ");
}
function speechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  const browser = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}
