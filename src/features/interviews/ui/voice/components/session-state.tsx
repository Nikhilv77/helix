import { pickLine, TEACHER_LINES } from "@/lib/voice/teacher-lines";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  ArrowRight,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Volume2,
  VolumeX,
  WifiOff
} from "lucide-react";
import { workspaceAccentCssVariables, type WorkspaceAccent } from "@/lib/workspace/accent";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { useMayaVoice } from "@/infrastructure/realtime/use-maya-voice";
import { ReportMayaAvatar } from "@/features/reports/ui/report-maya-avatar";

export function VoiceShell({
  children,
  workspaceAccent,
  wide = false,
  withinWorkspaceChrome = false
}: {
  children: React.ReactNode;
  workspaceAccent: WorkspaceAccent;
  wide?: boolean;
  withinWorkspaceChrome?: boolean;
}) {
  return (
    <main
      data-workspace-accent={workspaceAccent}
      style={workspaceAccentCssVariables(workspaceAccent) as CSSProperties}
      className={`interview-workspace-page workspace-black relative overflow-hidden bg-black px-4 text-cream sm:px-8 ${
        withinWorkspaceChrome ? "h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4.25rem)]" : "h-[100dvh]"
      }`}
    >
      <span
        aria-hidden="true"
        className="interview-room-ambient pointer-events-none absolute left-1/2 top-[46%] h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] opacity-45 blur-[140px]"
      />
      <span
        aria-hidden="true"
        className="interview-room-ambient pointer-events-none absolute -bottom-52 -right-40 h-[34rem] w-[34rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-20 blur-[150px]"
      />
      <div
        className={`relative z-10 mx-auto flex h-full w-full flex-col pt-4 sm:pt-5 ${
          wide ? "max-w-[96rem]" : "max-w-7xl"
        }`}
      >
        {children}
      </div>
    </main>
  );
}

export function SessionLoadingScreen({
  error,
  onRetry,
  workspaceAccent
}: {
  error: string | null;
  onRetry: () => void;
  workspaceAccent: WorkspaceAccent;
}) {
  const teacher = useWorkspaceTeacher();
  return (
    <VoiceShell workspaceAccent={workspaceAccent}>
      <section
        className="flex flex-1 items-center justify-center py-12"
        role="status"
        aria-live="polite"
      >
        <div className="relative w-full max-w-md text-center">
          <span
            aria-hidden="true"
            className="interview-room-ambient pointer-events-none absolute left-1/2 top-[42%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] opacity-45 blur-[90px]"
          />
          {error ? (
            <WifiOff
              size={23}
              strokeWidth={1.5}
              className="relative mx-auto text-[var(--workspace-accent)]"
              aria-hidden="true"
            />
          ) : (
            <Loader2
              size={24}
              strokeWidth={1.5}
              className="relative mx-auto animate-spin text-[var(--workspace-accent)] drop-shadow-[0_0_12px_var(--workspace-accent)]"
              aria-hidden="true"
            />
          )}
          <h1 className="relative mt-5 font-display text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
            {error ? "The room could not be loaded" : "Preparing your interview"}
          </h1>
          {error ? (
            <>
              <p className="relative mx-auto mt-3 max-w-sm text-sm leading-6 text-cream/58">
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="relative mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white"
              >
                <RefreshCw size={15} aria-hidden="true" />
                Try again
              </button>
            </>
          ) : (
            <p className="relative mt-2.5 text-sm text-cream/42">
              {teacher.name} will join shortly.
            </p>
          )}
        </div>
      </section>
    </VoiceShell>
  );
}

