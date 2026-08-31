"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo } from "react";
import { ArrowRight, AudioLines, Loader2, Play, Volume2 } from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import { useMayaVoice, voiceUrl } from "@/lib/voice/use-maya-voice";

/** The compact roadmap heading and active-pattern teacher panel. */
export function PracticeIntro({
  purpose,
  roadmap,
  nextHref,
  nextLabel,
  nextQuestionTitle
}: {
  purpose: string;
  roadmap: FrontendRoadmapHome | null;
  nextHref: string | null;
  nextLabel: string;
  nextQuestionTitle: string | null;
}) {
  const teacher = useWorkspaceTeacher();
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";
  const completed = roadmap?.completedQuestions ?? 0;
  const total = roadmap?.totalQuestions ?? 0;
  const exactPercent = total > 0 ? (completed / total) * 100 : 0;
  const activeChapter = useMemo(
    () =>
      roadmap?.chapters.find((chapter) => chapter.id === roadmap.currentChapterTemplateSlug) ??
      roadmap?.chapters[0] ??
      null,
    [roadmap]
  );
  const chapterPercent = Math.round(activeChapter?.progressPercent ?? 0);

  const script = useMemo(() => {
    if (!roadmap || total === 0) {
      return `${purpose} Focus on recognizing the pattern before you write code.`;
    }
    if (completed === 0) {
      return `Start with ${activeChapter?.title ?? "the first pattern"}. Name the pattern before you code, then explain why it fits.`;
    }
    if (completed >= total) {
      return `You finished the DSA path. Revisit anything you skipped, then carry these patterns into your next interview.`;
    }
    return `You’re ${chapterPercent}% through this pattern. Keep the approach clear before you optimise it.`;
  }, [activeChapter, chapterPercent, completed, purpose, roadmap, total]);

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
            DSA Practice
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-cream/54">
            Master the patterns that show up repeatedly in technical interviews.
          </p>
        </div>

        <div className="w-full rounded-xl border border-white/[0.08] bg-[#141619] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:max-w-[19rem]">
          <p className="text-[14px] font-medium leading-6 text-cream/72">
            You’ve solved{" "}
            <strong className="font-semibold tabular-nums text-cream">{completed}</strong> of{" "}
            <strong className="font-semibold tabular-nums text-cream">{total || 0}</strong>{" "}
            questions.
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.075]"
            role="progressbar"
            aria-label="Questions solved"
            aria-valuemin={0}
            aria-valuemax={Math.max(total, 1)}
            aria-valuenow={completed}
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
            {completed > 0 ? "Continue where you left off" : "Start your DSA path"}
          </p>
          <h2 className="mt-4 font-display text-[1.55rem] font-semibold leading-tight tracking-[-0.025em] text-cream sm:text-[1.7rem]">
            {activeChapter?.title ?? "Arrays & Hashing"}
          </h2>
          <p className="mt-2 max-w-[24rem] text-[13px] leading-5 text-cream/62">
            {activeChapter?.whyItMatters ?? purpose}
          </p>

          {nextHref ? (
            <Link
              href={nextHref}
              className="group mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cream px-4 py-2.5 text-[13px] font-semibold text-[#17181a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto sm:px-5"
            >
              <Play size={14} aria-hidden="true" fill="currentColor" />
              <span>{nextLabel}</span>
              {nextQuestionTitle ? (
                <>
                  <span className="text-black/35">•</span>
                  <span className="max-w-[9rem] truncate sm:max-w-40">{nextQuestionTitle}</span>
                </>
              ) : null}
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

        <div className="absolute right-6 top-9 z-20 hidden w-[12.5rem] rounded-xl border border-white/[0.07] bg-[#1a1c20]/95 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] lg:block">
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
            <p className="text-[13px] leading-6 text-cream/78">“{script}”</p>
          </div>
        </div>

        <button
          type="button"
          onClick={say}
          className="absolute bottom-5 right-6 z-20 hidden h-10 items-center gap-2 rounded-lg border border-white/[0.055] bg-[#1a1c20] px-3.5 text-[12px] font-semibold text-cream/72 transition hover:bg-[#202226] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] lg:inline-flex"
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

/** A quiet problem-solving reminder beside the DSA path. */
export function PracticeCoachCard() {
  return (
    <aside className="overflow-hidden rounded-[1.45rem] border border-white/[0.085] bg-[#141619] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:px-6">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-accent)]">
          How to practise
        </p>
        <h2 className="mt-2.5 font-display text-[1.2rem] font-semibold leading-6 tracking-[-0.025em] text-cream">
          Use this simple loop.
        </h2>

        <ol className="mt-4 space-y-3.5">
          <ApproachStep number="01" title="Name the pattern" />
          <ApproachStep number="02" title="State the direct approach" />
          <ApproachStep number="03" title="Optimise, then test edge cases" />
        </ol>
      </div>
    </aside>
  );
}

function ApproachStep({ number, title }: { number: string; title: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="font-mono text-[9px] font-semibold text-[var(--workspace-accent)]">
        {number}
      </span>
      <span className="text-[12px] font-medium leading-5 text-cream/72">{title}</span>
    </li>
  );
}
