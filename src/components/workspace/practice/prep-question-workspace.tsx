"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
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
import { PracticeCodeViewer } from "./practice-code-viewer";
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
  const [panel, setPanel] = useState<"description" | "hints" | "review" | "notes">("description");
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
        if (question.format === "diagnose" && currentAnswer.trim().length < 15) {
          setError("Say what the cause is and what you would change.");
          return;
        }
        if (question.format === "find-the-flaw" && currentAnswer.trim().length < 15) {
          setError("Describe what is wrong and why before submitting.");
          return;
        }
        if (question.format === "predict-run" && currentAnswer.trim().length === 0) {
          setError("Write what you think the code prints before submitting.");
          return;
        }
        if (
          question.format !== "mcq" &&
          question.format !== "predict-run" &&
          question.format !== "find-the-flaw" &&
          question.format !== "diagnose" &&
          currentAnswer.trim().length < 12
        ) {
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
      setPanel("review");
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
  const nextHref = question.nextHref ?? question.sessionHref;
  const nextLabel = question.nextHref ? "Next question" : "Review session";

  return (
    <main className="w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-2 xl:h-full">
        <header className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#141619] px-3 py-2.5 sm:px-4">
          <Link
            href={question.sessionHref}
            onClick={(event) => void navigateAfterSave(event, question.sessionHref)}
            aria-label={`Back to ${question.sessionTitle}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-cream/58 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-cream sm:text-[18px]">
                {question.title}
              </h1>
              <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10.5px] font-semibold text-cream/54 capitalize">
                {question.difficulty}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[10.5px] font-medium text-cream/52">
                <Clock3 size={11} aria-hidden="true" /> {question.expectedMinutes} min
              </span>
              <span className="hidden rounded-md bg-white/[0.06] px-2 py-1 text-[10.5px] font-medium text-cream/52 sm:inline">
                {question.chapterTitle}
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {complete ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--workspace-accent-soft)] px-3 text-[12px] font-semibold text-[var(--workspace-accent)]">
                <CheckCircle2 size={14} aria-hidden="true" /> Solved
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void attempt("skip")}
                disabled={Boolean(submitting)}
                aria-label="Skip for now"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.065] px-3 text-[12px] font-semibold text-cream/72 transition hover:bg-white/[0.1] hover:text-cream disabled:opacity-60"
              >
                {submitting === "skip" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <SkipForward size={14} />
                )}
                <span className="hidden sm:inline">Skip question</span>
                <span className="sm:hidden">Skip</span>
              </button>
            )}
            <Link
              href={nextHref}
              onClick={(event) => void navigateAfterSave(event, nextHref)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.065] px-3 text-[12px] font-semibold text-cream/72 transition hover:bg-white/[0.1] hover:text-cream"
            >
              {navigatingTo === nextHref ? <Loader2 size={14} className="animate-spin" /> : null}
              <span className="hidden sm:inline">{nextLabel}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(22rem,0.82fr)_minmax(34rem,1.18fr)]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#141619]">
            <div
              role="tablist"
              aria-label="Question reference"
              className="thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.07] px-2 pt-2"
            >
              {[
                ["description", "Description"],
                ["hints", "Hints"],
                ["review", "Review"],
                ["notes", "Notes"]
              ].map(([id, label]) => {
                const selected = panel === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPanel(id as typeof panel)}
                    className={`relative h-10 shrink-0 rounded-t-lg px-3 text-[13px] font-semibold transition-colors ${selected ? "text-cream" : "text-cream/42 hover:bg-white/[0.035] hover:text-cream/72"}`}
                  >
                    {label}
                    {id === "hints" && question.hints.length ? (
                      <span className="ml-1.5 text-[11px] tabular-nums text-cream/34">
                        {revealedHints}/{question.hints.length}
                      </span>
                    ) : null}
                    {selected ? (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--workspace-accent)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="thin-scroll min-h-[26rem] flex-1 overflow-y-auto px-5 py-5 sm:px-6 xl:min-h-0">
              {panel === "description" ? (
                <div className="space-y-7">
                  <section>
                    <p className="text-[13px] font-semibold text-cream/88">
                      Question {question.order} of {question.totalInSession}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-7 text-cream/72">
                      {question.prompt}
                    </p>
                  </section>
                  <section className="rounded-xl border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] p-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-cream">
                      <Sparkles
                        size={15}
                        aria-hidden="true"
                        className="text-[var(--workspace-accent)]"
                      />
                      What this practices
                    </div>
                    <p className="mt-3 text-[13.5px] leading-6 text-cream/72">
                      {question.objective}
                    </p>
                  </section>
                  {review ? (
                    <ReviewSummary review={review} />
                  ) : (
                    <section className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-cream">
                        <Sparkles
                          size={15}
                          aria-hidden="true"
                          className="text-[var(--workspace-accent)]"
                        />
                        Review
                      </div>
                      <p className="mt-3 text-[13.5px] leading-6 text-cream/62">
                        Submit your answer to unlock rubric feedback and the authored explanation.
                      </p>
                    </section>
                  )}
                </div>
              ) : null}

              {panel === "hints" ? (
                <div>
                  <div className="flex items-center gap-2.5">
                    <Lightbulb
                      size={16}
                      aria-hidden="true"
                      className="text-[var(--workspace-accent)]"
                    />
                    <div>
                      <h2 className="text-[14px] font-semibold text-cream">Progressive hints</h2>
                      <p className="mt-0.5 text-[12.5px] text-cream/42">
                        Reveal only what you need.
                      </p>
                    </div>
                  </div>
                  {question.hints.length ? (
                    <div className="mt-5 space-y-3">
                      {question.hints.slice(0, revealedHints).map((hint, index) => (
                        <div
                          key={`${hint}-${index}`}
                          className="fade-slide flex gap-3 rounded-xl bg-white/[0.035] p-4"
                        >
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--workspace-accent-soft)] text-[12px] font-semibold text-[var(--workspace-accent)]">
                            {index + 1}
                          </span>
                          <p className="text-[14px] leading-6 text-cream/72">{hint}</p>
                        </div>
                      ))}
                      {revealedHints < question.hints.length ? (
                        <button
                          type="button"
                          onClick={() => void revealHint()}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] text-[13px] font-semibold text-cream/72 transition hover:bg-white/[0.065] hover:text-cream"
                        >
                          <Lightbulb size={14} aria-hidden="true" />
                          {revealedHints === 0
                            ? "Show first hint"
                            : `Show next hint · ${revealedHints}/${question.hints.length}`}
                        </button>
                      ) : (
                        <p className="text-[13px] text-cream/42">All hints revealed.</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-5 text-[13px] text-cream/42">
                      No hints are available for this question.
                    </p>
                  )}
                </div>
              ) : null}

              {panel === "review" ? (
                review ? (
                  <ReviewPanel review={review} />
                ) : (
                  <div className="rounded-xl border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] p-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-cream">
                      <Sparkles
                        size={15}
                        aria-hidden="true"
                        className="text-[var(--workspace-accent)]"
                      />{" "}
                      Review
                    </div>
                    <p className="mt-3 text-[13.5px] leading-6 text-cream/62">
                      Submit your answer to unlock the rubric feedback and authored explanation.
                    </p>
                  </div>
                )
              ) : null}

              {panel === "notes" ? (
                <div>
                  <div className="flex items-center gap-2.5">
                    <NotebookPen
                      size={16}
                      aria-hidden="true"
                      className="text-[var(--workspace-accent)]"
                    />
                    <div>
                      <h2 className="text-[14px] font-semibold text-cream">Notes</h2>
                      <p className="mt-0.5 text-[12.5px] text-cream/42">
                        Saved automatically while you work.
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      scheduleNoteSave(event.target.value);
                    }}
                    rows={14}
                    placeholder="Capture the mechanism, trade-off, or story you want to remember…"
                    className="mt-5 w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3 text-[14px] leading-6 text-cream outline-none placeholder:text-cream/24 focus:border-[color-mix(in_srgb,var(--workspace-accent)_35%,transparent)]"
                  />
                  <p
                    className={`mt-2 text-[12px] ${saveState === "error" ? "text-red-300" : "text-cream/32"}`}
                  >
                    {saveState === "saving"
                      ? "Saving notes…"
                      : saveState === "dirty"
                        ? "Unsaved changes"
                        : saveState === "saved"
                          ? "Notes saved"
                          : saveState === "error"
                            ? "Notes save failed — retry by editing"
                            : "Saved across devices"}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#101214] xl:min-h-0">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <NotebookPen
                  size={16}
                  aria-hidden="true"
                  className="text-[var(--workspace-accent)]"
                />
                <div>
                  <h2 className="text-[14px] font-semibold text-cream">Your answer</h2>
                  <p className="text-[12px] text-cream/40 capitalize">{question.format} practice</p>
                </div>
              </div>
              {question.format === "spoken" ? (
                <button
                  type="button"
                  onClick={toggleDictation}
                  disabled={dictationState === "stopping"}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/[0.055] px-3 text-[12px] font-semibold text-cream/65 transition hover:bg-white/[0.09] hover:text-cream disabled:opacity-60"
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
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {question.format === "mcq" ? (
                <fieldset className="space-y-3">
                  <legend className="mb-3 text-[13px] font-semibold text-cream/72">
                    Choose one answer
                  </legend>
                  {question.options.map((option, index) => {
                    const selected = selectedOption === index;
                    const correctAfterReview = review?.correctOptionIndex === index;
                    return (
                      <label
                        key={option}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${correctAfterReview ? "border-emerald-400/35 bg-emerald-400/[0.07]" : selected ? "border-[var(--workspace-accent)]/50 bg-[var(--workspace-accent-soft)]" : "border-white/[0.08] bg-black/20 hover:border-white/[0.16]"}`}
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
                        <span className="text-[14px] leading-6 text-cream/72">{option}</span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : question.format === "diagnose" && question.artifact ? (
                <DiagnosePanel
                  artifact={question.artifact}
                  answer={answer}
                  diagnosis={review?.diagnosis ?? null}
                  onAnswerChange={(value) => {
                    answerRef.current = value;
                    setAnswer(value);
                    scheduleDraftSave(value);
                  }}
                />
              ) : question.format === "find-the-flaw" && question.snippet ? (
                <FindTheFlawPanel
                  snippet={question.snippet}
                  answer={answer}
                  flaw={review?.flaw ?? null}
                  onAnswerChange={(value) => {
                    answerRef.current = value;
                    setAnswer(value);
                    scheduleDraftSave(value);
                  }}
                />
              ) : question.format === "predict-run" && question.snippet ? (
                <PredictRunPanel
                  snippet={question.snippet}
                  prediction={answer}
                  expectedOutput={review?.expectedOutput ?? null}
                  onPredictionChange={(value) => {
                    answerRef.current = value;
                    setAnswer(value);
                    scheduleDraftSave(value);
                  }}
                />
              ) : (
                <div className="flex h-full min-h-[24rem] flex-col">
                  <label
                    htmlFor="practice-answer"
                    className="mb-3 text-[13px] font-semibold text-cream/72"
                  >
                    {answerLabel(question.format)}
                  </label>
                  <textarea
                    id="practice-answer"
                    value={answer}
                    onChange={(event) => {
                      answerRef.current = event.target.value;
                      setAnswer(event.target.value);
                      scheduleDraftSave(event.target.value);
                    }}
                    placeholder={answerPlaceholder(question.format)}
                    className={`min-h-[21rem] flex-1 resize-none rounded-xl border border-white/[0.08] bg-[#0d0f10] px-4 py-3 font-mono text-[13px] leading-6 text-cream outline-none placeholder:font-sans placeholder:text-cream/25 focus:border-[color-mix(in_srgb,var(--workspace-accent)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--workspace-accent)_12%,transparent)] ${question.format === "diagram" ? "" : "font-sans text-[14px] leading-7"}`}
                  />
                </div>
              )}
              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-[13px] text-red-100/80"
                >
                  {error}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3">
              <div className="text-[12px] text-cream/32">
                {saveState === "saving"
                  ? "Saving draft…"
                  : saveState === "dirty"
                    ? "Unsaved changes"
                    : saveState === "saved"
                      ? "Draft saved"
                      : saveState === "error"
                        ? "Draft save failed — retry by editing"
                        : "Saved across devices"}
                {question.format !== "mcq" ? (
                  <span className="ml-2 text-cream/24">
                    · {answer.length.toLocaleString()} characters
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void attempt("submit")}
                disabled={Boolean(submitting)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-cream px-4 text-[12.5px] font-semibold text-[#171a16] transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
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
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function ReviewSummary({ review }: { review: PrepPracticeReview }) {
  const unverified = review.verificationStatus === "UNVERIFIED";
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-cream/58">
        Review ·{" "}
        {review.score === null
          ? unverified
            ? "Pending verification"
            : "Not scored"
          : `${Math.round(review.score * 100)}%`}
      </p>
      <p className="mt-2 text-[13.5px] leading-6 text-cream/72">{review.summary}</p>
    </section>
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


/**
 * Format A. The code is read-only and the prediction is written blind — the
 * expected output is withheld by the server until an attempt is submitted, so
 * there is nothing in the page to peek at.
 *
 * After submission the two are shown side by side. The gap between what the
 * candidate expected and what the runtime actually does is the whole lesson,
 * so it is given more room than the verdict line above it.
 */
function PredictRunPanel({
  snippet,
  prediction,
  expectedOutput,
  onPredictionChange
}: {
  snippet: { code: string; language: string };
  prediction: string;
  expectedOutput: string | null;
  onPredictionChange: (value: string) => void;
}) {
  const submitted = expectedOutput !== null;

  return (
    <div className="flex h-full min-h-[24rem] flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-cream/72">What does this print?</span>
          <span className="rounded-full border border-white/[0.1] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/40">
            {snippet.language}
          </span>
        </div>
        <PracticeCodeViewer code={snippet.code} language={snippet.language} />
      </div>

      {submitted ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-cream/40">
              You predicted
            </p>
            <pre className="thin-scroll min-h-[7rem] overflow-auto rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 font-mono text-[13px] leading-6 text-cream/70">
              <code>{prediction.trim() || "—"}</code>
            </pre>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--workspace-accent)]">
              It actually prints
            </p>
            <pre className="thin-scroll min-h-[7rem] overflow-auto rounded-xl border border-[color-mix(in_srgb,var(--workspace-accent)_28%,transparent)] bg-[var(--workspace-accent-soft)] px-4 py-3 font-mono text-[13px] leading-6 text-cream">
              <code>{expectedOutput.trim() || "(no output)"}</code>
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <label
            htmlFor="practice-answer"
            className="mb-2 text-[13px] font-semibold text-cream/72"
          >
            Your prediction — one line per output
          </label>
          <textarea
            id="practice-answer"
            value={prediction}
            onChange={(event) => onPredictionChange(event.target.value)}
            placeholder={"1\n5\n3"}
            spellCheck={false}
            className="min-h-[9rem] flex-1 resize-none rounded-xl border border-white/[0.08] bg-[#0d0f10] px-4 py-3 font-mono text-[13px] leading-6 text-cream outline-none placeholder:text-cream/20 focus:border-[color-mix(in_srgb,var(--workspace-accent)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--workspace-accent)_12%,transparent)]"
          />
          <p className="mt-2 text-[11.5px] text-cream/32">
            Order matters. Spacing and blank lines do not.
          </p>
        </div>
      )}
    </div>
  );
}


/**
 * Format C. Line numbers are load-bearing here — the reveal points at a line,
 * and a candidate describing "the loop on line 7" needs the same numbering the
 * author used. They are rendered as a separate gutter column rather than baked
 * into the text so a copy of the snippet stays runnable.
 */
function FindTheFlawPanel({
  snippet,
  answer,
  flaw,
  onAnswerChange
}: {
  snippet: { code: string; language: string };
  answer: string;
  flaw: { summary: string; line: number; consequence: string } | null;
  onAnswerChange: (value: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[24rem] flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-cream/72">
            This code runs. Something is still wrong with it.
          </span>
          <span className="rounded-full border border-white/[0.1] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/40">
            {snippet.language}
          </span>
        </div>

        <PracticeCodeViewer
          code={snippet.code}
          language={snippet.language}
          highlightLine={flaw?.line ?? null}
        />
      </div>

      {flaw ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--workspace-accent)_28%,transparent)] bg-[var(--workspace-accent-soft)] px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
            The planted defect · line {flaw.line}
          </p>
          <p className="mt-2 text-[13.5px] leading-6 text-cream/85">{flaw.summary}</p>
          <p className="mt-2 text-[12.5px] leading-6 text-cream/55">{flaw.consequence}</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <label htmlFor="practice-answer" className="mb-2 text-[13px] font-semibold text-cream/72">
            What is wrong, and what does it cost in production?
          </label>
          <textarea
            id="practice-answer"
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="Name the defect and say what breaks because of it."
            className="min-h-[9rem] flex-1 resize-none rounded-xl border border-white/[0.08] bg-[#0d0f10] px-4 py-3 text-[14px] leading-7 text-cream outline-none placeholder:text-cream/25 focus:border-[color-mix(in_srgb,var(--workspace-accent)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--workspace-accent)_12%,transparent)]"
          />
          <p className="mt-2 text-[11.5px] text-cream/32">
            Describing the mechanism counts. The exact line number does not.
          </p>
        </div>
      )}
    </div>
  );
}


