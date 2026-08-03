"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Map, Mic, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import type { CandidateProfile, Role } from "@/lib/types";

const AvatarStage = dynamic(
  () => import("@/components/interview/avatar-stage").then((module) => module.AvatarStage),
  { ssr: false }
);

interface MayaWelcomeProps {
  profile: CandidateProfile;
  practiceHref: string;
}

type VoiceState = "idle" | "loading" | "speaking" | "unavailable";

export function MayaWelcome({ profile, practiceHref }: MayaWelcomeProps) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  // Maya introduces herself out loud by default; muting her turns this off for
  // the rest of the walkthrough.
  const voiceEnabled = useRef(true);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [voiceState, setVoiceState] = useState<VoiceState>("loading");
  const [awaitingGesture, setAwaitingGesture] = useState(false);
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

  const stopVoice = useCallback(() => {
    const element = audio.current;
    if (element) {
      // Detach first: revoking the object URL below makes the element error,
      // which would otherwise report a working voice as broken.
      element.onended = null;
      element.onerror = null;
      element.pause();
      element.removeAttribute("src");
    }
    audio.current = null;
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  }, []);

  /** Maya's real voice: the same Deepgram model that speaks in the interview room. */
  const speakLine = useCallback(
    async (line: string) => {
      stopVoice();
      setVoiceState("loading");

      try {
        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: line }),
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`voice request failed: ${response.status}`);

        const url = URL.createObjectURL(await response.blob());
        objectUrl.current = url;
        const element = new Audio(url);
        audio.current = element;
        element.onended = () => setVoiceState("idle");
        element.onerror = () => setVoiceState("unavailable");
        await element.play();
        setVoiceState("speaking");
      } catch (error) {
        stopVoice();
        // Landing here without a click of your own (a reload, or a browser that
        // does not carry activation across the redirect) means autoplay was
        // refused, not that the voice is broken. Wait for any gesture instead.
        if (isAutoplayBlocked(error)) {
          setVoiceState("idle");
          setAwaitingGesture(true);
          return;
        }
        setVoiceState("unavailable");
      }
    },
    [stopVoice]
  );

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

  function toggleVoice() {
    if (!current) return;
    if (voiceState === "speaking" || voiceState === "loading") {
      voiceEnabled.current = false;
      setAwaitingGesture(false);
      stopVoice();
      setVoiceState("idle");
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
      className="fixed inset-0 z-[90] grid place-items-center bg-[#07123a]/80 p-3 backdrop-blur-md sm:p-6"
    >
      {/* Rows on small screens: the avatar takes a capped share and the copy
          scrolls, so a short phone never clips the slide or its buttons. */}
      <section className="relative grid h-[min(45rem,calc(100svh-1.5rem))] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-cream/20 bg-[#173178] shadow-[0_36px_120px_rgba(4,12,42,0.72)] md:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] md:grid-rows-1">
        <button
          type="button"
          onClick={() => dismiss()}
          aria-label="Close Maya introduction"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-cream/18 bg-[#102764]/70 text-cream/60 transition hover:bg-cream/10 hover:text-cream sm:right-4 sm:top-4"
        >
          <X size={16} />
        </button>

        <div className="relative h-[clamp(8rem,26svh,15rem)] overflow-hidden border-b border-cream/12 bg-[#102764] md:h-auto md:border-b-0 md:border-r">
          {/* Stacked layouts put the close button over this row, so the status
              keeps clear of it until the two-column layout separates them. */}
          <div className="absolute inset-x-4 top-4 z-10 flex items-center justify-between pr-11 sm:inset-x-5 sm:top-5 md:pr-0">
            <div className="flex items-center gap-2 text-cream">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cream/20 bg-cream/[0.06]">
                <Sparkles size={14} />
              </span>
              <div>
                <p className="text-sm font-semibold">Maya</p>
                <p className="hidden font-mono text-[9px] uppercase tracking-[0.15em] text-cream/38 min-[360px]:block">
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#102764] to-transparent" />
        </div>

        <div className="flex min-h-0 flex-col px-5 pb-5 pt-5 sm:px-10 sm:pb-9 sm:pt-10 lg:px-14">
          <div className="flex shrink-0 items-center gap-2 pr-12">
            {slides.map((slide, index) => (
              <span
                key={slide.eyebrow}
                className={[
                  "h-1 rounded-full transition-all duration-300",
                  index === step ? "w-10 bg-cream" : "w-5 bg-cream/20"
                ].join(" ")}
              />
            ))}
            <span className="ml-auto font-mono text-[9px] tracking-[0.14em] text-cream/35">
              0{step + 1} / 0{slides.length}
            </span>
          </div>

          <div className="thin-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <div
              key={step}
              className="step-in flex min-h-full flex-col justify-center py-6 sm:py-12"
            >
              <span className="hidden h-10 w-10 items-center justify-center rounded-lg border border-cream/18 bg-cream/[0.06] text-cream min-[360px]:flex sm:h-11 sm:w-11">
                <Icon size={19} />
              </span>
              <p className="blueprint-label text-cream/38 min-[360px]:mt-5 sm:mt-7">
                {current.eyebrow}
              </p>
              <h1
                id="maya-welcome-title"
                className="mt-2.5 max-w-2xl text-2xl font-semibold leading-tight text-cream sm:mt-3 sm:text-4xl"
              >
                {current.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-cream/56 sm:mt-5 sm:leading-7 sm:text-base">
                {current.body}
              </p>

              {step === 1 && resume?.roadmap.length ? (
                <div className="mt-5 grid gap-2 sm:mt-7 sm:grid-cols-3">
                  {resume.roadmap.slice(0, 3).map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-cream/14 bg-[#102764]/38 p-3.5"
                    >
                      <span className="font-mono text-[9px] text-cream/32">0{index + 1}</span>
                      <p className="mt-2 text-xs font-semibold leading-5 text-cream/76">
                        {item.title}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-cream/12 pt-4 sm:flex-row sm:items-center sm:pt-5">
            <button
              type="button"
              onClick={toggleVoice}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cream/18 px-4 text-xs font-semibold text-cream/60 transition hover:bg-cream/[0.06] hover:text-cream"
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
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#173178] transition hover:bg-white sm:w-auto"
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => dismiss("/#plan")}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cream/22 px-5 text-sm font-semibold text-cream transition hover:bg-cream/[0.07]"
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
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#173178] transition hover:bg-white"
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

function isAutoplayBlocked(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
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
