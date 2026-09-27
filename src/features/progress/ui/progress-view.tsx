"use client";

import { pickLine, TEACHER_LINES } from "@/lib/voice/teacher-lines";
import Link from "next/link";
import { ArrowRight, Braces, Flame, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { DocumentTitle } from "@/components/document-title";
import { ReportMayaAvatar } from "@/features/reports/ui/report-maya-avatar";
import type { ProgressBriefingOverview } from "@/features/progress/contracts/progress";
import { useMayaVoice } from "@/infrastructure/realtime/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";

type ProgressInsight = {
  icon: LucideIcon;
  label: string;
  text: string;
};

type ProgressBriefing = {
  hasPracticeProgress: boolean;
  greeting: string;
  insights: ProgressInsight[];
  voiceLine: string;
  primaryCta: string;
  primaryHref: string;
};

export type ProgressStarterQuestion = {
  title: string;
  /** AI/ML paths have no difficulty rating. */
  difficulty: "easy" | "medium" | "hard" | null;
  minutes: number;
  href: string;
  chapterTitle: string;
};

/**
 * Progress is Maya's read on the candidate's rhythm. Practice owns the
 * question-level detail, so this page stays a concise coaching answer.
 */
export function ProgressView({
  overview,
  firstName,
  starterQuestions
}: {
  overview: ProgressBriefingOverview;
  firstName: string;
  starterQuestions: ProgressStarterQuestion[];
}) {
  const briefing = useMemo(() => buildProgressBriefing(overview, firstName), [firstName, overview]);
  const voiceAttempted = useRef(false);
  const { state, speak, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";

  const speakBriefing = useCallback(() => {
    if (voiceAttempted.current) return;
    voiceAttempted.current = true;
    void speak(briefing.voiceLine).then((result) => {
      if (result === "blocked") voiceAttempted.current = false;
    });
  }, [briefing.voiceLine, speak]);

  useEffect(() => {
    voiceAttempted.current = false;
  }, [briefing.voiceLine]);

  useEffect(() => {
    if (awaitingGesture) return;
    const timer = window.setTimeout(speakBriefing, 420);
    return () => window.clearTimeout(timer);
  }, [awaitingGesture, speakBriefing]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => {
      setAwaitingGesture(false);
      speakBriefing();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, setAwaitingGesture, speakBriefing]);

  return (
    <main className="progress-page mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 pb-20 pt-8 text-cream sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
      <DocumentTitle title="Progress" />

      <section className="flex min-h-[calc(100svh-9rem)] w-full flex-col items-center justify-center py-8">
        <div className="relative w-full max-w-[26rem]">
          <span
            aria-hidden
            className="report-maya-glow-a pointer-events-none absolute left-1/2 top-[46%] z-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] blur-[72px]"
          />
          <span
            aria-hidden
            className="report-maya-glow-b pointer-events-none absolute bottom-4 left-1/2 z-0 h-28 w-60 -translate-x-1/2 rounded-full bg-[var(--workspace-accent)] opacity-30 blur-[64px]"
          />
          <div className="relative z-10">
            <ReportMayaAvatar delay={0} size="compact" transparent speaking={speaking} />
          </div>
        </div>

        <div className="identity-stage-in relative z-10 -mt-8 flex w-full max-w-2xl flex-col items-center sm:-mt-10">
          <div className="progress-maya-bubble relative w-full rounded-2xl px-5 py-5 text-left sm:px-7 sm:py-6">
            <span
              aria-hidden
              className="progress-maya-tail absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#1b1c20]/70"
            />

            <p className="relative text-base font-medium leading-7 text-cream sm:text-lg sm:leading-8">
              {briefing.greeting}
            </p>

            <ul className="relative mt-4 space-y-3">
              {briefing.insights.map(({ icon: Icon, label, text }) => (
                <li key={label} className="flex gap-3">
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="mt-[0.35rem] shrink-0 text-[var(--workspace-accent)]"
                  />
                  <p className="text-base leading-7 text-cream sm:text-lg sm:leading-8">
                    <span className="font-semibold text-cream">{label}. </span>
                    {text}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {!briefing.hasPracticeProgress && starterQuestions.length ? (
            <StarterQuestionCards questions={starterQuestions} />
          ) : (
            <Link
              href={briefing.primaryHref}
              className="progress-cta-shimmer group relative mt-7 inline-flex min-h-12 items-center gap-2 overflow-hidden rounded-2xl bg-cream px-6 py-3 text-base font-semibold text-[#171a16] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <span className="relative z-10">{briefing.primaryCta}</span>
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="relative z-10 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

function StarterQuestionCards({ questions }: { questions: ProgressStarterQuestion[] }) {
  const teacher = useWorkspaceTeacher();
  const questionIcons = [Braces, Target, TrendingUp];

  return (
    <div className="mt-10 grid w-[min(100vw-2rem,64rem)] max-w-none gap-x-7 gap-y-9 sm:grid-cols-3">
      {questions.map((question, index) => {
        const Icon = questionIcons[index % questionIcons.length] ?? Braces;

        return (
          <Link
            key={question.href}
            href={question.href}
            style={{ "--progress-question-delay": `${index * 75}ms` } as CSSProperties}
            className="progress-question-card group relative flex flex-col rounded-2xl p-6 text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
          >
            <span className="progress-question-icon flex h-9 w-9 items-center justify-center">
              <Icon size={26} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/46">
              {teacher.name} suggests
            </span>
            <h2 className="mt-3 text-lg font-semibold leading-7 text-cream">{question.title}</h2>
            <p className="mt-3 text-base leading-6 text-cream/72">{question.chapterTitle}</p>
            <div className="mt-8 flex items-center justify-between gap-3 text-[15px] font-medium text-cream/82">
              <span>
                {question.difficulty ? `${question.difficulty} · ` : ""}
                {question.minutes} min
              </span>
              <span className="inline-flex items-center gap-1.5">
                Start
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function buildProgressBriefing(
  overview: ProgressBriefingOverview,
  firstName: string
): ProgressBriefing {
  const recentDays = overview.activity.slice(-7);
  const recentSolved = recentDays.reduce((total, day) => total + day.solved, 0);
  const activeDays = recentDays.filter((day) => day.solved > 0 || day.attempts > 0).length;
  const currentStreak = overview.streak.currentDays;
  const longestStreak = overview.streak.longestDays;
  const target = sustainableSessionTarget(recentSolved, activeDays);
  const hasPracticeProgress = overview.totals.completedQuestions > 0;
  const name = firstName.trim();
  // "Arjun, you…" with a name; "You…" without one, never "there, you…".
  const addressed = (sentence: string) =>
    name ? `${name}, ${sentence}` : sentence.charAt(0).toUpperCase() + sentence.slice(1);

  if (!hasPracticeProgress) {
    const hasInterviewEvidence = overview.interview.completedSessions > 0;
    return {
      hasPracticeProgress,
      greeting: addressed(
        hasInterviewEvidence
          ? "you haven't solved a practice question yet. Your interview gave me a first read on you, and your first solved question starts your progress here."
          : "you haven't solved a practice question yet. Solve one of these and I'll start tracking how you're doing."
      ),
      insights: [
        {
          icon: Target,
          label: "Start here",
          text: "Pick any question below. After your first solve, you'll see your pace and how often you're coming back."
        }
      ],
      voiceLine: pickLine(
        hasInterviewEvidence
          ? TEACHER_LINES.progress.notStartedAfterInterview
          : TEACHER_LINES.progress.notStarted
      ),
      primaryCta: "Start practice",
      primaryHref: "/practice"
    };
  }

  const pace = paceCopy(recentSolved, activeDays);
  const continuity = continuityCopy(activeDays, currentStreak, longestStreak);
  const nextMove = nextMoveCopy(activeDays, currentStreak, target);

  return {
    hasPracticeProgress,
    greeting: name
      ? `Here's your last 7 days, ${name}: how much you got done, how often you showed up, and what to do next.`
      : "Here's your last 7 days: how much you got done, how often you showed up, and what to do next.",
    insights: [
      {
        icon: TrendingUp,
        label: "Pace",
        text: pace
      },
      {
        icon: Flame,
        label: "Consistency",
        text: continuity
      },
      {
        icon: Target,
        label: "Next move",
        text: nextMove
      }
    ],
    voiceLine: spokenProgressLine(recentSolved, currentStreak),
    primaryCta: "Continue practice",
    primaryHref: "/practice"
  };
}

/** Pre-recorded phrasing for the learner's current rhythm; numbers stay on screen. */
function spokenProgressLine(recentSolved: number, currentStreak: number): string {
  if (recentSolved === 0) return pickLine(TEACHER_LINES.progress.quiet);
  if (currentStreak >= 3) return pickLine(TEACHER_LINES.progress.streak);
  if (currentStreak > 0) return pickLine(TEACHER_LINES.progress.building);
  return pickLine(TEACHER_LINES.progress.restart);
}

function paceCopy(recentSolved: number, activeDays: number): string {
  if (recentSolved === 0) {
    if (activeDays > 0) {
      return `You practised on ${activeDays} of the last 7 days but didn't finish a question. Finishing one is what starts to count.`;
    }
    return "You haven't solved anything in the last 7 days. Your earlier work still counts; it just isn't a pace yet.";
  }

  if (recentSolved === 1) {
    return `You solved 1 question in the last 7 days, across ${activeDays} active ${pluralize("day", activeDays)}. A good start. Do it again before you try for more.`;
  }

  const perActiveDay = recentSolved / Math.max(activeDays, 1);
  return (
    `You solved ${recentSolved} questions in the last 7 days, over ${activeDays} active ${pluralize("day", activeDays)}, about ${formatPace(perActiveDay)} a day. ` +
    (activeDays >= 4
      ? "That's a real routine. Keep it before adding more."
      : "Good. Repeat it next week before you push harder.")
  );
}

function continuityCopy(activeDays: number, currentStreak: number, longestStreak: number): string {
  if (currentStreak > 0) {
    return (
      `You showed up on ${activeDays} of the last 7 days and you're on a ${currentStreak}-day streak. ` +
      (currentStreak >= 3
        ? "It's turning into a habit. Keep the next session about the same size."
        : "What matters now is coming back tomorrow, not doing a longer session.")
    );
  }
  if (longestStreak > 0) {
    return `You showed up on ${activeDays} of the last 7 days, but your streak has ended. Your best so far is ${longestStreak} ${pluralize("day", longestStreak)}. Start again with a normal-sized session; don't try to catch up.`;
  }
  if (activeDays > 0) {
    return `You showed up on ${activeDays} of the last 7 days. Coming back again soon tells me more than one big session would.`;
  }
  return "Nothing in the last 7 days yet. Your next session is a fresh start, not something to catch up on.";
}

function nextMoveCopy(activeDays: number, currentStreak: number, target: number): string {
  if (activeDays <= 1) {
    return "Solve one question on your next practice day, then stop. Once you've had 3 active days, add more.";
  }
  if (currentStreak >= 3) {
    return `Aim for ${target} ${pluralize("question", target)} next time. Keeping the streak going matters more than doing extra.`;
  }
  if (currentStreak > 0) {
    return "Do one question while your streak is alive. Keep it short enough that tomorrow still feels easy.";
  }
  return `Start again with ${target} ${pluralize("question", target)}, and decide now when your next session will be.`;
}

function sustainableSessionTarget(recentSolved: number, activeDays: number): number {
  if (recentSolved <= 0 || activeDays <= 0) return 1;
  const perActiveDay = recentSolved / activeDays;
  if (perActiveDay >= 2.75) return 3;
  if (perActiveDay >= 1.75) return 2;
  return 1;
}

function formatPace(value: number): string {
  if (value >= 10) return String(Math.round(value));
  if (value >= 1) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(1);
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : word + "s";
}
