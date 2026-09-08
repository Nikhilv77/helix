"use client";

import Link from "next/link";
import { ArrowRight, AudioLines, Loader2, Play, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import type { StoryPracticeIntroExperience } from "@/components/workspace/story-practice/contracts";
import type { StoryPracticeBlockView } from "@/components/workspace/story-practice/view-contracts";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { useMayaVoice, voiceUrl } from "@/lib/voice/use-maya-voice";

export const CORE_TECHNICAL_INTRO_EXPERIENCE: StoryPracticeIntroExperience = {
  label: "Core Technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "story",
  description: "Build production depth through one connected technical story.",
  script: (title) =>
    `Your next focus is “${title}.” Trace the mechanism, follow the evidence, then prove the repair.`
};

export function CoreTechnicalIntro({
  block,
  terminalCount,
  experience = CORE_TECHNICAL_INTRO_EXPERIENCE
}: {
  block: StoryPracticeBlockView;
  terminalCount: number;
  experience?: StoryPracticeIntroExperience;
}) {
  const teacher = useWorkspaceTeacher();
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";
  const nextQuestion = block.questions.find(({ status }) => status === "ACTIVE") ?? null;
  const exactPercent = (terminalCount / Math.max(block.questions.length, 1)) * 100;
  const script = useMemo(
    () => experience.script(block.story.title),
    [block.story.title, experience]
  );

  const say = useCallback(() => {
    setAwaitingGesture(false);
    void speak(script);
  }, [script, setAwaitingGesture, speak]);

  useEffect(() => {
    if (awaitingGesture) return;
    const start = window.setTimeout(() => void speak(script), 80);
    return () => {
      window.clearTimeout(start);
      stop();
    };
  }, [awaitingGesture, script, speak, stop]);

  useEffect(() => {
    if (!awaitingGesture) return;
    const unlock = () => setAwaitingGesture(false);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [awaitingGesture, setAwaitingGesture]);

  useEffect(() => {
    const warm = new Audio(voiceUrl(script, teacher.id));
    warm.preload = "auto";
    warm.load();
  }, [script, teacher.id]);

  return (
    <div className="practice-reveal">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[2rem] font-semibold leading-none tracking-[-0.035em] text-cream sm:text-[2.15rem]">
            {experience.label} Practice
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-cream/54">
            {experience.description}
          </p>
        </div>

        <div className="w-full rounded-xl border border-white/[0.08] bg-[#141619] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:max-w-[19rem]">
          <p className="text-[14px] font-medium leading-6 text-cream/72">
            <strong className="font-semibold tabular-nums text-cream">{terminalCount}</strong> of{" "}
            <strong className="font-semibold tabular-nums text-cream">
              {block.questions.length}
            </strong>{" "}
            questions complete
            <span className="block text-cream/42">
              {capitalize(experience.subjectNoun)} {block.ordinal} · {block.isCurrent ? "Current path" : `Completed ${experience.subjectNoun}`}
            </span>
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.075]"
            role="progressbar"
            aria-label={`${experience.label} questions completed or learned`}
            aria-valuemin={0}
            aria-valuemax={block.questions.length}
            aria-valuenow={terminalCount}
          >
            <span
              className="block h-full rounded-full bg-[var(--workspace-accent)] transition-[width] duration-500"
              style={{ width: `${Math.min(100, exactPercent)}%` }}
            />
          </div>
        </div>
      </header>

      <section className="relative mt-6 flex flex-col overflow-hidden rounded-2xl border border-white/[0.085] bg-[#141619] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:mt-7 md:block md:min-h-[13.5rem]">
        <div className="relative z-20 order-2 flex max-w-none flex-col items-start justify-start px-5 py-7 sm:px-7 md:min-h-[13.5rem] md:max-w-[52%] md:justify-center lg:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--workspace-accent)]">
            {capitalize(experience.subjectNoun)} {block.ordinal} · {block.selection.difficulty}
          </p>
          <h2 className="mt-3 font-display text-[1.55rem] font-semibold leading-tight tracking-[-0.025em] text-cream sm:text-[1.7rem]">
            {block.story.title}
          </h2>
          <p className="mt-2 max-w-[24rem] text-[14px] leading-6 text-cream/66">
            {block.story.incident}
          </p>

          {nextQuestion && block.isCurrent ? (
            <Link
              href={`${experience.routeBase}/questions/${encodeURIComponent(nextQuestion.id)}?block=${encodeURIComponent(block.id)}`}
              className="group mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cream px-4 py-2.5 text-[14px] font-semibold text-[#17181a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto sm:px-5"
            >
              <Play size={14} aria-hidden="true" fill="currentColor" />
              <span>{terminalCount ? "Continue" : `Start ${experience.subjectNoun}`}</span>
              <span className="text-black/35">•</span>
              <span>Question {nextQuestion.order}</span>
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="ml-1 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ) : null}
        </div>

        <div
          className="pointer-events-none relative z-10 order-1 h-[17rem] w-full shrink-0 md:absolute md:bottom-[-10%] md:right-[-3rem] md:top-[-12%] md:h-auto md:w-[23rem] lg:right-[12.5rem]"
          style={{
            maskImage:
              "linear-gradient(180deg,#000 0%,#000 76%,rgba(0,0,0,.9) 87%,transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg,#000 0%,#000 76%,rgba(0,0,0,.9) 87%,transparent 100%)"
          }}
        >
          <MayaStage speaking={speaking} transparent />
        </div>

        <div className="absolute right-5 top-5 z-20 hidden w-[clamp(14.5rem,22vw,17rem)] max-w-[40%] rounded-xl border border-white/[0.07] bg-[#1a1c20]/95 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] lg:block">
          <span
            aria-hidden
            className="absolute -left-2 top-8 h-4 w-4 rotate-45 border-b border-l border-white/[0.07] bg-[#1a1c20]"
          />
          <div className="relative flex gap-3">
            <AudioLines
              size={21}
              strokeWidth={1.8}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--workspace-accent)]"
            />
            <p className="min-w-0 break-words text-pretty text-[14px] leading-6 text-cream/82">
              “{script}”
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={say}
          className="absolute bottom-4 right-5 z-20 hidden h-10 items-center gap-2 rounded-lg border border-white/[0.055] bg-[#1a1c20] px-3.5 text-[13px] font-semibold text-cream/76 transition hover:bg-[#202226] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] lg:inline-flex"
        >
          {state === "loading" ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <Volume2 size={14} aria-hidden="true" />
          )}
          Hear {teacher.name}
        </button>
      </section>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
