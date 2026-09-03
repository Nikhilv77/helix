"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import {
  Award,
  Briefcase,
  CircleAlert,
  Code2,
  FileText,
  Flame,
  Gauge,
  GraduationCap,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
  type LucideIcon
} from "lucide-react";
import { DocumentTitle } from "@/components/document-title";
import { ReportMayaAvatar } from "@/components/workspace/reports/report-maya-avatar";
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
} from "@/lib/resume-roast/contracts";
import {
  createResumeRoastEventParser,
  resumeRoastResultEvents,
  ResumeRoastStreamParseError
} from "@/lib/resume-roast/stream";
import { notifyWorkspaceNotificationsChanged } from "@/lib/notifications/notification-ui-events";
import type { CandidateResume } from "@/lib/shared/types";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";

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

interface FlaggedLine {
  id: string;
  text: string;
  reason: string;
}

interface ResumeRevealItem {
  id: string;
  icon: LucideIcon | null;
  label: string | null;
  text: string;
  detail?: string;
  reason?: string;
}

const INTRO = "Okay, I’ve got your resume. Three quick questions, then we’ll get into it.";
const ROLE_QUESTION = "What role are you aiming for?";
const COMPANY_QUESTION = "What kind of company are we trying to impress?";
const LEVEL_QUESTION = "What level are you applying for?";
const READING_LINE =
  "Nice. Give me a second—I’m checking where the confidence got ahead of the evidence.";
const ROAST_CLOSING =
  "Now check below—I’ve laid out every issue with your resume and exactly how to fix it.";
const PROVIDER_FAILURE_MESSAGE = "James is temporarily unavailable. Try again.";
const TIMEOUT_MESSAGE = "James took too long. Try again.";
const INVALID_RESPONSE_MESSAGE = "James couldn’t safely prepare that feedback. Try again.";
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
  return PROVIDER_FAILURE_MESSAGE;
}

function apiFailureMessage(code: string | undefined): string {
  return code === "RESUME_ROAST_RATE_LIMITED" ? RATE_LIMIT_MESSAGE : PROVIDER_FAILURE_MESSAGE;
}

class ResumeRoastClientError extends Error {}

export function ResumeRoastWorkspace({ resume }: { resume: CandidateResume | null }) {
  const mounted = useRef(true);
  const requestId = useRef(0);
  const stateController = useRef<AbortController | null>(null);
  const roastController = useRef<AbortController | null>(null);
  const spokenLine = useRef("");
  const spokenRoast = useRef("");
  const [state, setState] = useState<RoastState | null>(null);
  const [screen, setScreen] = useState<ScreenState>("loading");
  const [target, setTarget] = useState<Partial<ResumeRoastTarget>>({});
  const [events, setEvents] = useState<ResumeRoastStreamEvent[]>([]);
  const [showingPrevious, setShowingPrevious] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const { state: voiceState, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();

  const complete = events.some((event) => event.type === "done");
  const roastSessionId =
    events.find((event) => event.type === "session")?.roastId ?? "pending-roast";
  const roastSpeech = useMemo(() => {
    const summary = roastSpokenSummary(events);
    return summary ? `${summary} ${ROAST_CLOSING}` : "";
  }, [events]);
  const voiceLine = useMemo(() => {
    if (screen === "streaming") return READING_LINE;
    if (!target.role) return `${INTRO} ${ROLE_QUESTION}`;
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
    if (complete || screen === "loading" || awaitingGesture) return;
    const timer = window.setTimeout(() => playVoice(voiceLine), 360);
    return () => window.clearTimeout(timer);
  }, [awaitingGesture, complete, playVoice, screen, voiceLine]);

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
    spokenRoast.current = roastSessionId;
    void speak(roastSpeech, "james", { playbackRate: 0.92 }).then((result) => {
      if (result === "blocked") spokenRoast.current = "";
    });
  }, [awaitingGesture, complete, roastSessionId, roastSpeech, speak, voiceState]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => {
      setAwaitingGesture(false);
      if (complete) spokenRoast.current = "";
      else playVoice(voiceLine, true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, complete, playVoice, setAwaitingGesture, voiceLine]);

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
    requestState();
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

  const flagged = flaggedResumeLines(resume, events);

  return (
    <main className="h-[calc(100dvh-4.25rem)] w-full touch-pan-y overflow-y-scroll overscroll-y-auto bg-black px-3 py-2 text-cream md:overflow-hidden md:overscroll-none sm:px-5 sm:py-3">
      <DocumentTitle title="Resume Roast" />
      <div className="mx-auto grid w-full max-w-[78rem] grid-rows-[30rem_minmax(32rem,calc(100dvh-5.25rem))] gap-3 md:h-full md:min-h-0 md:grid-cols-[minmax(20rem,0.86fr)_minmax(22rem,1.14fr)] md:grid-rows-1 md:gap-7 lg:gap-10">
        <ResumeStage resume={resume} flagged={flagged} speaking={voiceState === "speaking"} />
        <JamesChat
          target={target}
          events={events}
          showingPrevious={showingPrevious}
          loading={screen === "streaming"}
          roastComplete={complete}
          failure={failure}
          analysisElapsedSeconds={analysisElapsedSeconds}
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
      </div>
    </main>
  );
}

