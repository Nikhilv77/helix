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
  withinWorkspaceChrome = false,
  ambient = true,
  className = ""
}: {
  children: React.ReactNode;
  /** Omitted by route fallbacks; the room then inherits the shell's accent. */
  workspaceAccent?: WorkspaceAccent;
  wide?: boolean;
  withinWorkspaceChrome?: boolean;
  /** The accent glow behind the live room. Loading and setup stay plain. */
  ambient?: boolean;
  /** Extra scope classes, such as `practice-paper` for Practice assessments. */
  className?: string;
}) {
  return (
    <main
      data-workspace-accent={workspaceAccent}
      style={
        workspaceAccent
          ? (workspaceAccentCssVariables(workspaceAccent) as CSSProperties)
          : undefined
      }
      className={`interview-workspace-page workspace-black relative overflow-hidden bg-black px-4 text-cream sm:px-8 ${ambient ? "" : "interview-plain-canvas"} ${className} ${
        withinWorkspaceChrome ? "h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4.25rem)]" : "h-[100dvh]"
      }`}
    >
      {ambient ? (
        <>
          <span
            aria-hidden="true"
            className="interview-room-ambient pointer-events-none absolute left-1/2 top-[46%] h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] opacity-45 blur-[140px]"
          />
          <span
            aria-hidden="true"
            className="interview-room-ambient pointer-events-none absolute -bottom-52 -right-40 h-[34rem] w-[34rem] rounded-full bg-[var(--workspace-accent-soft)] opacity-20 blur-[150px]"
          />
        </>
      ) : null}
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
  workspaceAccent?: WorkspaceAccent;
}) {
  const teacher = useWorkspaceTeacher();
  return (
    <VoiceShell workspaceAccent={workspaceAccent} ambient={false}>
      <section
        className="flex flex-1 items-center justify-center py-12"
        role="status"
        aria-live="polite"
      >
        <div className="relative w-full max-w-md text-center">
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
              className="relative mx-auto animate-spin text-[var(--workspace-accent)]"
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
  interviewerName = "James",
  answers,
  timedOut = false,
  reportPending = false
}: {
  kind: "expired" | "complete";
  /** The server is still closing the round, so Reports would not show it yet. */
  reportPending?: boolean;
  /** The round reached its time limit rather than being ended by the candidate. */
  timedOut?: boolean;
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
  const complete = kind === "complete";
  // A round closed before any answer has nothing to grade and no report, so
  // it gets its own honest ending instead of the report hand-off.
  const answeredNothing =
    complete &&
    answers === 0 &&
    !blockAssessmentBlockId &&
    !coreTechnicalBlockId &&
    !storyPracticeAssessment;

  if (answeredNothing) {
    return (
      <ClosedRoundScreen
        workspaceAccent={workspaceAccent}
        title={timedOut ? "Time's up" : "No report for this round"}
        body={
          timedOut
            ? `The round reached its time limit before an answer was submitted, so there is nothing for ${interviewerName} to score and it will not appear in Reports. Running code checks it, but only Submit sends it to ${interviewerName}.`
            : `This round closed before you answered a question, so there is nothing for ${interviewerName} to score and it will not appear in Reports. Start it again whenever you are ready.`
        }
        primaryLabel="Back to interviews"
      />
    );
  }

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
          reportPending={reportPending}
        />
      </VoiceShell>
    );
  }

  return (
    <ClosedRoundScreen
      workspaceAccent={workspaceAccent}
      title="This interview has expired"
      // The session is gone, so who ran it is unknown; name nobody.
      body="Interview rooms close after their session window. Start a fresh round whenever you are ready."
      primaryLabel="Start a new interview"
    />
  );
}

/** The quiet ending for a round that closed without a report. */
function ClosedRoundScreen({
  workspaceAccent,
  title,
  body,
  primaryLabel
}: {
  workspaceAccent: WorkspaceAccent;
  title: string;
  body: string;
  primaryLabel: string;
}) {
  return (
    <VoiceShell workspaceAccent={workspaceAccent} ambient={false}>
      <section className="flex flex-1 items-center justify-center py-12">
        <div className="identity-stage-in w-full max-w-xl text-center">
          <span className="interview-media-icon mx-auto grid h-12 w-12 place-items-center rounded-xl border border-white/[0.1] text-cream/72">
            <Clock3 size={20} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="mt-6 text-[13px] font-medium text-[var(--workspace-accent)]">
            Session closed
          </p>
          <h1 className="mt-2 font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] text-cream sm:text-[2.4rem]">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-cream/62">{body}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link
              href="/interviews"
              className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-cream px-5 text-sm font-semibold text-[#10131a] transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              {primaryLabel}
              <ArrowRight
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-cream/58 transition-colors hover:text-cream"
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
  interviewerName,
  reportPending
}: {
  reportPending: boolean;
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
  // Mark the line as started before playing it. Marking it only after playback
  // began let the "loading" re-render schedule a second start, which cut the
  // first one off and made the teacher stammer.
  const speakDebrief = useCallback(() => {
    if (spoken.current) return;
    spoken.current = true;
    void speak(voiceLine).then((result) => {
      // Autoplay was blocked: let the first tap or key press play it.
      if (result === "blocked") spoken.current = false;
    });
  }, [speak, voiceLine]);

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
                  className="rounded-full bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-cream/62"
                >
                  {parameter}
                </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (speaking) {
                stop();
                return;
              }
              // An explicit replay.
              spoken.current = false;
              speakDebrief();
            }}
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
            {/* No prefetch: one taken now would hold Reports from before this round. */}
            {reportPending ? (
              <button
                type="button"
                disabled
                aria-live="polite"
                className="inline-flex min-h-12 cursor-default items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] opacity-70"
              >
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Preparing your report…
              </button>
            ) : (
              <Link
                href="/reports"
                prefetch={false}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white"
              >
                <FileText size={15} aria-hidden="true" />
                Review my report with {teacher.name}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
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
