"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Blocks,
  BrainCircuit,
  Braces,
  Check,
  Code2,
  Database,
  FileText,
  Gauge,
  Loader2,
  Map,
  Mic,
  ShieldCheck,
  Target,
  Volume2,
  VolumeX,
  X,
  type LucideIcon
} from "lucide-react";
import { useMayaVoice, voiceUrl, type VoiceState } from "@/lib/use-maya-voice";
import { FRONTEND_SESSIONS, type FrontendDsaPlan } from "@/lib/frontend-plan";
import type { FrontendRoadmapHome } from "@/lib/roadmap";
import type { CandidateProfile, Role } from "@/lib/types";

const AvatarStage = dynamic(
  () => import("@/components/interview/avatar-stage").then((module) => module.AvatarStage),
  { ssr: false }
);

const WELCOME_TITLE_STAGGER_MS = 92;
const WELCOME_BODY_STAGGER_MS = 26;
const FALLBACK_WELCOME_SLIDE = {
  eyebrow: "Roadmap ready",
  title: "Hi, I’m Maya.",
  body: "I prepared your interview roadmap and I am ready to walk you through the first step.",
  icon: Check
};
const SESSION_CARD_META: Record<string, { label: string; detail: string }> = {
  "frontend-dsa": {
    label: "Pattern practice",
    detail: "Warmups, traps, and solve rhythm."
  },
  "javascript-react-core": {
    label: "Core depth",
    detail: "JS behaviour, React timing, and rendering."
  },
  "build-real-ui-features": {
    label: "Product build",
    detail: "Real feature rounds with tradeoff pressure."
  },
  "production-ui-quality": {
    label: "Ship quality",
    detail: "Performance, accessibility, and reliability."
  },
  "resume-behavioral-defense": {
    label: "Evidence defense",
    detail: "Turn resume claims into strong answers."
  },
  "final-frontend-mock": {
    label: "Full loop",
    detail: "A complete mock across the interview path."
  }
};

const SESSION_ICON_RULES: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ["dsa", "pattern", "algorithm", "data-structure"], icon: Braces },
  { keywords: ["javascript", "react", "frontend", "ui", "component", "render"], icon: Code2 },
  { keywords: ["build", "feature", "product", "project"], icon: Blocks },
  { keywords: ["quality", "performance", "reliability", "accessibility", "testing"], icon: Gauge },
  { keywords: ["resume", "behavioral", "story", "evidence"], icon: FileText },
  { keywords: ["mock", "final", "interview", "round"], icon: Target },
  { keywords: ["backend", "api", "database", "data"], icon: Database },
  { keywords: ["system", "architecture", "design"], icon: BrainCircuit },
  { keywords: ["security", "auth", "safe"], icon: ShieldCheck }
];

function sessionIcon(session: { id: string; title: string; purpose: string; covers: string[] }) {
  const haystack = [session.id, session.title, session.purpose, ...session.covers]
    .join(" ")
    .toLowerCase();
  return (
    SESSION_ICON_RULES.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)))
      ?.icon ?? Blocks
  );
}

