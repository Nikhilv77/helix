"use client";

import { markSummaryDataChanged } from "@/lib/workspace/summary-cache-invalidation";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { CircleAlert, FileText, Flame, Gauge, Wrench, type LucideIcon } from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { ReportMayaAvatar } from "@/features/reports/ui/report-maya-avatar";
import {
  RESUME_ROAST_COMPANY_ENVIRONMENT_LABELS,
  RESUME_ROAST_COMPANY_ENVIRONMENT_OPTIONS,
  RESUME_ROAST_LEVEL_LABELS,
  RESUME_ROAST_LEVEL_OPTIONS,
  RESUME_ROAST_ROLE_LABELS,
  RESUME_ROAST_ROLE_OPTIONS,
  type ResumeRoastResult,
  type ResumeRoastStreamEvent,
  type ResumeRoastTarget
} from "@/features/resume-roast/contracts/resume-roast";
import {
  createResumeRoastEventParser,
  resumeRoastResultEvents,
  ResumeRoastStreamParseError
} from "@/features/resume-roast/application/stream";
import { notifyWorkspaceNotificationsChanged } from "@/features/notifications/ui/notification-ui-events";
import type { CandidateResume } from "@/lib/shared/types";
import { useMayaVoice } from "@/infrastructure/realtime/use-maya-voice";
import { ResumeDocumentPreview } from "@/features/interviews/ui/voice/components/resume-document-preview";
import {
  INTERVIEW_PANEL_RULE,
  INTERVIEW_PANEL_SHELL
} from "@/features/interviews/ui/voice/components/panel-surface";
import { ResumeRoastLoading } from "./resume-roast-skeleton";

interface RoastRecord {
  id: string;
  target: ResumeRoastTarget;
  result: ResumeRoastResult;
  resumeVersionId?: string;
  resumeFileName?: string | null;
  createdAt?: number;
}

interface RoastState {
  hasResume: boolean;
  target: ResumeRoastTarget | null;
  suggestedTarget: Partial<ResumeRoastTarget> | null;
  previousRoast: RoastRecord | null;
  history: RoastRecord[];
}

type ScreenState = "loading" | "selecting" | "streaming" | "ready" | "failed";

const INTRO = "Okay, I’ve got your resume. Three quick questions, then we’ll get into it.";
const ROLE_QUESTION = "Which position are you targeting?";
const OPENING_VOICE_LINE = `${INTRO} ${ROLE_QUESTION}`;
const COMPANY_QUESTION = "What kind of company are we trying to impress?";
const LEVEL_QUESTION = "What level are you applying for?";
const READING_LINE =
  "Perfect. I’ll start analysing it now. Give me a second—I’m checking what the confidence forgot to prove.";
const ROAST_CLOSING =
  "Now check—I’ve laid out every issue with your resume and exactly how to fix it.";
const PROVIDER_FAILURE_MESSAGE = "James is temporarily unavailable. Try again.";
const TIMEOUT_MESSAGE = "James took too long. Try again.";
const INVALID_RESPONSE_MESSAGE = "James couldn’t safely prepare that feedback. Try again.";
const PROVIDER_RATE_LIMIT_MESSAGE = "James is busy right now. Wait a minute and try again.";
const RATE_LIMIT_MESSAGE = "You’ve requested several roasts. Try again in a few minutes.";
const COMPLETION_AUTO_SCROLL_DELAY_MS = 5_000;
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]);

export function resumeRoastProgressMessage(elapsedSeconds: number): string {
  if (elapsedSeconds < 15) return "James is reading your resume…";
  if (elapsedSeconds < 30) return "Still working—good feedback takes a moment.";
  return "Almost there…";
}

function streamFailureMessage(code: Extract<ResumeRoastStreamEvent, { type: "error" }>["code"]) {
  if (code === "timeout") return TIMEOUT_MESSAGE;
  if (code === "invalid-response") return INVALID_RESPONSE_MESSAGE;
  if (code === "rate-limited") return PROVIDER_RATE_LIMIT_MESSAGE;
  return PROVIDER_FAILURE_MESSAGE;
}

function apiFailureMessage(code: string | undefined): string {
  return code === "RESUME_ROAST_RATE_LIMITED" ? RATE_LIMIT_MESSAGE : PROVIDER_FAILURE_MESSAGE;
}

class ResumeRoastClientError extends Error {}

