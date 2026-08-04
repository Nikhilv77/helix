"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Map, Mic, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useMayaVoice, voiceUrl, type VoiceState } from "@/lib/use-maya-voice";
import type { CandidateProfile, Role } from "@/lib/types";

const AvatarStage = dynamic(
  () => import("@/components/interview/avatar-stage").then((module) => module.AvatarStage),
  { ssr: false }
);

interface MayaWelcomeProps {
  profile: CandidateProfile;
  practiceHref: string;
}

export function MayaWelcome({ profile, practiceHref }: MayaWelcomeProps) {
  const router = useRouter();
  // Maya introduces herself out loud by default; muting her turns this off for
  // the rest of the walkthrough.
  const voiceEnabled = useRef(true);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const userControlledScroll = useRef(false);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
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
  const topEvidence = resume?.experience[0]
    ? `${resume.experience[0].role || "your work"} at ${resume.experience[0].organization}`
    : resume?.projects[0]?.name || profile.headline || "your resume evidence";
  const firstRoadmapStep = resume?.roadmap[0]?.title || profile.focusAreas[0] || "Build a baseline";

  const slides = useMemo(
    () => [
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
      resume?.practiceQuestions.length,
      resume?.skills.length,
      role,
      topEvidence
    ]
  );

  const current = slides[step] ?? slides[0];

  const dismiss = useCallback(
    (destination = "/") => {
      stopVoice();
      setVisible(false);
      router.replace(destination);
    },
    [router, stopVoice]
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
      className="fixed inset-0 z-[90] grid place-items-center bg-[#07123a]/58 p-3 backdrop-blur-2xl sm:p-6"
    >
      {/* Rows on small screens: the avatar takes a capped share and the copy
          scrolls, so a short phone never clips the slide or its buttons. */}
      <section className="route-enter relative grid h-[min(48rem,calc(100svh-1.5rem))] w-full max-w-6xl grid-rows-[minmax(17.5rem,36svh)_minmax(0,1fr)] overflow-hidden rounded-[2rem] bg-[radial-gradient(40rem_24rem_at_80%_8%,rgba(156,199,255,0.28),transparent_72%),linear-gradient(135deg,rgba(72,104,188,0.96),rgba(31,62,151,0.96)_45%,rgba(20,43,114,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_0_0_1px_rgba(255,255,255,0.06),0_44px_130px_rgba(4,12,42,0.72)] backdrop-blur-2xl sm:grid-rows-[minmax(19rem,38svh)_minmax(0,1fr)] md:h-[min(45rem,calc(100svh-1.5rem))] md:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] md:grid-rows-1">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cream/42 to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#9fc4ff]/22 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(220,230,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(220,230,255,0.7) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(100% 100% at 100% 100%, #000 18%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(100% 100% at 100% 100%, #000 18%, transparent 72%)"
          }}
        />
        <button
          type="button"
          onClick={() => dismiss()}
          aria-label="Close Maya introduction"
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.075] text-cream/60 shadow-soft-inset transition hover:bg-white/[0.13] hover:text-cream sm:right-5 sm:top-5"
        >
          <X size={16} />
        </button>

        <div className="relative min-h-0 overflow-hidden bg-[radial-gradient(24rem_22rem_at_50%_30%,rgba(154,184,255,0.22),transparent_70%),linear-gradient(180deg,rgba(36,72,158,0.92),rgba(16,38,100,0.94))] shadow-[inset_-1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.08)]">
          {/* Stacked layouts put the close button over this row, so the status
              keeps clear of it until the two-column layout separates them. */}
          <div className="absolute inset-x-4 top-4 z-10 flex items-center justify-between pr-11 sm:inset-x-5 sm:top-5 md:pr-0">
            <div className="flex items-center gap-2 text-cream">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.08] text-cream shadow-soft-inset">
                <Sparkles size={14} />
              </span>
              <div>
                <p className="text-sm font-semibold">Maya</p>
                <p className="hidden font-mono text-[9px] uppercase tracking-[0.15em] text-cream/38 sm:block">
                  Your interview coach
                </p>
              </div>
            </div>
            <span className="flex items-center gap-2 text-[10px] text-[#9be8c1]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#71d6a5]" /> Ready
            </span>
          </div>
          <AvatarStage
            agentTrack={null}
            state={speaking ? "speaking" : "listening"}
            url="/avatars/interviewer.glb"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#163988] to-transparent" />
        </div>

        <div className="relative flex min-h-0 flex-col px-5 pb-5 pt-4 sm:px-10 sm:pb-8 sm:pt-7 lg:px-14 lg:pb-9 lg:pt-10">
          <div className="flex shrink-0 items-center gap-2 pr-12">
            {slides.map((slide, index) => (
              <span
                key={slide.eyebrow}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  index === step ? "w-11 bg-cream" : "w-5 bg-white/[0.18]"
                ].join(" ")}
              />
            ))}
            <span className="ml-auto font-mono text-[10px] tracking-[0.14em] text-cream/42">
              0{step + 1} / 0{slides.length}
            </span>
          </div>

          <div
            ref={contentScrollRef}
            onTouchStart={() => {
              userControlledScroll.current = true;
            }}
            onWheel={() => {
              userControlledScroll.current = true;
            }}
            className="thin-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1"
          >
            <div
              key={step}
              className="step-in flex min-h-full flex-col justify-center py-4 sm:py-8 lg:py-12"
            >
              <span className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.075] text-cream shadow-soft-inset min-[360px]:flex sm:h-12 sm:w-12">
                <Icon size={19} />
              </span>
              <p className="blueprint-label text-cream/38 min-[360px]:mt-4 sm:mt-5 lg:mt-7">
                {current.eyebrow}
              </p>
              <h1
                id="maya-welcome-title"
                className="mt-2 max-w-2xl text-[2rem] font-semibold leading-[1.06] tracking-tight text-cream sm:mt-3 sm:text-4xl"
              >
                {current.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/62 sm:mt-4 sm:text-base sm:leading-7">
                {current.body}
              </p>

              {step === 1 && resume?.roadmap.length ? (
                <div className="mt-5 grid gap-2 sm:mt-7 sm:grid-cols-3">
                  {resume.roadmap.slice(0, 3).map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-white/[0.06] p-4 shadow-soft-inset"
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

          <div className="flex shrink-0 flex-col-reverse gap-3 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.09)] sm:flex-row sm:items-center sm:pt-5">
            <button
              type="button"
              onClick={toggleVoice}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-4 text-xs font-semibold text-cream/72 shadow-soft-inset transition hover:bg-white/[0.12] hover:text-cream disabled:cursor-not-allowed disabled:opacity-45"
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
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-cream px-5 text-sm font-semibold text-[#173178] shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] transition hover:bg-white sm:w-auto"
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => dismiss("/#plan")}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-5 text-sm font-semibold text-cream/85 shadow-soft-inset transition hover:bg-white/[0.12] hover:text-cream"
                  >
                    View my plan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopVoice();
                      setVisible(false);
                      router.replace(practiceHref);
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-cream px-5 text-sm font-semibold text-[#173178] shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)] transition hover:bg-white"
                  >
                    Start a mock <ArrowRight size={15} />
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