function useWordReveal(
  text: string,
  active: boolean,
  delay = 0,
  stagger = WELCOME_TITLE_STAGGER_MS
) {
  const words = text.split(" ");
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

function WordRevealLine({
  words,
  visibleCount,
  className,
  wordClassName = ""
}: {
  words: string[];
  visibleCount: number;
  className?: string;
  wordClassName?: string;
}) {
  return (
    <span className={className}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={[
            "trail-word mr-[0.24em] last:mr-0",
            index < visibleCount ? "trail-word-visible" : "",
            wordClassName
          ].join(" ")}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

function TechInterviewMotifs({ side }: { side: "maya" | "copy" }) {
  return (
    <>
      {side === "maya" ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -left-24 top-16 z-0 h-72 w-72 rounded-full border border-cream/[0.09]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-8 top-14 z-0 h-24 w-56 rounded-full bg-cream/[0.025] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-6 top-14 z-0 h-16 w-40 rounded-xl border border-cream/[0.13] bg-cream/[0.018]"
          >
            <span className="absolute left-4 top-4 h-2.5 w-2.5 rounded-full bg-cream/[0.16]" />
            <span className="absolute left-9 top-4 h-px w-20 bg-cream/[0.14]" />
            <span className="absolute left-9 top-8 h-px w-24 bg-cream/[0.1]" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-5 top-24 z-0 h-20 w-36 rounded-xl border border-cream/[0.1] bg-cream/[0.014]"
          >
            <span className="absolute left-4 top-5 h-px w-24 bg-cream/[0.12]" />
            <span className="absolute left-4 top-9 h-px w-16 bg-cream/[0.09]" />
            <span className="absolute bottom-4 left-4 h-2 w-2 rounded-full bg-cream/[0.13]" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute left-10 top-[45%] z-0 h-px w-48 bg-[linear-gradient(90deg,rgba(241,234,216,0.08)_0_35%,transparent_35%_52%,rgba(241,234,216,0.08)_52%_72%,transparent_72%_100%)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-24 left-7 z-0 flex h-14 items-end gap-1.5 text-cream/[0.16]"
          >
            {[28, 54, 38, 72, 46, 60, 34].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="w-1 rounded-full bg-current"
                style={{ height: `${height}%` }}
              />
            ))}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-20 right-10 z-0 grid grid-cols-[auto_1.75rem_auto_1.75rem_auto] items-center text-cream/[0.11]"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
            <span className="h-px bg-current" />
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
            <span className="h-px bg-current" />
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
          </span>
          <span aria-hidden className="pointer-events-none absolute bottom-44 left-9 z-0 h-20 w-28">
            <span className="absolute left-0 top-0 h-6 w-6 border-l border-t border-cream/[0.1]" />
            <span className="absolute right-0 top-0 h-6 w-6 border-r border-t border-cream/[0.08]" />
            <span className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-cream/[0.08]" />
            <span className="absolute bottom-0 right-0 h-6 w-6 border-b border-r border-cream/[0.1]" />
          </span>
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-28 bottom-12 z-0 h-72 w-72 rounded-full border border-cream/[0.08]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-8 top-20 z-0 h-20 w-40 rounded-xl border border-cream/[0.1] bg-cream/[0.012]"
          >
            <span className="absolute left-4 top-4 h-2.5 w-2.5 rounded-full bg-cream/[0.13]" />
            <span className="absolute left-9 top-4 h-px w-20 bg-cream/[0.11]" />
            <span className="absolute left-4 top-9 h-px w-28 bg-cream/[0.08]" />
            <span className="absolute left-4 top-13 h-px w-16 bg-cream/[0.07]" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute right-8 top-[30%] z-0 h-28 w-28 rounded-full border border-cream/[0.12]"
          >
            <span className="absolute inset-5 flex items-center justify-center gap-1 text-cream/[0.14]">
              {[38, 64, 50, 82, 45, 72, 56].map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="w-1 rounded-full bg-current"
                  style={{ height: `${height}%` }}
                />
              ))}
            </span>
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-28 right-12 z-0 h-px w-56 bg-gradient-to-r from-transparent via-cream/[0.12] to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-36 left-8 z-0 flex gap-4 text-cream/[0.12]"
          >
            <span className="h-12 w-24 rounded-lg border border-current bg-cream/[0.01]" />
            <span className="h-12 w-16 rounded-lg border border-current bg-cream/[0.01]" />
            <span className="h-12 w-20 rounded-lg border border-current bg-cream/[0.01]" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-20 left-[44%] z-0 grid grid-cols-[auto_2rem_auto_2rem_auto] items-center text-cream/[0.1]"
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            <span className="h-px bg-current" />
            <span className="h-2 w-2 rounded-full bg-current" />
            <span className="h-px bg-current" />
            <span className="h-2 w-2 rounded-full bg-current" />
          </span>
          <span aria-hidden className="pointer-events-none absolute right-28 top-20 z-0 h-16 w-36">
            <span className="absolute left-0 top-0 h-5 w-5 border-l border-t border-cream/[0.09]" />
            <span className="absolute right-0 top-0 h-5 w-5 border-r border-t border-cream/[0.09]" />
            <span className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-cream/[0.07]" />
            <span className="absolute bottom-0 right-0 h-5 w-5 border-b border-r border-cream/[0.07]" />
          </span>
        </>
      )}
    </>
  );
}

interface MayaWelcomeProps {
  profile: CandidateProfile;
  practiceHref: string;
  frontendRoadmap?: FrontendRoadmapHome | null;
  frontendPlan?: FrontendDsaPlan | null;
}