export function ResumeRoastWorkspace({
  resume,
  initialState = null
}: {
  resume: CandidateResume | null;
  initialState?: RoastState | null;
}) {
  const mounted = useRef(true);
  const requestId = useRef(0);
  const stateController = useRef<AbortController | null>(null);
  const roastController = useRef<AbortController | null>(null);
  const spokenLine = useRef("");
  const spokenRoast = useRef("");
  const spokenRoastAttempts = useRef({ roastId: "", count: 0 });
  const hasInitialState = useRef(initialState !== null);
  const [state, setState] = useState<RoastState | null>(initialState);
  const [screen, setScreen] = useState<ScreenState>(() =>
    initialState
      ? initialState.previousRoast || !initialState.hasResume
        ? "ready"
        : "selecting"
      : "loading"
  );
  const [target, setTarget] = useState<Partial<ResumeRoastTarget>>(
    initialState?.previousRoast?.target ?? {}
  );
  const [events, setEvents] = useState<ResumeRoastStreamEvent[]>(() =>
    initialState?.previousRoast
      ? resumeRoastResultEvents({
          roastId: initialState.previousRoast.id,
          replayed: true,
          target: initialState.previousRoast.target,
          result: initialState.previousRoast.result
        })
      : []
  );
  const [showingPrevious, setShowingPrevious] = useState(
    Boolean(initialState?.previousRoast)
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const [roastVoiceRetry, setRoastVoiceRetry] = useState(0);
  const {
    state: voiceState,
    speak,
    stop,
    preload,
    awaitingGesture,
    setAwaitingGesture
  } = useMayaVoice();

  const complete = events.some((event) => event.type === "done");
  const roastSessionId =
    events.find((event) => event.type === "session")?.roastId ?? "pending-roast";
  const roastSpeech = useMemo(() => {
    const summary = roastSpokenSummary(events);
    return summary ? `${summary} ${ROAST_CLOSING}` : "";
  }, [events]);
  const voiceLine = useMemo(() => {
    if (screen === "streaming") return READING_LINE;
    if (!target.role) return OPENING_VOICE_LINE;
    if (!target.companyEnvironment) return COMPANY_QUESTION;
    if (!target.level) return LEVEL_QUESTION;
    return "";
  }, [screen, target]);

  const playVoice = useCallback(
    (line: string, force = false) => {
      if (!line.trim() || (!force && spokenLine.current === line)) return;
      spokenLine.current = line;
      void speak(line, "james").then((result) => {
        if (result === "blocked") spokenLine.current = "";
      });
    },
    [speak]
  );

  useEffect(() => {
    if (!resume) return;
    // Warm the opening alongside the state request so James can begin as soon
    // as the target-selection room appears.
    preload(OPENING_VOICE_LINE, "james");
  }, [preload, resume]);

  useEffect(() => {
    if (screen === "loading" || complete) return;
    // Warm only the next turn. This keeps the conversation responsive without
    // spending TTS work on every possible line when the page first opens.
    if (!target.role) preload(COMPANY_QUESTION, "james");
    else if (!target.companyEnvironment) preload(LEVEL_QUESTION, "james");
    else if (!target.level) preload(READING_LINE, "james");
  }, [complete, preload, screen, target.companyEnvironment, target.level, target.role]);

  useEffect(() => {
    if (complete || screen === "loading" || awaitingGesture) return;
    const timer = window.setTimeout(() => playVoice(voiceLine), target.role ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [awaitingGesture, complete, playVoice, screen, target.role, voiceLine]);

  useEffect(() => {
    if (screen !== "streaming") return;
    const startedAt = Date.now();
    setAnalysisElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setAnalysisElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (
      !complete ||
      awaitingGesture ||
      voiceState === "loading" ||
      voiceState === "speaking" ||
      !roastSpeech
    )
      return;
    if (spokenRoast.current === roastSessionId) return;
    if (spokenRoastAttempts.current.roastId !== roastSessionId) {
      spokenRoastAttempts.current = { roastId: roastSessionId, count: 0 };
    }
    spokenRoast.current = roastSessionId;
    spokenRoastAttempts.current.count += 1;
    void speak(roastSpeech, "james", { delivery: "fast" }).then((result) => {
      if (result === "blocked") {
        spokenRoast.current = "";
        return;
      }
      if (
        result === "unavailable" &&
        mounted.current &&
        spokenRoastAttempts.current.roastId === roastSessionId &&
        spokenRoastAttempts.current.count < 2
      ) {
        spokenRoast.current = "";
        window.setTimeout(() => {
          if (mounted.current) setRoastVoiceRetry((current) => current + 1);
        }, 800);
      }
    });
  }, [awaitingGesture, complete, roastSessionId, roastSpeech, roastVoiceRetry, speak, voiceState]);

  const startJamesVoice = useCallback(() => {
    setAwaitingGesture(false);
    if (complete) {
      spokenRoast.current = roastSessionId;
      if (roastSpeech) {
        void speak(roastSpeech, "james", { delivery: "fast" }).then((result) => {
          if (result === "blocked") spokenRoast.current = "";
        });
      }
      return;
    }
    playVoice(voiceLine, true);
  }, [complete, playVoice, roastSessionId, roastSpeech, setAwaitingGesture, speak, voiceLine]);

  const cancelRoast = useCallback(() => {
    roastController.current?.abort();
    roastController.current = null;
  }, []);

  const loadState = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch("/api/resume-roast", { signal, cache: "no-store" });
      const payload = (await response.json()) as { data?: RoastState };
      if (!response.ok || !payload.data) throw new Error("state");
      if (!mounted.current || signal.aborted) return;

      const next = payload.data;
      setState(next);
      spokenRoast.current = "";
      if (next.previousRoast) {
        setTarget(next.previousRoast.target);
        setEvents(
          resumeRoastResultEvents({
            roastId: next.previousRoast.id,
            replayed: true,
            target: next.previousRoast.target,
            result: next.previousRoast.result
          })
        );
        setShowingPrevious(true);
        setScreen("ready");
      } else {
        setTarget({});
        setEvents([]);
        setShowingPrevious(false);
        setScreen(next.hasResume ? "selecting" : "ready");
      }
    } catch (error) {
      if (isAbort(error)) return;
      if (mounted.current) {
        setFailure("I lost the resume. Try that again.");
        setScreen("failed");
      }
    }
  }, []);

  const requestState = useCallback(() => {
    stateController.current?.abort();
    const controller = new AbortController();
    stateController.current = controller;
    void loadState(controller.signal).finally(() => {
      if (stateController.current === controller) stateController.current = null;
    });
  }, [loadState]);

  useEffect(() => {
    mounted.current = true;
    if (!hasInitialState.current) requestState();
    return () => {
      mounted.current = false;
      stateController.current?.abort();
      cancelRoast();
      stop();
    };
  }, [cancelRoast, requestState, stop]);

  const startRoast = async (selected: ResumeRoastTarget) => {
    cancelRoast();
    stop();
    spokenLine.current = "";
    spokenRoast.current = "";
    const controller = new AbortController();
    roastController.current = controller;
    const id = ++requestId.current;
    setFailure(null);
    setEvents([]);
    setShowingPrevious(false);
    setAnalysisElapsedSeconds(0);
    setScreen("streaming");

    try {
      const response = await fetch("/api/resume-roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: selected }),
        signal: controller.signal,
        cache: "no-store"
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        throw new ResumeRoastClientError(apiFailureMessage(payload?.error?.code));
      }
      if (!response.body) throw new ResumeRoastClientError(PROVIDER_FAILURE_MESSAGE);

      const parser = createResumeRoastEventParser();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finished = false;

      const accept = (event: ResumeRoastStreamEvent) => {
        if (!mounted.current || requestId.current !== id || controller.signal.aborted) return false;
        if (event.type === "error") {
          setFailure(streamFailureMessage(event.code));
          setScreen("failed");
          return false;
        }
        setEvents((current) => [...current, event]);
        if (event.type === "done" && !finished) {
          finished = true;
          markSummaryDataChanged();
          notifyWorkspaceNotificationsChanged();
        }
        return true;
      };

      while (!controller.signal.aborted) {
        const chunk = await reader.read();
        if (chunk.done) break;
        for (const event of parser.push(decoder.decode(chunk.value, { stream: true }))) {
          if (!accept(event)) return;
        }
      }
      const trailing = decoder.decode();
      if (trailing) {
        for (const event of parser.push(trailing)) if (!accept(event)) return;
      }
      parser.finish();
      if (!mounted.current || requestId.current !== id || controller.signal.aborted) return;
      if (!finished) throw new ResumeRoastStreamParseError("Resume Roast stream ended early.");

      setState((current) => (current ? { ...current, target: selected } : current));
      setScreen("ready");
    } catch (error) {
      if (isAbort(error) || controller.signal.aborted || requestId.current !== id) return;
      if (mounted.current) {
        setFailure(
          error instanceof ResumeRoastClientError ? error.message : PROVIDER_FAILURE_MESSAGE
        );
        setScreen("failed");
      }
    } finally {
      if (roastController.current === controller) roastController.current = null;
    }
  };

  const chooseRole = (role: ResumeRoastTarget["role"]) => {
    stop();
    spokenLine.current = "";
    setTarget({ role });
  };

  const chooseCompany = (companyEnvironment: ResumeRoastTarget["companyEnvironment"]) => {
    stop();
    spokenLine.current = "";
    setTarget((current) => ({ ...current, companyEnvironment }));
  };

  const chooseLevel = (level: ResumeRoastTarget["level"]) => {
    const selected = completeTarget({ ...target, level });
    if (!selected) return;
    setTarget(selected);
    void startRoast(selected);
  };

  const showHistoricalRoast = (roast: RoastRecord) => {
    cancelRoast();
    stop();
    setTarget(roast.target);
    setEvents(
      resumeRoastResultEvents({
        roastId: roast.id,
        replayed: true,
        target: roast.target,
        result: roast.result
      })
    );
    setFailure(null);
    setShowingPrevious(true);
    setScreen("ready");
  };

  if (screen === "loading") return <ResumeRoastLoading />;
  if (!state && screen === "failed")
    return <LoadFailure message={failure} onRetry={requestState} />;
  if (!state?.hasResume || !resume) return <MissingResume />;

  return (
    <main className="resume-roast-page interview-workspace-page workspace-black h-[calc(100dvh-4.25rem)] w-full overflow-hidden bg-black px-3 py-3 text-cream sm:px-5">
      <DocumentTitle title="Resume Roast" />
      <div className="thin-scroll mx-auto flex h-full w-full max-w-[96rem] min-h-0 flex-col gap-3 overflow-y-auto pb-3 xl:grid xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)_19rem] xl:overflow-hidden xl:pb-0">
        <ResumeDocumentPreview resume={resume} />
        <JamesChat
          target={target}
          events={events}
          showingPrevious={showingPrevious}
          loading={screen === "streaming"}
          roastComplete={complete}
          failure={failure}
          analysisElapsedSeconds={analysisElapsedSeconds}
          voiceNeedsGesture={awaitingGesture}
          onStartVoice={startJamesVoice}
          onChooseRole={chooseRole}
          onChooseCompany={chooseCompany}
          onChooseLevel={chooseLevel}
          onChangeTarget={() => {
            cancelRoast();
            stop();
            spokenLine.current = "";
            spokenRoast.current = "";
            setFailure(null);
            setEvents([]);
            setShowingPrevious(false);
            setTarget({});
            setScreen("selecting");
          }}
          onRetry={() => {
            const selected = completeTarget(target);
            if (selected) void startRoast(selected);
          }}
          history={state.history ?? []}
          onShowHistory={showHistoricalRoast}
        />
        <JamesAside
          target={target}
          events={events}
          loading={screen === "streaming"}
          failure={failure}
          speaking={voiceState === "speaking" || voiceState === "loading"}
          analysisElapsedSeconds={analysisElapsedSeconds}
        />
      </div>
    </main>
  );
}

