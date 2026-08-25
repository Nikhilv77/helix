"use client";

import Link from "next/link";
import { ArrowRight, Braces, Flame, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { DocumentTitle } from "@/components/document-title";
import { ReportMayaAvatar } from "@/components/workspace/reports/report-maya-avatar";
import type { ProgressOverview } from "@/lib/roadmap/progress";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";

type ProgressInsight = {
  icon: LucideIcon;
  label: string;
  text: string;
};

type ProgressBriefing = {
  hasProgress: boolean;
  hasPracticeProgress: boolean;
  greeting: string;
  insights: ProgressInsight[];
  voiceLine: string;
  primaryCta: string;
  primaryHref: string;
};

export type ProgressStarterQuestion = {
  title: string;
  difficulty: "easy" | "medium" | "hard";
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
  overview: ProgressOverview;
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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 pb-20 pt-8 text-cream sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
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
              className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#1b1c20]/70"
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
              className="progress-cta-shimmer group relative mt-7 inline-flex min-h-12 items-center gap-2 overflow-hidden rounded-2xl bg-cream px-6 py-3 text-base font-semibold text-[#171a16] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
                {question.difficulty} · {question.minutes} min
              </span>
              <span className="inline-flex items-center gap-1.5 group-hover:text-cream">
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

function buildProgressBriefing(overview: ProgressOverview, firstName: string): ProgressBriefing {
  const recentDays = overview.activity.slice(-7);
  const recentSolved = recentDays.reduce((total, day) => total + day.solved, 0);
  const activeDays = recentDays.filter((day) => day.solved > 0 || day.attempts > 0).length;
  const currentStreak = overview.streak.currentDays;
  const longestStreak = overview.streak.longestDays;
  const target = sustainableSessionTarget(recentSolved, activeDays);
  const hasProgress =
    overview.totals.totalAttempts > 0 ||
    overview.totals.completedQuestions > 0 ||
    overview.interview.completedSessions > 0;
  const hasPracticeProgress =
    overview.totals.totalAttempts > 0 || overview.totals.completedQuestions > 0;
  const name = firstName.trim() || "there";

  if (!hasPracticeProgress) {
    const hasInterviewEvidence = overview.interview.completedSessions > 0;
    return {
      hasProgress,
      hasPracticeProgress,
      greeting:
        "Good, " +
        name +
        (hasInterviewEvidence
          ? ". Your interview gave me a useful starting signal. I have prepared a few questions for you below so we can begin building your practice rhythm."
          : ". This page is quiet until you begin. I have prepared a few questions for you below. Choose whichever feels most comfortable—one focused practice block is enough to give me a rhythm I can read."),
      insights: [
        {
          icon: TrendingUp,
          label: "Pace",
          text: "It is still forming. Finish one focused block and we will have a useful baseline."
        },
        {
          icon: Target,
          label: "Next move",
          text: "Keep it small: choose one thing in practice and stay with it until you reach a clear stopping point."
        }
      ],
      voiceLine:
        "Good, " +
        name +
        (hasInterviewEvidence
          ? ". Your interview gave me a useful starting signal. I have prepared a few questions for you so we can begin building your practice rhythm."
          : ". I have prepared a few questions for you. Choose whichever feels most comfortable, and finish one focused practice block so I can start reading your rhythm."),
      primaryCta: "Start practice",
      primaryHref: "/practice"
    };
  }

  const pace = paceCopy(recentSolved, activeDays);
  const continuity = continuityCopy(activeDays, currentStreak, longestStreak);
  const nextMove = nextMoveCopy(activeDays, currentStreak, target);

  return {
    hasProgress,
    hasPracticeProgress,
    greeting:
      "Good, " +
      name +
      ". I looked at how often you returned, the pace you actually sustained, and whether that pace is repeatable. Here is the progress signal that matters right now.",
    insights: [
      {
        icon: TrendingUp,
        label: "Pace",
        text: pace
      },
      {
        icon: Flame,
        label: "Continuity",
        text: continuity
      },
      {
        icon: Target,
        label: "Next move",
        text: nextMove
      }
    ],
    voiceLine:
      "Good, " +
      name +
      ". Here is your progress update. Pace. " +
      pace +
      " Continuity. " +
      continuity +
      " Next move. " +
      nextMove,
    primaryCta: "Continue practice",
    primaryHref: "/practice"
  };
}

function paceCopy(recentSolved: number, activeDays: number): string {
  if (recentSolved === 0) {
    if (activeDays > 0) {
      return (
        "You were active on " +
        activeDays +
        " of the last 7 days, but no focused block was completed. The effort is visible, but there is not a completion pace to protect yet."
      );
    }
    return "There were no completed blocks in the last 7 days, so your earlier work is not yet showing up as a repeatable pace.";
  }

  const perActiveDay = recentSolved / Math.max(activeDays, 1);
  if (recentSolved === 1) {
    return (
      "You completed 1 focused block while showing activity on " +
      activeDays +
      " of the last 7 days. That is a useful starting point, but it is not yet a stable completion pace—repeat it before increasing the volume."
    );
  }

  return (
    "You completed " +
    recentSolved +
    " focused blocks across " +
    activeDays +
    " active " +
    pluralize("day", activeDays) +
    " in the last 7 days, averaging " +
    formatPace(perActiveDay) +
    " per active day. " +
    (activeDays >= 4
      ? "That is consistent enough to use as your current baseline; protect the schedule before adding volume."
      : "Treat this as an early baseline and repeat it for another week before trying to move faster.")
  );
}

function continuityCopy(activeDays: number, currentStreak: number, longestStreak: number): string {
  if (currentStreak > 0) {
    return (
      "You practiced on " +
      activeDays +
      " of the last 7 days and are on a " +
      currentStreak +
      "-day streak. " +
      (currentStreak >= 3
        ? "The return pattern is becoming credible; keep the next session close to the same size."
        : "The next useful signal is another active day, not a longer session.")
    );
  }
  if (longestStreak > 0) {
    return (
      "You practiced on " +
      activeDays +
      " of the last 7 days, but there is no active streak. Your best run so far is " +
      longestStreak +
      " " +
      pluralize("day", longestStreak) +
      "; restart with a similar-sized block instead of trying to catch up."
    );
  }
  if (activeDays > 0) {
    return (
      "You practiced on " +
      activeDays +
      " of the last 7 days. One more return will tell me more about your consistency than one ambitious session."
    );
  }
  return "There is no recent continuity to measure yet. The next completed session is a restart, not a catch-up task.";
}

function nextMoveCopy(activeDays: number, currentStreak: number, target: number): string {
  if (activeDays <= 1) {
    return "Complete one focused block on your next planned day, then stop. Repeat that rhythm until you have 3 active days before increasing the target.";
  }
  if (currentStreak >= 3) {
    return (
      "Keep the next session at " +
      target +
      " focused " +
      pluralize("completion", target) +
      ". Your priority is protecting the return pattern, not doing extra work."
    );
  }
  if (currentStreak > 0) {
    return "Return for one focused block while the streak is active. Keep it short enough that another session tomorrow still feels realistic.";
  }
  return (
    "Restart with " +
    target +
    " focused " +
    pluralize("completion", target) +
    ", then schedule the next return before adding more volume."
  );
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