function ResumeStage({
  resume,
  flagged,
  speaking
}: {
  resume: CandidateResume;
  flagged: FlaggedLine[];
  speaking: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => resumeRevealItems(resume, flagged), [flagged, resume]);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= items.length) return;
    const delay = visibleCount === 0 ? 480 : 1_050;
    const timer = window.setTimeout(() => setVisibleCount((count) => count + 1), delay);
    return () => window.clearTimeout(timer);
  }, [items.length, visibleCount]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || visibleCount === 0) return;
    const timer = window.setTimeout(() => {
      if (viewport.scrollHeight <= viewport.clientHeight + 4) return;
      viewport.scrollTo?.({ top: viewport.scrollHeight, behavior: "smooth" });
    }, 90);
    return () => window.clearTimeout(timer);
  }, [items.length, visibleCount]);

  return (
    <section className="flex min-h-0 flex-col items-center overflow-hidden">
      <div className="relative z-0 w-full max-w-[28rem] shrink-0">
        <span
          aria-hidden
          className="report-maya-glow-a pointer-events-none absolute left-1/2 top-[46%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] blur-[72px]"
        />
        <span
          aria-hidden
          className="report-maya-glow-b pointer-events-none absolute bottom-4 left-1/2 h-28 w-60 -translate-x-1/2 rounded-full bg-[var(--workspace-accent)] opacity-30 blur-[64px]"
        />
        <div className="relative z-10">
          <ReportMayaAvatar
            delay={0}
            size="compact"
            transparent
            speaking={speaking}
            personaId="james"
          />
        </div>
      </div>

      <div className="progress-maya-bubble relative z-10 -mt-8 min-h-0 w-full flex-1 overflow-hidden rounded-2xl sm:-mt-10">
        <span
          aria-hidden
          className="progress-maya-tail absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#1b1c20]/70"
        />
        <div
          ref={scrollRef}
          aria-label="Resume and weak points"
          className="thin-scroll h-full overflow-y-auto overscroll-auto px-5 py-5 md:overscroll-contain sm:px-7 sm:py-6"
        >
          <div className="mx-auto max-w-lg space-y-5 pb-8">
            {items.slice(0, visibleCount).map((item) => (
              <ResumeRevealBlock key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function resumeRevealItems(resume: CandidateResume, flagged: FlaggedLine[]): ResumeRevealItem[] {
  const reasons = new Map(flagged.map((line) => [normalizeText(line.text), line.reason]));
  const items: ResumeRevealItem[] = [
    {
      id: "identity",
      icon: null,
      label: null,
      text: resume.fullName
    }
  ];

  if (resume.skills.length) {
    items.push({
      id: "skills",
      icon: Sparkles,
      label: "Skills",
      text: resume.skills.join(" · ")
    });
  }

  for (const [experienceIndex, entry] of resume.experience.entries()) {
    items.push({
      id: `experience-${experienceIndex}`,
      icon: Briefcase,
      label: entry.role,
      text: [entry.organization, entry.period, entry.location].filter(Boolean).join(" · "),
      detail: entry.summary,
      reason: reasons.get(normalizeText(entry.summary))
    });
    entry.achievements.forEach((achievement, achievementIndex) => {
      items.push({
        id: `experience-${experienceIndex}-achievement-${achievementIndex}`,
        icon: TrendingUp,
        label: "Impact",
        text: achievement,
        reason: reasons.get(normalizeText(achievement))
      });
    });
  }

  for (const [projectIndex, project] of resume.projects.entries()) {
    items.push({
      id: `project-${projectIndex}`,
      icon: Code2,
      label: project.name,
      text: project.summary,
      detail: project.skills.length ? project.skills.join(" · ") : undefined,
      reason: reasons.get(normalizeText(project.summary))
    });
    if (project.outcome.trim()) {
      items.push({
        id: `project-${projectIndex}-outcome`,
        icon: Target,
        label: "Outcome",
        text: project.outcome,
        reason: reasons.get(normalizeText(project.outcome))
      });
    }
  }

  for (const [educationIndex, education] of resume.education.entries()) {
    items.push({
      id: `education-${educationIndex}`,
      icon: GraduationCap,
      label: education.credential,
      text: [education.field, education.institution, education.period].filter(Boolean).join(" · ")
    });
  }

  resume.achievements.forEach((achievement, achievementIndex) => {
    items.push({
      id: `achievement-${achievementIndex}`,
      icon: Award,
      label: "Achievement",
      text: achievement,
      reason: reasons.get(normalizeText(achievement))
    });
  });

  const matchedWeakPoints = new Set(
    items.filter((item) => item.reason).map((item) => normalizeText(item.text))
  );
  flagged.forEach((line, index) => {
    if (matchedWeakPoints.has(normalizeText(line.text))) return;
    items.push({
      id: `weak-point-${index}-${line.id}`,
      icon: CircleAlert,
      label: "Weak point",
      text: line.text,
      reason: line.reason
    });
  });

  return items;
}

function ResumeRevealBlock({ item }: { item: ResumeRevealItem }) {
  const Icon = item.icon;
  if (!Icon) {
    return (
      <div className="identity-stage-in">
        <p className="text-base font-semibold leading-7 text-cream sm:text-lg sm:leading-8">
          {item.text}
        </p>
        {item.detail ? (
          <p className="mt-2 text-base leading-7 text-cream/68 sm:text-lg sm:leading-8">
            {item.detail}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="identity-stage-in flex gap-3">
      <Icon
        size={18}
        strokeWidth={1.8}
        aria-hidden="true"
        className="mt-[0.35rem] shrink-0 text-[var(--workspace-accent)]"
      />
      <div className="min-w-0">
        <p className="text-base leading-7 text-cream sm:text-lg sm:leading-8">
          {item.label ? <span className="font-semibold text-cream">{item.label}. </span> : null}
          {item.text}
        </p>
        {item.detail ? (
          <p className="mt-2 text-base leading-7 text-cream/68 sm:text-lg sm:leading-8">
            {item.detail}
          </p>
        ) : null}
        {item.reason ? (
          <p className="mt-2 text-base font-medium leading-7 text-orange-100/72 sm:text-lg sm:leading-8">
            {item.reason}
          </p>
        ) : null}
      </div>
    </div>
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
    <section className="progress-maya-bubble min-h-0 overflow-hidden rounded-2xl">
      <div
        ref={scrollRef}
        data-testid="resume-roast-chat-scroll"
        aria-live="polite"
        onWheel={cancelCompletionAutoScroll}
        onTouchMove={cancelCompletionAutoScroll}
        onPointerDown={cancelCompletionAutoScroll}
        onKeyDown={cancelCompletionAutoScrollForKey}
        className="thin-scroll h-full overflow-y-auto overscroll-auto px-5 py-7 md:overscroll-contain sm:px-8 sm:py-9"
      >
        <div className="mx-auto max-w-2xl space-y-8 pb-10">
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
    <div className="space-y-8">
      <section aria-labelledby="roast-weak-points">
        <div className="mb-4 flex items-center gap-2 text-orange-100">
          <Flame size={19} aria-hidden="true" />
          <h2 id="roast-weak-points" className="text-lg font-bold text-cream">
            Weak points
          </h2>
        </div>
        {opening ? (
          <p className="mb-4 text-base font-semibold leading-7 text-orange-100/90">
            {opening.openingRoast}
          </p>
        ) : null}
        <div className="grid gap-3">
          {problems.length ? (
            problems.map((event, index) => (
              <article
                key={`${event.problem.evidenceAnchors.join("-")}-${index}`}
                className="rounded-2xl border border-red-400/35 bg-white/[0.035] p-5"
              >
                <p className="text-base font-bold leading-7 text-orange-100">
                  {event.problem.joke}
                </p>
                <p className="mt-2 text-sm leading-6 text-cream/78">{event.problem.issue}</p>
                <p className="mt-2 text-sm leading-6 text-cream/55">
                  {event.problem.recruiterImpact}
                </p>
              </article>
            ))
          ) : (
            <article className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-5">
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
          className="rounded-2xl border border-white/10 bg-white/[0.045] p-5"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream/48">
                Target fit
              </p>
              <p className="mt-2 text-4xl font-black tracking-tight text-cream">
                {verdict.verdict.targetFitScore}
                <span className="text-lg font-semibold text-cream/45">/100</span>
              </p>
            </div>
            <Gauge size={34} className="text-[var(--workspace-accent)]" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm leading-6 text-cream/68">{verdict.verdict.explanation}</p>
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
        <div className="grid gap-3">
          {problems.map((event, index) => (
            <FixCard
              key={`problem-fix-${index}`}
              number={index + 1}
              text={event.problem.improvement}
            />
          ))}
          {rewrite ? (
            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
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
    <article className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--workspace-accent-soft)] text-sm font-black text-orange-100">
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
    <main className="grid h-[calc(100dvh-4.25rem)] place-items-center bg-black px-4 text-cream">
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
    <main className="grid h-[calc(100dvh-4.25rem)] place-items-center bg-black px-4 text-cream">
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

export function ResumeRoastLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading Resume Roast"
      className="h-[calc(100dvh-4.25rem)] touch-pan-y overflow-y-scroll overscroll-y-auto bg-black px-5 py-3 md:overflow-hidden md:overscroll-none"
    >
      <div className="mx-auto grid max-w-[78rem] grid-rows-[30rem_minmax(32rem,calc(100dvh-5.25rem))] gap-3 md:h-full md:min-h-0 md:grid-cols-[0.86fr_1.14fr] md:grid-rows-1 md:gap-10">
        <div className="flex min-h-0 flex-col items-center">
          <div className="h-[20rem] w-[20rem] animate-pulse rounded-full bg-white/[0.025]" />
          <div className="progress-maya-bubble -mt-10 min-h-0 w-full flex-1 rounded-2xl" />
        </div>
        <div className="progress-maya-bubble animate-pulse rounded-2xl" />
      </div>
    </main>
  );
}

function completeTarget(value: Partial<ResumeRoastTarget>): ResumeRoastTarget | null {
  return value.role && value.companyEnvironment && value.level
    ? { role: value.role, companyEnvironment: value.companyEnvironment, level: value.level }
    : null;
}

function flaggedResumeLines(
  resume: CandidateResume,
  events: ResumeRoastStreamEvent[]
): FlaggedLine[] {
  const evidence = resumeEvidence(resume);
  const problems = events.filter((event) => event.type === "problem");
  const flagged: FlaggedLine[] = [];
  const seen = new Set<string>();

  for (const event of problems) {
    if (event.type !== "problem") continue;
    const anchors = event.problem.evidenceAnchors.filter((anchor) => !anchor.startsWith("signal:"));
    for (const anchor of anchors) {
      const text = evidence.get(anchor);
      const key = normalizeText(text ?? "");
      if (!text || seen.has(key)) continue;
      flagged.push({ id: anchor, text, reason: event.problem.issue });
      seen.add(key);
    }
  }
  if (problems.length) return flagged.slice(0, 6);

  const candidates = [
    ...resume.warnings.map((text, index) => ({
      id: `warning-${index}`,
      text,
      reason: "The parser could not trust this part."
    })),
    ...resume.experience.flatMap((entry, experienceIndex) =>
      entry.achievements
        .map((text, achievementIndex) => ({
          id: `experience-${experienceIndex + 1}-achievement-${achievementIndex + 1}`,
          text,
          reason: "No measurable proof attached."
        }))
        .filter((line) => !hasConcreteProof(line.text))
    ),
    ...resume.projects
      .map((project, index) => ({
        id: `project-${index + 1}-outcome`,
        text: project.outcome || project.summary,
        reason: "The outcome or ownership is unclear."
      }))
      .filter((line) => line.text && !hasConcreteProof(line.text))
  ];

  for (const candidate of candidates) {
    const key = normalizeText(candidate.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    flagged.push(candidate);
    if (flagged.length === 6) break;
  }
  return flagged;
}

function resumeEvidence(resume: CandidateResume): Map<string, string> {
  const evidence = new Map<string, string>();
  resume.experience.forEach((entry, experienceIndex) => {
    evidence.set(`experience-${experienceIndex + 1}-summary`, entry.summary);
    entry.achievements.forEach((achievement, achievementIndex) => {
      evidence.set(
        `experience-${experienceIndex + 1}-achievement-${achievementIndex + 1}`,
        achievement
      );
    });
  });
  resume.projects.forEach((project, projectIndex) => {
    evidence.set(`project-${projectIndex + 1}-summary`, project.summary);
    evidence.set(`project-${projectIndex + 1}-outcome`, project.outcome);
  });
  resume.achievements.forEach((achievement, index) => {
    evidence.set(`achievement-${index + 1}`, achievement);
  });
  return evidence;
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

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function hasConcreteProof(text: string): boolean {
  return /(?:\d|%|[$€£₹]|\b(?:users?|customers?|requests?|services?|countries|teams?)\b)/i.test(
    text
  );
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