export function MayaWelcome({
  profile,
  practiceHref,
  frontendRoadmap = null,
  frontendPlan = null
}: MayaWelcomeProps) {
  // Maya introduces herself out loud by default; muting her turns this off for
  // the rest of the walkthrough.
  const voiceEnabled = useRef(true);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const userControlledScroll = useRef(false);
  const [step, setStep] = useState(0);
  const visible = true;
  const {
    state: voiceState,
    speak: speakLine,
    stop: stopVoice,
    awaitingGesture,
    setAwaitingGesture
  } = useMayaVoice();
  const [mounted, setMounted] = useState(false);
  const speaking = voiceState === "speaking";
  const resume = profile.resume;
  const firstName = resume?.fullName.trim().split(/\s+/)[0] || "there";
  const role = profile.targetRole ? roleLabel(profile.targetRole) : "your target role";
  const hasRoadmapTrack = profile.targetRole === "fullstack";
  const topEvidence = resume?.experience[0]
    ? `${resume.experience[0].role || "your work"} at ${resume.experience[0].organization}`
    : resume?.projects[0]?.name || profile.headline || "your resume evidence";
  const firstRoadmapStep = resume?.roadmap[0]?.title || profile.focusAreas[0] || "Build a baseline";
  const frontendStats = {
    sessions: frontendRoadmap?.totalSessions ?? FRONTEND_SESSIONS.length,
    chapters: frontendRoadmap?.totalChapters ?? frontendPlan?.chapters.length ?? 12,
    questions: frontendRoadmap?.totalQuestions ?? frontendPlan?.totalQuestions ?? 123,
    hours: frontendRoadmap
      ? Math.round(frontendRoadmap.totalMinutes / 60)
      : frontendPlan
        ? Math.round(frontendPlan.totalMinutes / 60)
        : 49
  };

  const slides = useMemo(
    () =>
      hasRoadmapTrack
        ? [
            {
              eyebrow: "Roadmap ready",
              title: `Hi ${firstName}, I’m Maya.`,
              body: `I prepared your full-stack interview roadmap: ${frontendStats.sessions} focused sessions, starting with DSA and ending in a full mock. I used your target role and resume evidence so this feels like your path, not a generic checklist.`,
              icon: Check
            },
            {
              eyebrow: "Six-session path",
              title: "Here is the loop I built for you.",
              body: "We will move through DSA, JavaScript and React Core, real product feature builds, production quality, resume and behavioral defense, then the final full-stack mock. Each session is scoped so one step makes the next one sharper.",
              icon: Map
            },
            {
              eyebrow: "Start here",
              title: "Begin with DSA.",
              body: `The first session is ready with ${frontendStats.chapters} chapters, ${frontendStats.questions} questions, and about ${frontendStats.hours} hours of guided practice. I will warm you up pattern by pattern, then press on the signals full-stack interviewers actually look for.`,
              icon: Mic
            }
          ]
        : [
            {
              eyebrow: "Profile understood",
              title: `Hi ${firstName}, I’m Maya.`,
              body: `I reviewed your profile for ${role} interviews. I found ${topEvidence} and ${resume?.skills.length ?? 0} supported skills, so our practice can start from your real experience instead of generic prompts.`,
              icon: Check
            },
            {
              eyebrow: "Your preparation plan",
              title: "I prepared a roadmap for you.",
              body: `Your first focus is “${firstRoadmapStep}.” The roadmap connects your resume evidence to the areas interviewers are most likely to probe, and it will adapt as your reports reveal stronger or weaker signals.`,
              icon: Map
            },
            {
              eyebrow: "Ready when you are",
              title: "Practice, then pressure-test it live.",
              body: `I created ${resume?.practiceQuestions.length ?? 0} evidence-backed practice questions. Work through them at your pace, then start a mock interview with me when you want realistic follow-ups and a scored report.`,
              icon: Mic
            }
          ],
    [
      firstName,
      firstRoadmapStep,
      frontendStats.chapters,
      frontendStats.hours,
      frontendStats.questions,
      frontendStats.sessions,
      hasRoadmapTrack,
      resume?.practiceQuestions.length,
      resume?.skills.length,
      role,
      topEvidence
    ]
  );

  const current = slides[step] ?? slides[0] ?? FALLBACK_WELCOME_SLIDE;
  const titleReveal = useWordReveal(current.title, visible, 160);
  const bodyReveal = useWordReveal(current.body, visible, 640, WELCOME_BODY_STAGGER_MS);

  const dismiss = useCallback(
    (destination = "/") => {
      stopVoice();
      window.location.replace(destination);
    },
    [stopVoice]
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // The workspace scrolls the document, and locking <body> alone left the
    // page drifting behind the dialog, taking the app header with it.
    const root = document.documentElement;
    const previous = { root: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = previous.root;
      document.body.style.overflow = previous.body;
      stopVoice();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss, stopVoice]);

  // Narrates the opening slide on arrival, then every slide the candidate
  // advances to, until they mute her.
  useEffect(() => {
    if (!voiceEnabled.current || awaitingGesture || !current) return;

    // Unlocking and advancing arrive as two separate events (pointerdown then
    // click), so settle for a beat and speak only the slide that survives.
    const start = window.setTimeout(() => {
      void speakLine(`${current.title} ${current.body}`);
    }, 60);
    return () => window.clearTimeout(start);
  }, [awaitingGesture, current, speakLine]);

  // Warm the next slide's audio while this one plays: by the time Continue is
  // pressed the file is already in the browser cache.
  useEffect(() => {
    const next = slides[step + 1];
    if (!next) return;
    const warm = new Audio(voiceUrl(`${next.title} ${next.body}`));
    warm.preload = "auto";
    warm.load();
  }, [slides, step]);

  // Releasing the lock is all this does: the effect above then speaks whichever
  // slide is current, so a gesture that also advances the slide narrates the
  // new one rather than both.
  useEffect(() => {
    if (!awaitingGesture) return;

    const unlock = () => setAwaitingGesture(false);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture]);

  useEffect(() => {
    const node = contentScrollRef.current;
    if (!node) return;

    userControlledScroll.current = false;
    node.scrollTo({ top: 0 });

    const timer = window.setTimeout(() => {
      if (userControlledScroll.current) return;
      const hiddenContent = node.scrollHeight - node.clientHeight;
      if (hiddenContent <= 24) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollTo({
        top: hiddenContent,
        behavior: reducedMotion ? "auto" : "smooth"
      });
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [step]);

  function toggleVoice() {
    if (!current) return;
    if (voiceState === "speaking" || voiceState === "loading") {
      voiceEnabled.current = false;
      setAwaitingGesture(false);
      stopVoice();
      return;
    }
    voiceEnabled.current = true;
    void speakLine(`${current.title} ${current.body}`);
  }

  if (!visible || !mounted || !current) return null;
  const Icon = current.icon;

  // Rendered into <body>: the workspace wraps pages in `relative z-10`, which
  // traps any z-index inside it underneath the app header.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maya-welcome-title"
      className="onboarding-theme fixed inset-0 z-[90] grid place-items-center overflow-x-clip p-3 sm:p-6"
    >
      {/* Rows on small screens: the avatar takes a capped share and the copy
          scrolls, so a short phone never clips the slide or its buttons. */}
      <section className="route-enter relative grid min-w-0 h-[min(46rem,calc(100svh-1.5rem))] w-[min(100%,72rem)] max-w-full grid-rows-[minmax(12rem,30svh)_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-[#111214] shadow-[0_32px_90px_-54px_rgba(0,0,0,0.92)] sm:grid-rows-[minmax(16rem,34svh)_minmax(0,1fr)] md:h-[min(43rem,calc(100svh-2rem))] md:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)] md:grid-rows-1">
        <button
          type="button"
          onClick={() => dismiss()}
          aria-label="Close Maya introduction"
          className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center text-cream/55 transition hover:text-cream sm:right-5 sm:top-5"
        >
          <X size={26} strokeWidth={1.35} />
        </button>

        <div className="relative z-10 min-h-0 overflow-hidden bg-[#17181b]">
          <TechInterviewMotifs side="maya" />
          <AvatarStage
            agentTrack={null}
            state={speaking ? "speaking" : "listening"}
            url="/avatars/interviewer-v2.glb"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#17181b] to-transparent" />
        </div>

        <div className="relative z-10 flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden bg-[#111214] px-5 pb-5 pt-5 sm:px-10 sm:pb-8 sm:pt-8 lg:px-14 lg:pb-9 lg:pt-10">
          <TechInterviewMotifs side="copy" />
          <div className="relative z-10 flex shrink-0 items-center gap-2.5 pr-12">
            {slides.map((slide, index) => (
              <span
                key={slide.eyebrow}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  index === step
                    ? "w-12 bg-[#F26E01] shadow-[0_0_14px_rgba(242,110,1,0.18)]"
                    : "w-6 bg-cream/25"
                ].join(" ")}
              />
            ))}
          </div>

          <div
            ref={contentScrollRef}
            onTouchStart={() => {
              userControlledScroll.current = true;
            }}
            onWheel={() => {
              userControlledScroll.current = true;
            }}
            className="no-scrollbar relative z-10 -mx-1 min-h-0 min-w-0 max-w-full flex-1 overflow-x-clip overflow-y-auto px-1"
          >
            <div
              key={step}
              className="step-in flex min-h-full min-w-0 max-w-full flex-col justify-center py-4 sm:py-8 lg:py-12"
            >
              <Icon
                size={64}
                strokeWidth={1.25}
                className="hidden text-cream/82 min-[360px]:block sm:size-16"
                aria-hidden="true"
              />
              <p className="blueprint-label text-cream/45 min-[360px]:mt-4 sm:mt-5 lg:mt-7">
                {current.eyebrow}
              </p>
              <h1
                id="maya-welcome-title"
                className="display-heading mt-3 max-w-2xl text-[2.15rem] leading-[1.03] text-cream sm:mt-4 sm:text-[3rem]"
              >
                <WordRevealLine words={titleReveal.words} visibleCount={titleReveal.visibleCount} />
              </h1>
              <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-cream/78 sm:text-lg sm:leading-8">
                <WordRevealLine
                  words={bodyReveal.words}
                  visibleCount={bodyReveal.visibleCount}
                  wordClassName="maya-welcome-copy-word"
                />
              </p>

              {hasRoadmapTrack && step === 1 ? (
                <div className="mx-auto mt-5 grid min-w-0 max-w-full w-[calc(100%-0.75rem)] gap-2 sm:mt-7 sm:w-full sm:grid-cols-2">
                  {FRONTEND_SESSIONS.map((session, index) => {
                    const meta = SESSION_CARD_META[session.id] ?? {
                      label: "Guided practice",
                      detail: session.covers[0] ?? "Focused interview prep."
                    };
                    const SessionIcon = sessionIcon(session);
                    return (
                      <div
                        key={session.id}
                        className="onboarding-card-reveal flex min-w-0 max-w-full min-h-[5.4rem] items-start gap-3 overflow-hidden rounded-lg border border-white/[0.07] bg-[#191a1d] px-4 py-3.5 text-cream"
                        style={
                          {
                            "--card-delay": `${240 + index * 70}ms`
                          } as CSSProperties
                        }
                      >
                        <SessionIcon
                          size={25}
                          strokeWidth={1.55}
                          className="mt-0.5 shrink-0 text-[#F26E01]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[1.05rem] font-medium leading-5 text-cream">
                            {session.title}
                          </p>
                          <p className="mt-2 line-clamp-2 text-[0.92rem] font-normal leading-5 text-cream/55">
                            {meta.label}. {meta.detail}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {!hasRoadmapTrack && step === 1 && resume?.roadmap.length ? (
                <div className="mt-5 grid gap-2 sm:mt-7 sm:grid-cols-3">
                  {resume.roadmap.slice(0, 3).map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-cream/18 bg-cream/[0.035] p-4 shadow-soft-inset"
                    >
                      <span className="font-mono text-[10px] text-cream/38">0{index + 1}</span>
                      <p className="mt-2 text-sm font-semibold leading-5 text-cream/78">
                        {item.title}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 flex-col-reverse gap-3 border-t border-cream/[0.1] pt-4 sm:flex-row sm:items-center sm:pt-5">
            <button
              type="button"
              onClick={toggleVoice}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cream/12 bg-cream/[0.04] px-4 text-[0.95rem] font-medium text-cream/72 shadow-soft-inset transition hover:bg-cream/[0.08] hover:text-cream disabled:cursor-not-allowed disabled:opacity-45"
            >
              {voiceState === "loading" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : speaking ? (
                <VolumeX size={15} />
              ) : (
                <Volume2 size={15} />
              )}
              {voiceLabel(voiceState)}
            </button>
            <div className="sm:ml-auto">
              {step < slides.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((currentStep) => currentStep + 1)}
                  className="browse-nudge inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#f5f3ef] px-5 text-sm font-semibold text-[#17181b] shadow-[0_18px_44px_-26px_rgba(245,243,239,0.22)] transition hover:bg-white sm:w-auto"
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => dismiss("/#plan")}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cream/12 bg-cream/[0.04] px-5 text-sm font-semibold text-cream/85 shadow-soft-inset transition hover:bg-cream/[0.08] hover:text-cream"
                  >
                    View my plan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopVoice();
                      window.location.replace(hasRoadmapTrack ? "/" : practiceHref);
                    }}
                    className="browse-nudge inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#f5f3ef] px-5 text-sm font-semibold text-[#17181b] shadow-[0_18px_44px_-26px_rgba(245,243,239,0.22)] transition hover:bg-white"
                  >
                    {hasRoadmapTrack ? "Start DSA" : "Start a mock"} <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function voiceLabel(state: VoiceState): string {
  return {
    idle: "Hear Maya",
    loading: "Loading voice",
    speaking: "Stop voice",
    // A failed line is usually a blip, so the control stays live to retry.
    unavailable: "Retry voice"
  }[state];
}

function roleLabel(role: Role): string {
  return {
    backend: "backend",
    frontend: "frontend",
    fullstack: "full-stack",
    data: "data",
    "ai-ml": "AI / ML",
    pm: "product"
  }[role];
}