export function SessionStateScreen({
  kind,
  workspaceAccent,
  blockAssessmentBlockId = null,
  coreTechnicalBlockId = null,
  storyPracticeAssessment = null,
  evaluationLabel = "interview",
  evaluationParameters = [],
  interviewerName = "James"
}: {
  kind: "expired" | "complete";
  duration?: number;
  answers?: number;
  workspaceAccent: WorkspaceAccent;
  blockAssessmentBlockId?: string | null;
  coreTechnicalBlockId?: string | null;
  storyPracticeAssessment?: {
    blockId: string;
    routeBase: string;
    label: string;
  } | null;
  evaluationLabel?: string;
  evaluationParameters?: string[];
  interviewerName?: string;
}) {
  const teacher = useWorkspaceTeacher();
  const complete = kind === "complete";

  if (complete) {
    return (
      <VoiceShell workspaceAccent={workspaceAccent}>
        <CompletionDebrief
          blockAssessmentBlockId={blockAssessmentBlockId}
          coreTechnicalBlockId={coreTechnicalBlockId}
          storyPracticeAssessment={storyPracticeAssessment}
          evaluationLabel={evaluationLabel}
          evaluationParameters={evaluationParameters}
          interviewerName={interviewerName}
        />
      </VoiceShell>
    );
  }

  return (
    <VoiceShell workspaceAccent={workspaceAccent}>
      <section className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.035] text-[var(--workspace-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
            <Clock3 size={24} aria-hidden="true" />
          </span>
          <p className="mt-7 text-sm font-mono uppercase tracking-[0.2em] text-cream/38">
            Session closed
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-cream sm:text-5xl">
            This interview has expired
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-cream/64 sm:text-base">
            Interview rooms close after their session window. Start a fresh round to reconnect with
            {` ${teacher.name}.`}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/interviews"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#10131a] transition hover:bg-white"
            >
              Start a new interview
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-lg border border-cream/15 px-5 text-sm font-semibold text-cream/60 transition hover:border-cream/35 hover:text-cream"
            >
              Return to Trailgrad
            </Link>
          </div>
        </div>
      </section>
    </VoiceShell>
  );
}

function CompletionDebrief({
  blockAssessmentBlockId,
  coreTechnicalBlockId,
  storyPracticeAssessment,
  evaluationLabel,
  evaluationParameters,
  interviewerName
}: {
  blockAssessmentBlockId: string | null;
  coreTechnicalBlockId: string | null;
  storyPracticeAssessment: {
    blockId: string;
    routeBase: string;
    label: string;
  } | null;
  evaluationLabel: string;
  evaluationParameters: string[];
  interviewerName: string;
}) {
  const teacher = useWorkspaceTeacher();
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const spoken = useRef(false);
  // The interviewer and rubric are shown on screen; the spoken line is pre-recorded.
  const voiceLine = useMemo(() => pickLine(TEACHER_LINES.interviewDebrief), []);
  const speaking = state === "speaking" || state === "loading";
  const speakDebrief = useCallback(() => {
    if (spoken.current && !speaking) spoken.current = false;
    void speak(voiceLine).then((result) => {
      if (result === "started" || result === "unavailable") spoken.current = true;
    });
  }, [speak, speaking, voiceLine]);

  useEffect(() => {
    if (awaitingGesture || spoken.current) return;
    const timer = window.setTimeout(speakDebrief, 420);
    return () => window.clearTimeout(timer);
  }, [awaitingGesture, speakDebrief]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => {
      setAwaitingGesture(false);
      speakDebrief();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, setAwaitingGesture, speakDebrief]);

  const blockHref = blockAssessmentBlockId
    ? `/practice/dsa?block=${encodeURIComponent(blockAssessmentBlockId)}`
    : storyPracticeAssessment
      ? `${storyPracticeAssessment.routeBase}?block=${encodeURIComponent(storyPracticeAssessment.blockId)}`
      : coreTechnicalBlockId
        ? `/practice/core-technical?block=${encodeURIComponent(coreTechnicalBlockId)}`
        : null;

  return (
    <section className="flex flex-1 items-center justify-center overflow-y-auto py-6 sm:py-10">
      <div className="grid w-full max-w-5xl items-center gap-4 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1fr)] lg:gap-10">
        <div className="mx-auto w-full max-w-[30rem]">
          <ReportMayaAvatar speaking={state === "speaking"} transparent size="compact" />
        </div>

        <div className="text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-accent)]">
            Report ready with {teacher.name}
          </p>
          <h1 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
            {interviewerName} has reported back to me.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-cream/66 lg:mx-0">
            I reviewed your {evaluationLabel} performance. I’ll explain what your scores mean, show
            the evidence behind them, and give you one practical next step. You completed the
            interview—now we turn it into progress.
          </p>

          {evaluationParameters.length ? (
            <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
              {evaluationParameters.map((parameter) => (
                <span
                  key={parameter}
                  className="rounded-full border border-white/[0.1] bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-cream/62"
                >
                  {parameter}
                </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => (speaking ? stop() : speakDebrief())}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--workspace-accent)] transition hover:brightness-110"
          >
            {speaking ? (
              <VolumeX size={16} aria-hidden="true" />
            ) : (
              <Volume2 size={16} aria-hidden="true" />
            )}
            {speaking ? `Stop ${teacher.name}` : `Hear ${teacher.name}`}
          </button>

          <div className="mx-auto mt-7 flex max-w-sm flex-col gap-2.5 lg:mx-0">
            <Link
              href="/reports"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white"
            >
              <FileText size={15} aria-hidden="true" />
              Review my report with {teacher.name}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            {blockHref ? (
              <Link
                href={blockHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-cream/58 transition hover:bg-white/[0.04] hover:text-cream"
              >
                View block details
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
