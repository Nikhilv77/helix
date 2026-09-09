"use client";

import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Loader2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { ALL_PERSONAS, type InterviewerPersona } from "@/lib/avatars/personas";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";
import { PRIMARY_BUTTON } from "../flow/onboarding-data";

const AvatarStage = dynamic(
  () => import("@/components/interview/voice/avatar-stage").then((module) => module.AvatarStage),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center" aria-label="Loading teacher avatar">
        <Loader2 className="animate-spin text-cream/35" size={22} />
      </div>
    )
  }
);

const headingWords = ["Who", "should", "teach", "you?"];

export const DEFAULT_TEACHER_ID = "sophia";
const FRAMING = "default" as const;

/** Only the centre stage plus its two neighbours are ever mounted. */
function neighbours(index: number) {
  const count = ALL_PERSONAS.length;
  return {
    left: (index - 1 + count) % count,
    right: (index + 1) % count
  };
}

/**
 * Desktop pointers get the full three-avatar composition. Touch devices keep
 * one sharp live stage, including wide tablets that would otherwise create
 * three WebGL contexts merely because their CSS viewport crosses 1024px.
 */
function useWideViewport(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return wide;
}

export function TeacherStep({
  selected,
  onSelect,
  onContinue
}: {
  selected: string | null;
  onSelect: (teacherId: string) => void;
  onContinue: () => void;
}) {
  const [index, setIndex] = useState(() => {
    const found = ALL_PERSONAS.findIndex((persona) => persona.id === selected);
    if (found !== -1) return found;
    const defaultIndex = ALL_PERSONAS.findIndex((persona) => persona.id === DEFAULT_TEACHER_ID);
    return defaultIndex === -1 ? 0 : defaultIndex;
  });
  const { state, speak, stop, awaitingGesture } = useMayaVoice();
  const wide = useWideViewport();
  const introducedRef = useRef(false);
  const pendingTeacherRef = useRef<{
    persona: InterviewerPersona;
    previousIndex: number;
  } | null>(null);
  const [loadingTeacherId, setLoadingTeacherId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const focused = ALL_PERSONAS[index]!;
  const { left, right } = neighbours(index);
  const speaking = state === "speaking" || state === "loading";
  const voiceBroken = state === "unavailable";
  const loadingTeacher = loadingTeacherId !== null;

  // Centring a teacher is the selection. There is no separate commit step —
  // whoever is on the stage when Continue is pressed is the one who teaches.
  useEffect(() => {
    onSelect(focused.id);
  }, [focused.id, onSelect]);

  const greet = useCallback(
    (persona: InterviewerPersona) => {
      introducedRef.current = true;
      void speak(persona.greeting, persona.id);
    },
    [speak]
  );

  const go = useCallback(
    (nextIndex: number) => {
      if (loadingTeacher) return;
      const count = ALL_PERSONAS.length;
      const wrapped = (nextIndex + count) % count;
      const persona = ALL_PERSONAS[wrapped]!;

      // Cover the previous canvas with a stable loading state while the next
      // GLB decodes. There is intentionally no card motion during this handoff.
      stop();
      pendingTeacherRef.current = { persona, previousIndex: index };
      setLoadError(null);
      setLoadingTeacherId(persona.id);
      setIndex(wrapped);
    },
    [index, loadingTeacher, stop]
  );

  const handleModelReady = useCallback(
    (modelUrl: string) => {
      const pending = pendingTeacherRef.current;
      if (!pending || pending.persona.model !== modelUrl) return;
      pendingTeacherRef.current = null;
      setLoadingTeacherId(null);
      greet(pending.persona);
    },
    [greet]
  );

  const handleModelError = useCallback((modelUrl: string) => {
    const pending = pendingTeacherRef.current;
    if (!pending || pending.persona.model !== modelUrl) return;
    pendingTeacherRef.current = null;
    setLoadingTeacherId(null);
    setLoadError(`${pending.persona.name} couldn't load. Try again.`);
    setIndex(pending.previousIndex);
  }, []);

  useEffect(
    () => () => {
      pendingTeacherRef.current = null;
    },
    []
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  // Moving on mid-sentence would leave one teacher's voice coming out of the
  // next one's face.
  useEffect(() => stop, [stop]);

  return (
    <>
      <div className="text-center">
        <h1
          className="onboarding-page-title display-heading mx-auto flex max-w-4xl flex-wrap justify-center gap-x-3 gap-y-1 text-cream sm:gap-x-4"
          aria-label="Who should teach you?"
        >
          {headingWords.map((word, wordIndex) => (
            <span
              key={`${word}-${wordIndex}`}
              aria-hidden="true"
              className="onboarding-word"
              style={{ "--word-delay": `${wordIndex * 85}ms` } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </h1>
      </div>

      <div className="relative mx-auto mt-7 flex w-full max-w-6xl items-center justify-center gap-3 sm:gap-6">
        {wide ? (
          <Peek
            persona={ALL_PERSONAS[left]!}
            side="left"
            disabled={loadingTeacher}
            onClick={() => go(index - 1)}
          />
        ) : null}

        <div className="relative w-full max-w-[20rem] shrink-0 sm:max-w-[23rem]">
          <div className="teacher-carousel-scene relative h-[20.5rem] overflow-hidden rounded-[2rem] sm:h-[25rem]">
            <div className="teacher-carousel-orbit" aria-hidden="true" />
            <AvatarStage
              agentTrack={null}
              state={speaking ? "speaking" : "listening"}
              url={focused.model}
              rig={focused.rig}
              framing={FRAMING}
              performanceProfile="onboarding"
              showStatus={false}
              feather={false}
              introducing={state === "speaking"}
              onModelReady={handleModelReady}
              onModelError={handleModelError}
            />

            {loadingTeacher ? (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 z-20 grid place-items-center bg-[#15161a]"
              >
                <div className="flex flex-col items-center gap-3 text-cream/60">
                  <Loader2 size={24} className="animate-spin text-[#F26E01]" aria-hidden="true" />
                  <span className="blueprint-label">LOADING {focused.name.toUpperCase()}...</span>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={loadingTeacher}
              onClick={() => (speaking ? stop() : greet(focused))}
              aria-label={speaking ? `Stop ${focused.name}` : `Hear ${focused.name}`}
              className={[
                "absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition duration-300 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#F26E01] lg:backdrop-blur-xl",
                awaitingGesture
                  ? "animate-pulse bg-[#F26E01] text-white hover:bg-[#ff7a0a]"
                  : "bg-black/65 text-cream/75 hover:bg-black/75 hover:text-cream lg:bg-black/30 lg:hover:bg-black/50"
              ].join(" ")}
            >
              {state === "loading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : voiceBroken ? (
                <VolumeX size={16} />
              ) : (
                <Volume2 size={16} />
              )}
            </button>
          </div>

          <div key={focused.id} className="teacher-carousel-copy mt-5 text-center">
            <p className="text-[1.65rem] font-semibold leading-none tracking-[-0.035em] text-cream sm:text-[1.9rem]">
              {focused.name}
            </p>
            <p className="mt-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#F26E01]/85">
              {focused.tagline}
            </p>
            <p className="onboarding-lede mx-auto mt-3 max-w-[26rem] text-cream/72">
              {focused.bio}
            </p>
          </div>
        </div>

        {wide ? (
          <Peek
            persona={ALL_PERSONAS[right]!}
            side="right"
            disabled={loadingTeacher}
            onClick={() => go(index + 1)}
          />
        ) : null}

        <Arrow side="left" disabled={loadingTeacher} onClick={() => go(index - 1)} />
        <Arrow side="right" disabled={loadingTeacher} onClick={() => go(index + 1)} />
      </div>

      <div className="mx-auto mt-7 flex w-full max-w-5xl flex-col items-center gap-4">
        <p className="min-h-5 text-[12.5px] text-cream/50" role="status">
          {loadingTeacher
            ? `Loading ${focused.name}...`
            : loadError
              ? loadError
              : voiceBroken
                ? "Voice preview is unavailable right now — you can still choose."
                : awaitingGesture
                  ? `Tap the orange sound button to hear ${focused.name}.`
                  : !introducedRef.current
                    ? `Tap the sound button to hear ${focused.name}.`
                    : `${focused.name} will guide you from here.`}
        </p>

        <button
          type="button"
          className={`${PRIMARY_BUTTON} teacher-carousel-continue relative overflow-hidden font-medium disabled:cursor-wait disabled:opacity-55`}
          disabled={loadingTeacher}
          onClick={() => {
            stop();
            onContinue();
          }}
        >
          Continue with {focused.name}
        </button>
      </div>
    </>
  );
}

/**
 * Desktop-only flanking teachers render one sharp GLB frame and then park.
 * Touch devices never mount these stages.
 */
function Peek({
  persona,
  side,
  disabled,
  onClick
}: {
  persona: InterviewerPersona;
  side: "left" | "right";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Show ${persona.name}`}
      onClick={onClick}
      disabled={disabled}
      className={[
        "teacher-carousel-peek group relative hidden h-[16.5rem] w-[12rem] shrink-0 overflow-hidden rounded-[1.8rem] transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:block",
        side === "left" ? "origin-right" : "origin-left",
        "opacity-45 hover:scale-[1.025] hover:opacity-75"
      ].join(" ")}
    >
      <AvatarStage
        agentTrack={null}
        state="listening"
        url={persona.model}
        rig={persona.rig}
        framing={FRAMING}
        performanceProfile="preview"
        active={false}
        showStatus={false}
        feather={false}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(14,15,17,0.94)] to-transparent px-3 pb-3 pt-10 text-[13px] font-semibold text-cream/85">
        {persona.name}
      </span>
    </button>
  );
}

function Arrow({
  side,
  disabled,
  onClick
}: {
  side: "left" | "right";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous teacher" : "Next teacher"}
      className={[
        "absolute top-[9.5rem] z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#17181b]/95 text-cream/70 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-300 hover:scale-110 hover:bg-[#222328] hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#F26E01] disabled:cursor-wait disabled:opacity-45 disabled:hover:scale-100 sm:top-[12rem] lg:bg-white/[0.055] lg:backdrop-blur-xl lg:hover:bg-white/[0.12]",
        side === "left" ? "left-0 sm:-left-2" : "right-0 sm:-right-2"
      ].join(" ")}
    >
      {side === "left" ? <ChevronLeft size={19} /> : <ChevronRight size={19} />}
    </button>
  );
}