function JamesChat({
  target,
  events,
  showingPrevious,
  loading,
  roastComplete,
  failure,
  analysisElapsedSeconds,
  voiceNeedsGesture,
  onStartVoice,
  onChooseRole,
  onChooseCompany,
  onChooseLevel,
  onChangeTarget,
  onRetry,
  history,
  onShowHistory
}: {
  target: Partial<ResumeRoastTarget>;
  events: ResumeRoastStreamEvent[];
  showingPrevious: boolean;
  loading: boolean;
  roastComplete: boolean;
  failure: string | null;
  analysisElapsedSeconds: number;
  voiceNeedsGesture: boolean;
  onStartVoice: () => void;
  onChooseRole: (role: ResumeRoastTarget["role"]) => void;
  onChooseCompany: (company: ResumeRoastTarget["companyEnvironment"]) => void;
  onChooseLevel: (level: ResumeRoastTarget["level"]) => void;
  onChangeTarget: () => void;
  onRetry: () => void;
  history: RoastRecord[];
  onShowHistory: (roast: RoastRecord) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const completionScrollTimer = useRef<number | null>(null);
  const completionScrollCancelled = useRef(false);

  const scrollToLatest = useCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTo?.({ top: viewport.scrollHeight, behavior: "smooth" });
  }, []);

  const cancelCompletionAutoScroll = useCallback(() => {
    if (!roastComplete || showingPrevious) return;
    completionScrollCancelled.current = true;
    if (completionScrollTimer.current !== null) {
      window.clearTimeout(completionScrollTimer.current);
      completionScrollTimer.current = null;
    }
  }, [roastComplete, showingPrevious]);

  const cancelCompletionAutoScrollForKey = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (SCROLL_KEYS.has(event.key)) cancelCompletionAutoScroll();
    },
    [cancelCompletionAutoScroll]
  );

  useEffect(() => {
    // Keep completed feedback positioned at its beginning so the reader can
    // move through it in order. Question and failure states still follow the
    // newest conversational item.
    if (roastComplete) return;
    scrollToLatest();
  }, [
    failure,
    loading,
    roastComplete,
    scrollToLatest,
    target.companyEnvironment,
    target.level,
    target.role
  ]);

  useEffect(() => {
    if (!roastComplete || showingPrevious) return;

    completionScrollCancelled.current = false;
    const timer = window.setTimeout(() => {
      if (completionScrollTimer.current === timer) completionScrollTimer.current = null;
      if (!completionScrollCancelled.current) scrollToLatest();
    }, COMPLETION_AUTO_SCROLL_DELAY_MS);
    completionScrollTimer.current = timer;

    return () => {
      window.clearTimeout(timer);
      if (completionScrollTimer.current === timer) completionScrollTimer.current = null;
    };
  }, [roastComplete, scrollToLatest, showingPrevious]);

  return (
    <section
      className={`${INTERVIEW_PANEL_SHELL} resume-roast-chat-stage flex min-h-[32rem] min-w-0 flex-col overflow-hidden xl:min-h-0`}
    >
      <header
        className={`flex shrink-0 items-center justify-between gap-4 border-b ${INTERVIEW_PANEL_RULE} px-5 py-3.5`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--workspace-accent)]">
            Resume Roast
          </p>
          <h1 className="mt-1 text-base font-semibold text-cream">
            {roastComplete ? "Your review" : "Set the target"}
          </h1>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-cream/48">
          {loading ? "Analysing" : roastComplete ? "Complete" : "With James"}
        </span>
      </header>
      <div
        ref={scrollRef}
        data-testid="resume-roast-chat-scroll"
        aria-live="polite"
        onWheel={cancelCompletionAutoScroll}
        onTouchMove={cancelCompletionAutoScroll}
        onPointerDown={cancelCompletionAutoScroll}
        onKeyDown={cancelCompletionAutoScrollForKey}
        className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-7 sm:px-8 sm:py-9"
      >
        <div className="mx-auto max-w-2xl space-y-8 pb-10">
          {voiceNeedsGesture ? (
            <button
              type="button"
              onClick={onStartVoice}
              className="w-full rounded-2xl border border-[var(--workspace-accent-border)] bg-[var(--workspace-accent-soft)] px-4 py-3 text-left text-sm font-semibold text-cream transition hover:bg-white/[0.08]"
            >
              {roastComplete ? "Hear James’s review" : "Start with James"}
              <span className="mt-1 block text-xs font-normal text-cream/52">
                Your browser needs one tap before it can play his voice.
              </span>
            </button>
          ) : null}

          {!roastComplete ? <JamesLine text={INTRO} /> : null}

          {!showingPrevious && !roastComplete ? (
            <Question
              text={ROLE_QUESTION}
              selected={target.role ? RESUME_ROAST_ROLE_LABELS[target.role] : null}
              active={!target.role}
              options={RESUME_ROAST_ROLE_OPTIONS}
              onChoose={onChooseRole}
            />
          ) : null}

          {target.role && !showingPrevious && !roastComplete ? (
            <Question
              text={COMPANY_QUESTION}
              selected={
                target.companyEnvironment
                  ? RESUME_ROAST_COMPANY_ENVIRONMENT_LABELS[target.companyEnvironment]
                  : null
              }
              active={!target.companyEnvironment}
              options={RESUME_ROAST_COMPANY_ENVIRONMENT_OPTIONS}
              onChoose={onChooseCompany}
            />
          ) : null}

          {target.companyEnvironment && !showingPrevious && !roastComplete ? (
            <Question
              text={LEVEL_QUESTION}
              selected={target.level ? RESUME_ROAST_LEVEL_LABELS[target.level] : null}
              active={!target.level}
              options={RESUME_ROAST_LEVEL_OPTIONS}
              onChoose={onChooseLevel}
            />
          ) : null}

          {target.level && loading && !roastComplete ? (
            <div>
              <JamesLine text={resumeRoastProgressMessage(analysisElapsedSeconds)} />
              <p
                aria-hidden="true"
                className="mt-2 pl-11 text-xs font-medium tabular-nums text-cream/48"
              >
                Analysing · {analysisElapsedSeconds}s
              </p>
            </div>
          ) : null}

          {roastComplete ? <RoastCards events={events} target={target} /> : null}

          {completeTarget(target) && roastComplete && !loading ? (
            <button
              type="button"
              onClick={onChangeTarget}
              className="rounded-full border border-white/[0.12] bg-white/[0.035] px-3.5 py-2 text-xs font-semibold text-cream/76 transition hover:border-[var(--workspace-accent-border)] hover:bg-[var(--workspace-accent-soft)] hover:text-cream"
            >
              {showingPrevious ? "Start a fresh analysis" : "Analyse another target"}
            </button>
          ) : null}

          {history.length ? (
            <details className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-cream/68">
                Resume Roast history ({history.length})
              </summary>
              <div className="mt-3.5 grid gap-2.5">
                {history.map((roast) => (
                  <button
                    key={roast.id}
                    type="button"
                    onClick={() => onShowHistory(roast)}
                    className="rounded-xl bg-white/[0.035] px-3.5 py-2.5 text-left text-sm text-cream/68 transition hover:bg-white/[0.07] hover:text-cream"
                  >
                    <span className="block font-semibold leading-5">
                      {roast.resumeFileName || "Resume version"}
                    </span>
                    <span className="mt-1 block text-xs leading-4 text-cream/46">
                      {roast.createdAt
                        ? new Date(roast.createdAt).toLocaleDateString()
                        : "Saved analysis"}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          ) : null}

          {failure ? (
            <div>
              <JamesLine text={failure} icon={CircleAlert} label="Analysis failed" />
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-xl bg-cream px-4 py-2.5 text-sm font-semibold text-black"
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

interface RoastTranscriptEntry {
  id: string;
  speaker: "James" | "You";
  text: string;
}

function JamesAside({
  target,
  events,
  loading,
  failure,
  speaking,
  analysisElapsedSeconds
}: {
  target: Partial<ResumeRoastTarget>;
  events: ResumeRoastStreamEvent[];
  loading: boolean;
  failure: string | null;
  speaking: boolean;
  analysisElapsedSeconds: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcript = roastTranscriptEntries({
    target,
    events,
    loading,
    failure,
    analysisElapsedSeconds
  });
  const latestText = transcript.at(-1)?.text;

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [latestText]);

  return (
    <aside
      className={`${INTERVIEW_PANEL_SHELL} flex min-h-[28rem] shrink-0 flex-col overflow-hidden xl:min-h-0 xl:shrink`}
    >
      <div
        className={`interview-teacher-stage relative h-40 shrink-0 overflow-hidden border-b ${INTERVIEW_PANEL_RULE} bg-black/20`}
      >
        <div className="absolute inset-x-[-16%] top-0 flex justify-center">
          <ReportMayaAvatar
            delay={0}
            size="roast"
            transparent
            speaking={speaking}
            personaId="james"
          />
        </div>
        <div className="interview-teacher-chip interview-live-chip absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/45 px-2.5 py-1.5 text-[11px] font-medium text-cream/72 backdrop-blur-xl">
          <span
            className={`h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)] ${speaking ? "animate-pulse" : ""}`}
          />
          James
        </div>
      </div>

      <div
        ref={scrollRef}
        data-testid="resume-roast-transcript"
        aria-label="James transcript"
        className="interview-transcript thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5"
      >
        <div className="space-y-4">
          {transcript.map((entry) => {
            const james = entry.speaker === "James";
            return (
              <article
                key={entry.id}
                className={`rounded-xl px-3 py-2.5 ${james ? "bg-white/[0.035]" : "bg-black/15"}`}
              >
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    james ? "text-[var(--workspace-accent)]" : "text-cream/34"
                  }`}
                >
                  {entry.speaker}
                </p>
                <p
                  className={`mt-1.5 text-sm leading-6 ${james ? "text-cream/82" : "text-cream/62"}`}
                >
                  {entry.text}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function roastTranscriptEntries(input: {
  target: Partial<ResumeRoastTarget>;
  events: ResumeRoastStreamEvent[];
  loading: boolean;
  failure: string | null;
  analysisElapsedSeconds: number;
}): RoastTranscriptEntry[] {
  const entries: RoastTranscriptEntry[] = [
    { id: "intro", speaker: "James", text: INTRO },
    { id: "role-question", speaker: "James", text: ROLE_QUESTION }
  ];

  if (input.target.role) {
    entries.push({
      id: "role-answer",
      speaker: "You",
      text: RESUME_ROAST_ROLE_LABELS[input.target.role]
    });
    entries.push({ id: "company-question", speaker: "James", text: COMPANY_QUESTION });
  }
  if (input.target.companyEnvironment) {
    entries.push({
      id: "company-answer",
      speaker: "You",
      text: RESUME_ROAST_COMPANY_ENVIRONMENT_LABELS[input.target.companyEnvironment]
    });
    entries.push({ id: "level-question", speaker: "James", text: LEVEL_QUESTION });
  }
  if (input.target.level) {
    entries.push({
      id: "level-answer",
      speaker: "You",
      text: RESUME_ROAST_LEVEL_LABELS[input.target.level]
    });
  }
  if (input.loading) {
    entries.push({
      id: "reading",
      speaker: "James",
      text: resumeRoastProgressMessage(input.analysisElapsedSeconds)
    });
  }

  const summary = roastSpokenSummary(input.events);
  if (input.events.some((event) => event.type === "done") && summary) {
    entries.push({
      id: "roast-summary",
      speaker: "James",
      text: `${summary} ${ROAST_CLOSING}`
    });
  }
  if (input.failure) {
    entries.push({ id: "failure", speaker: "James", text: input.failure });
  }

  return entries;
}

function Question<T extends string>({
  text,
  selected,
  active,
  options,
  onChoose
}: {
  text: string;
  selected: string | null;
  active: boolean;
  options: readonly { value: T; label: string }[];
  onChoose: (value: T) => void;
}) {
  return (
    <div className="identity-stage-in">
      <JamesLine text={text} />
      {selected ? (
        <div className="mt-4 flex justify-end">
          <span className="rounded-2xl bg-[var(--workspace-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            {selected}
          </span>
        </div>
      ) : null}
      {active ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChoose(option.value)}
              className="rounded-full border border-white/[0.12] bg-white/[0.035] px-3.5 py-2 text-left text-xs font-medium text-cream/76 transition hover:border-[var(--workspace-accent-border)] hover:bg-[var(--workspace-accent-soft)] hover:text-cream"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function JamesLine({
  text,
  icon: Icon,
  label
}: {
  text: string;
  icon?: LucideIcon;
  label?: string;
}) {
  if (Icon) {
    return (
      <div className="flex gap-3">
        <Icon
          size={18}
          strokeWidth={1.8}
          aria-hidden="true"
          className="mt-[0.35rem] shrink-0 text-[var(--workspace-accent)]"
        />
        <p className="text-base leading-7 text-cream sm:text-lg sm:leading-8">
          {label ? <span className="font-semibold text-cream">{label}. </span> : null}
          {text}
        </p>
      </div>
    );
  }

  return (
    <p className="identity-stage-in text-base font-medium leading-7 text-cream sm:text-lg sm:leading-8">
      {text}
    </p>
  );
}

function RoastCards({
  events,
  target
}: {
  events: ResumeRoastStreamEvent[];
  target: Partial<ResumeRoastTarget>;
}) {
  const opening = events.find((event) => event.type === "opening_roast");
  const problems = events.filter((event) => event.type === "problem");
  const strength = events.find((event) => event.type === "strength");
  const verdict = events.find((event) => event.type === "verdict");
  const rewrite = events.find((event) => event.type === "rewrite");
  const actionPlan = events.find((event) => event.type === "action_plan")?.actionPlan ?? [];
  const selectedTarget = completeTarget(target);

  return (
    <div className="space-y-10">
      <section aria-labelledby="roast-weak-points">
        <div className="mb-5 flex items-center gap-2 text-orange-100">
          <Flame size={19} aria-hidden="true" />
          <h2 id="roast-weak-points" className="text-lg font-bold text-cream">
            Weak points
          </h2>
        </div>
        {opening ? (
          <p className="mb-4 text-base font-semibold leading-7 text-cream">
            {opening.openingRoast}
          </p>
        ) : null}
        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {problems.length ? (
            problems.map((event, index) => (
              <article
                key={`${event.problem.evidenceAnchors.join("-")}-${index}`}
                className="relative py-5 pl-5 pr-1 before:absolute before:bottom-5 before:left-0 before:top-5 before:w-0.5 before:rounded-full before:bg-red-300/60"
              >
                <p className="text-base font-bold leading-7 text-cream">{event.problem.joke}</p>
                <p className="mt-2 text-sm leading-6 text-cream/78">{event.problem.issue}</p>
                <p className="mt-2 text-sm leading-6 text-cream/55">
                  {event.problem.recruiterImpact}
                </p>
              </article>
            ))
          ) : (
            <article className="relative py-5 pl-5 pr-1 before:absolute before:bottom-5 before:left-0 before:top-5 before:w-0.5 before:rounded-full before:bg-emerald-300/60">
              <p className="font-bold text-emerald-100">Annoyingly hard to roast.</p>
              <p className="mt-2 text-sm leading-6 text-cream/65">
                {strength?.strength.explanation ??
                  "The resume gives James very little nonsense to work with."}
              </p>
            </article>
          )}
        </div>
      </section>

      {verdict ? (
        <section
          aria-label={`Target fit score: ${verdict.verdict.targetFitScore} out of 100`}
          className="border-y border-white/[0.1] bg-gradient-to-r from-[var(--workspace-accent-soft)] via-transparent to-transparent py-6 pl-5 pr-1"
        >
          <div className="flex items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream/48">
                Target fit
              </p>
              <p className="mt-2 text-4xl font-black tracking-tight text-cream">
                {verdict.verdict.targetFitScore}
                <span className="text-lg font-semibold text-cream/45">/100</span>
              </p>
            </div>
            <Gauge
              size={38}
              strokeWidth={1.7}
              className="shrink-0 text-[var(--workspace-accent)]"
              aria-hidden="true"
            />
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-cream/68">
            {verdict.verdict.explanation}
          </p>
          {selectedTarget ? (
            <p className="mt-3 text-xs leading-5 text-cream/42">
              For {RESUME_ROAST_LEVEL_LABELS[selectedTarget.level]}{" "}
              {RESUME_ROAST_ROLE_LABELS[selectedTarget.role]} ·{" "}
              {RESUME_ROAST_COMPANY_ENVIRONMENT_LABELS[selectedTarget.companyEnvironment]}
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="roast-fixes">
        <div className="mb-4 flex items-center gap-2">
          <Wrench size={19} className="text-[var(--workspace-accent)]" aria-hidden="true" />
          <h2 id="roast-fixes" className="text-lg font-bold text-cream">
            Ways to fix it
          </h2>
        </div>
        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {problems.map((event, index) => (
            <FixCard
              key={`problem-fix-${index}`}
              number={index + 1}
              text={event.problem.improvement}
            />
          ))}
          {rewrite ? (
            <article className="py-6 pl-12 pr-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cream/42">
                Rewrite this
              </p>
              <p className="mt-3 text-sm leading-6 text-cream/45 line-through decoration-orange-300/50">
                {rewrite.rewrite.before}
              </p>
              <p className="mt-3 text-base font-semibold leading-7 text-cream">
                {rewrite.rewrite.after}
              </p>
              <p className="mt-2 text-sm leading-6 text-cream/55">{rewrite.rewrite.rationale}</p>
            </article>
          ) : null}
          {actionPlan.map((item) => (
            <FixCard
              key={`action-${item.priority}`}
              number={problems.length + item.priority}
              text={item.action}
              detail={item.rationale}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function FixCard({ number, text, detail }: { number: number; text: string; detail?: string }) {
  return (
    <article className="flex gap-4 py-5 pr-1">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--workspace-accent-soft)] text-sm font-black text-[var(--workspace-accent)]">
        {number}
      </span>
      <div>
        <p className="text-base font-semibold leading-7 text-cream">{text}</p>
        {detail ? <p className="mt-1 text-sm leading-6 text-cream/55">{detail}</p> : null}
      </div>
    </article>
  );
}

function MissingResume() {
  return (
    <main className="resume-roast-page grid h-[calc(100dvh-4.25rem)] place-items-center bg-black px-4 text-cream">
      <DocumentTitle title="Resume Roast" />
      <div className="progress-maya-bubble w-full max-w-lg rounded-2xl p-7 text-center">
        <FileText className="mx-auto text-orange-200" />
        <p className="mt-4 text-xl font-semibold">James needs a resume first.</p>
        <Link
          href="/profile"
          className="mt-6 inline-flex rounded-xl bg-cream px-4 py-2.5 text-sm font-bold text-black"
        >
          Go to Profile
        </Link>
      </div>
    </main>
  );
}

function LoadFailure({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <main className="resume-roast-page grid h-[calc(100dvh-4.25rem)] place-items-center bg-black px-4 text-cream">
      <div className="progress-maya-bubble w-full max-w-lg rounded-2xl p-7 text-center">
        <p>{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl bg-cream px-4 py-2 text-sm font-bold text-black"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

function completeTarget(value: Partial<ResumeRoastTarget>): ResumeRoastTarget | null {
  return value.role && value.companyEnvironment && value.level
    ? { role: value.role, companyEnvironment: value.companyEnvironment, level: value.level }
    : null;
}

function roastSpokenSummary(events: ResumeRoastStreamEvent[]): string {
  const generated = events.find((event) => event.type === "spoken_summary");
  if (generated) return generated.spokenSummary;

  // Saved roasts from before v5 do not have a dedicated voice script. Keep
  // their fallback short enough to speak as one uninterrupted audio request.
  const opening = events.find((event) => event.type === "opening_roast");
  const jokes = events
    .filter((event) => event.type === "problem")
    .map((event) => event.problem.joke);
  return [opening?.openingRoast, ...jokes].filter(Boolean).join(" ");
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