const ARTIFACT_LABELS: Record<string, string> = {
  "query-plan": "Query plan",
  waterfall: "Request waterfall",
  log: "Log excerpt",
  metrics: "Metrics"
};

/**
 * Format D. The evidence is the question, so it gets the space — rendered
 * verbatim in a scrollable monospace block, with the reported symptom above it
 * framed as something a person said rather than as instructions.
 *
 * The reveal lists every accepted fix, not just one. A candidate who named a
 * different sound remedy should see that theirs was legitimate.
 */
function DiagnosePanel({
  artifact,
  answer,
  diagnosis,
  onAnswerChange
}: {
  artifact: { body: string; kind: string; symptom: string };
  answer: string;
  diagnosis: { rootCause: string; fixes: string[] } | null;
  onAnswerChange: (value: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[24rem] flex-col gap-4">
      <div className="rounded-xl border border-white/[0.09] bg-black/25 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/38">
          Reported
        </p>
        <p className="mt-1.5 text-[13.5px] leading-6 text-cream/80">{artifact.symptom}</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-cream/72">The evidence</span>
          <span className="rounded-full border border-white/[0.1] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-cream/40">
            {ARTIFACT_LABELS[artifact.kind] ?? artifact.kind}
          </span>
        </div>
        {/* Query plans, waterfalls and log excerpts are not a language Monaco
            knows, so this stays plain — highlighting them as code would invent
            syntax that is not there. */}
        <pre className="thin-scroll max-h-[19rem] overflow-auto rounded-xl border border-white/[0.08] bg-[#0d0f10] px-4 py-3 font-mono text-[12.5px] leading-6 text-cream/85">
          <code>{artifact.body}</code>
        </pre>
      </div>

      {diagnosis ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--workspace-accent)_28%,transparent)] bg-[var(--workspace-accent-soft)] px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
            Root cause
          </p>
          <p className="mt-2 text-[13.5px] leading-6 text-cream/85">{diagnosis.rootCause}</p>
          <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/38">
            Fixes that count
          </p>
          <ul className="mt-1.5 space-y-1">
            {diagnosis.fixes.map((fix) => (
              <li key={fix} className="text-[12.5px] leading-6 text-cream/60">
                · {fix}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <label htmlFor="practice-answer" className="mb-2 text-[13px] font-semibold text-cream/72">
            What is actually wrong, and what would you change?
          </label>
          <textarea
            id="practice-answer"
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="Name the cause the evidence points to, then the fix."
            className="min-h-[9rem] flex-1 resize-none rounded-xl border border-white/[0.08] bg-[#0d0f10] px-4 py-3 text-[14px] leading-7 text-cream outline-none placeholder:text-cream/25 focus:border-[color-mix(in_srgb,var(--workspace-accent)_45%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--workspace-accent)_12%,transparent)]"
          />
          <p className="mt-2 text-[11.5px] text-cream/32">
            Restating the symptom is not a diagnosis.
          </p>
        </div>
      )}
    </div>
  );
}
