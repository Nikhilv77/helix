"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CircleDot, Target, Timer, Volume2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DocumentTitle } from "@/components/document-title";
import { ReportMayaAvatar } from "@/components/workspace/reports/report-maya-avatar";
import type { ProgressDay, ProgressOverview, ProgressPattern } from "@/lib/roadmap/progress";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";

const FIRST_PHASE_DELAY = 420;
const SECOND_PHASE_DELAY = 620;

type ProgressBriefing = {
  hasProgress: boolean;
  introHeading: string;
  introText: string;
  paceHeading: string;
  paceText: string;
  primaryCta: string;
  primaryHref: string;
  topicLabel: string;
  completedQuestions: number;
  totalQuestions: number;
  openedNotFinished: number;
  dailyPace: number;
  recommendedDailyTarget: number;
  estimatedWeeks: number | null;
  recentDays: ProgressDay[];
  activeDaysThisWeek: number;
};

/**
 * Progress now answers one question: are the reps actually moving?
 *
 * This intentionally avoids the old dashboard stack. Maya reads the user's
 * current pace first, then the page swaps into the practical training advice:
 * how fast they are moving, what pace is healthy, and how long the remaining
 * roadmap will take at the current speed.
 */
export function ProgressView({
  overview,
  firstName
}: {
  overview: ProgressOverview;
  firstName: string;
}) {
  const briefing = useMemo(() => buildProgressBriefing(overview, firstName), [firstName, overview]);
  const [phase, setPhase] = useState<0 | 1>(0);
  const [spokenPhase, setSpokenPhase] = useState<0 | 1 | null>(null);
  const [introVoiceStarted, setIntroVoiceStarted] = useState(false);
  const [introVoiceFinished, setIntroVoiceFinished] = useState(false);
  const unlockInFlight = useRef(false);
  const { state, speak, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";

  const startSpokenPhase = useCallback(
    (targetPhase: 0 | 1) => {
      if (spokenPhase === targetPhase) return;

      const line = targetPhase === 0 ? briefing.introText : briefing.paceText;
      void speak(line).then((result) => {
        if (result === "started") {
          setSpokenPhase(targetPhase);
          if (targetPhase === 0) {
            setIntroVoiceStarted(true);
            setIntroVoiceFinished(false);
          }
          return;
        }

        if (result === "unavailable") {
          setSpokenPhase(targetPhase);
          if (targetPhase === 0) setIntroVoiceFinished(true);
          return;
        }

        if (result === "blocked" && targetPhase === 0) {
          setIntroVoiceFinished(true);
        }
      });
    },
    [briefing.introText, briefing.paceText, speak, spokenPhase]
  );

  useEffect(() => {
    if (awaitingGesture || spokenPhase === phase) return;
    const timer = window.setTimeout(
      () => startSpokenPhase(phase),
      phase === 0 ? FIRST_PHASE_DELAY : SECOND_PHASE_DELAY
    );

    return () => window.clearTimeout(timer);
  }, [awaitingGesture, phase, spokenPhase, startSpokenPhase]);

  useEffect(() => {
    if (phase !== 0 || !introVoiceStarted || state !== "idle") return;
    setIntroVoiceFinished(true);
  }, [introVoiceStarted, phase, state]);

  useEffect(() => {
    if (!briefing.hasProgress || !introVoiceFinished || phase !== 0) return;
    const timer = window.setTimeout(() => setPhase(1), 540);
    return () => window.clearTimeout(timer);
  }, [briefing.hasProgress, introVoiceFinished, phase]);

  useEffect(() => {
    if (!awaitingGesture) return;

    const unlock = () => {
      if (unlockInFlight.current) return;
      unlockInFlight.current = true;
      setAwaitingGesture(false);
      if (spokenPhase !== phase) startSpokenPhase(phase);
      window.setTimeout(() => {
        unlockInFlight.current = false;
      }, 250);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, phase, setAwaitingGesture, spokenPhase, startSpokenPhase]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[95rem] flex-col px-5 pb-12 pt-4 text-cream sm:px-8 lg:px-10 lg:pt-6">
      <DocumentTitle title="Progress" />

      <section className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center overflow-hidden rounded-[1.75rem] bg-[#3557b4] px-4 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1fr)] lg:gap-8 lg:px-10">
        <ProgressBackdrop />

        <div className="relative z-10 mx-auto w-full max-w-[34rem] lg:mx-0">
          <ReportMayaAvatar delay={120} speaking={speaking} />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col justify-center text-center lg:mx-0 lg:text-left">
          {awaitingGesture ? <VoiceUnlockNudge /> : null}

          {phase === 0 ? (
            <section key="progress-intro" className="identity-stage-in">
              <SpokenBriefing
                heading=""
                text={briefing.introText}
                active
                delay={180}
              />
              <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row lg:mx-0">
                <Link
                  href={briefing.primaryHref}
                  className="group inline-flex min-h-[3.4rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-7 py-4 text-[15px] font-semibold text-[#171a16] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {briefing.primaryCta}
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </section>
          ) : (
            <section key="progress-pace" className="identity-stage-in">
              <SpokenBriefing heading="" text={briefing.paceText} active delay={120} />

              <ProgressInsightRail briefing={briefing} />

              <DailyRhythmTrace
                days={briefing.recentDays}
                recommended={briefing.recommendedDailyTarget}
              />

              <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row lg:mx-0">
                <Link
                  href={briefing.primaryHref}
                  className="group inline-flex min-h-[3.4rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-7 py-4 text-[15px] font-semibold text-[#171a16] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {briefing.primaryCta}
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function buildProgressBriefing(overview: ProgressOverview, firstName: string): ProgressBriefing {
  const { totals, activity, nextUp } = overview;
  const name = firstName?.trim() || "there";
  const completedQuestions = totals.completedQuestions;
  const totalQuestions = totals.totalQuestions;
  const remainingQuestions = Math.max(0, totalQuestions - completedQuestions);
  const openedNotFinished = Math.max(0, totals.attemptedQuestions - completedQuestions);
  const recentDays = activity.slice(-7);
  const recentSolved = recentDays.reduce((total, day) => total + day.solved, 0);
  const activeDaysThisWeek = recentDays.filter((day) => day.solved > 0 || day.attempts > 0).length;
  const dailyPace =
    recentSolved > 0
      ? recentSolved / 7
      : overview.streak.activeDays > 0
        ? completedQuestions / overview.streak.activeDays
        : 0;
  const recommendedDailyTarget = recommendedDailyQuestions(totalQuestions);
  const estimatedWeeks =
    dailyPace > 0 && remainingQuestions > 0
      ? Math.ceil(remainingQuestions / dailyPace / 7)
      : null;
  const topPattern = strongestCompletedPattern(overview.patterns);
  const topicLabel = topPattern?.label ?? nextUp?.chapterTitle ?? overview.roadmapTitle ?? "your roadmap";
  const hasProgress =
    completedQuestions > 0 || openedNotFinished > 0 || totals.totalAttempts > 0 || recentSolved > 0;
  const primaryHref = nextUp?.href ?? "/practice";
  const primaryCta = completedQuestions > 0 ? "Continue the next question" : "Start one question";

  if (!hasProgress) {
    return {
      hasProgress,
      introHeading: "Progress needs one real signal.",
      introText: `Good, ${name}. This page is waiting for its first real signal. Open one question, finish it properly, and Maya can start reading your pace instead of guessing from an empty trail.`,
      paceHeading: "",
      paceText: "",
      primaryCta,
      primaryHref,
      topicLabel,
      completedQuestions,
      totalQuestions,
      openedNotFinished,
      dailyPace,
      recommendedDailyTarget,
      estimatedWeeks,
      recentDays,
      activeDaysThisWeek
    };
  }

  const doneLine =
    completedQuestions > 0
      ? `${completedQuestions} of ${totalQuestions} questions are finished, mostly around ${topicLabel}.`
      : `${openedNotFinished} ${openedNotFinished === 1 ? "question is" : "questions are"} opened, but not finished yet.`;
  const unfinishedLine =
    openedNotFinished > 0
      ? `${openedNotFinished} ${openedNotFinished === 1 ? "open question is" : "open questions are"} waiting to be closed.`
      : "No open questions are blocking the trail.";
  const paceLine =
    dailyPace > 0
      ? `Your current speed is about ${formatPace(dailyPace)} solved per day.`
      : "Your daily speed is not stable yet.";
  const timeLine =
    estimatedWeeks && remainingQuestions > 0
      ? `At that speed, the remaining roadmap takes roughly ${estimatedWeeks} ${estimatedWeeks === 1 ? "week" : "weeks"} to learn properly.`
      : `At ${recommendedDailyTarget} good ${recommendedDailyTarget === 1 ? "question" : "questions"} a day, this becomes measurable very quickly.`;

  return {
    hasProgress,
    introHeading: "Your practice trail is moving.",
    introText: `Good, ${name}. You have started the trail, and that matters. ${doneLine} ${unfinishedLine} Keep it simple now: close the open work, protect the rhythm, and Maya will turn these reps into a clearer progress read.`,
    paceHeading: "",
    paceText: `${paceLine} Aim for ${recommendedDailyTarget} good ${recommendedDailyTarget === 1 ? "question" : "questions"} a day, done properly. ${timeLine} You were active ${activeDaysThisWeek} of the last 7 days.`,
    primaryCta,
    primaryHref,
    topicLabel,
    completedQuestions,
    totalQuestions,
    openedNotFinished,
    dailyPace,
    recommendedDailyTarget,
    estimatedWeeks,
    recentDays,
    activeDaysThisWeek
  };
}

function strongestCompletedPattern(patterns: ProgressPattern[]): ProgressPattern | null {
  return (
    patterns
      .filter((pattern) => pattern.completed > 0)
      .slice()
      .sort((left, right) => right.completed - left.completed || right.percent - left.percent)[0] ??
    null
  );
}

function recommendedDailyQuestions(totalQuestions: number): number {
  if (totalQuestions >= 100) return 3;
  if (totalQuestions >= 50) return 2;
  return 1;
}

function formatPace(value: number): string {
  if (value >= 10) return String(Math.round(value));
  if (value >= 1) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(1);
}

function useWordReveal(text: string, active: boolean, delay = 0, stagger = 58) {
  const words = useMemo(() => text.split(" "), [text]);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!active) return;

    let interval = 0;
    const timer = window.setTimeout(() => {
      let index = 0;
      interval = window.setInterval(() => {
        index += 1;
        setVisibleCount(Math.min(index, words.length));
        if (index >= words.length) window.clearInterval(interval);
      }, stagger);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
    };
  }, [active, delay, stagger, words.length]);

  return { words, visibleCount };
}

function SpokenBriefing({
  heading,
  text,
  active,
  delay
}: {
  heading: string;
  text: string;
  active: boolean;
  delay: number;
}) {
  const { words, visibleCount } = useWordReveal(text, active, delay, 62);

  return (
    <div className="mx-auto max-w-3xl lg:mx-0">
      {heading ? (
        <h1 className="font-display text-[clamp(1.9rem,3.2vw,3.15rem)] font-semibold leading-[1.04] tracking-tight text-cream">
          {heading}
        </h1>
      ) : null}
      <p
        className={[
          "min-h-[6.5rem] text-base leading-7 text-cream/64 sm:text-lg sm:leading-8",
          heading ? "mt-5" : "mt-0"
        ].join(" ")}
      >
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            className={[
              "trail-word mr-[0.24em] last:mr-0",
              index < visibleCount ? "trail-word-visible" : ""
            ].join(" ")}
          >
            {word}
          </span>
        ))}
      </p>
    </div>
  );
}

function ProgressInsightRail({ briefing }: { briefing: ProgressBriefing }) {
  const paceText =
    briefing.dailyPace > 0
      ? `${formatPace(briefing.dailyPace)} solved per day right now.`
      : "Your pace is still forming.";
  const timeText = briefing.estimatedWeeks
    ? `At this speed, the remaining roadmap is about ${briefing.estimatedWeeks} ${briefing.estimatedWeeks === 1 ? "week" : "weeks"}.`
    : "Finish one question and Maya can estimate the road ahead.";

  return (
    <div className="mx-auto mt-7 w-full max-w-3xl text-left lg:mx-0">
      <div className="relative space-y-4 pl-8 before:absolute before:left-[0.43rem] before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-cream/18">
        <ProgressInsight
          icon={Check}
          text={`${briefing.completedQuestions}/${briefing.totalQuestions} ${briefing.topicLabel} questions are complete.`}
          delay={180}
        />
        <ProgressInsight
          icon={CircleDot}
          text={
            briefing.openedNotFinished > 0
              ? `${briefing.openedNotFinished} ${briefing.openedNotFinished === 1 ? "question is" : "questions are"} opened but still waiting for a clean finish.`
              : "Nothing is half-open right now."
          }
          delay={280}
        />
        <ProgressInsight icon={CalendarDays} text={paceText} delay={380} />
        <ProgressInsight icon={Timer} text={timeText} delay={480} />
        <ProgressInsight
          icon={Target}
          text={`${briefing.recommendedDailyTarget} good ${briefing.recommendedDailyTarget === 1 ? "question" : "questions"} a day is the right training pace for this roadmap.`}
          delay={580}
        />
      </div>
    </div>
  );
}

function ProgressInsight({
  icon: Icon,
  text,
  delay
}: {
  icon: LucideIcon;
  text: string;
  delay: number;
}) {
  return (
    <div
      className="report-action-panel relative"
      style={{ "--report-delay": `${delay}ms` } as CSSProperties}
    >
      <span className="absolute -left-8 top-1 grid h-4 w-4 place-items-center text-cream">
        <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
      </span>
      <p className="text-[1.03rem] leading-7 text-cream/76 sm:text-[1.16rem]">
        {text}
      </p>
    </div>
  );
}

function DailyRhythmTrace({
  days,
  recommended
}: {
  days: ProgressDay[];
  recommended: number;
}) {
  const activeDays = days.filter((day) => day.solved > 0 || day.attempts > 0).length;
  const solved = days.reduce((total, day) => total + day.solved, 0);
  const hasAnyDay = activeDays > 0;

  return (
    <div
      className="report-action-panel mx-auto mt-6 w-full max-w-3xl border-t border-cream/20 pt-4 text-left lg:mx-0"
      style={{ "--report-delay": "700ms" } as CSSProperties}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-cream/58 sm:text-[15px]">
          {hasAnyDay
            ? `${activeDays} of the last 7 days had practice activity, with ${solved} ${solved === 1 ? "question" : "questions"} finished.`
            : "No finished question has landed in the last 7 days yet."}
        </p>
        <p className="shrink-0 text-sm font-semibold text-cream/78">
          Aim for {recommended}/day
        </p>
      </div>
    </div>
  );
}

function VoiceUnlockNudge() {
  return (
    <div className="mb-4 inline-flex w-fit items-center gap-2 self-center rounded-full border border-cream/20 bg-cream/[0.05] px-3 py-1.5 text-[12.5px] font-semibold text-cream/64 lg:self-start">
      <Volume2 size={14} aria-hidden="true" />
      Tap to hear Maya
    </div>
  );
}

function ProgressBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden overflow-hidden text-cream sm:block"
    >
      <svg
        className="absolute left-8 top-20 h-36 w-56 opacity-[0.075]"
        viewBox="0 0 230 150"
        fill="none"
      >
        <rect x="18" y="24" width="160" height="68" rx="14" stroke="currentColor" />
        <circle cx="42" cy="48" r="5" fill="currentColor" fillOpacity="0.42" />
        <path d="M61 45h78M61 64h104" stroke="currentColor" strokeLinecap="round" />
        <path d="M28 116h178" stroke="currentColor" strokeLinecap="round" strokeDasharray="7 12" />
      </svg>
      <svg
        className="absolute right-12 top-28 h-40 w-64 opacity-[0.085]"
        viewBox="0 0 280 180"
        fill="none"
      >
        <path d="M18 92h24m196 0h24" stroke="currentColor" />
        {Array.from({ length: 12 }, (_, item) => (
          <line
            key={item}
            x1={52 + item * 15}
            x2={52 + item * 15}
            y1={92 - ((item % 5) + 2) * 7}
            y2={92 + ((item % 5) + 2) * 7}
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.4"
          />
        ))}
        <circle cx="140" cy="92" r="74" stroke="currentColor" />
      </svg>
      <svg
        className="absolute bottom-10 right-[13%] h-24 w-52 opacity-[0.055]"
        viewBox="0 0 210 110"
        fill="none"
      >
        <path d="M28 34h154M28 56h112M28 78h132" stroke="currentColor" />
        <path d="M16 20h178v76H16z" stroke="currentColor" />
        <path d="M54 20v76M118 20v76" stroke="currentColor" strokeOpacity="0.55" />
      </svg>
    </div>
  );
}
