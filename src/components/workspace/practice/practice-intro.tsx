"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Play, Volume2 } from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";
import { useMayaVoice, voiceUrl } from "@/lib/voice/use-maya-voice";

/** A profile-style teacher briefing with progress and the next focused action. */
export function PracticeIntro({
  purpose,
  roadmap,
  nextHref,
  nextLabel
}: {
  purpose: string;
  roadmap: FrontendRoadmapHome | null;
  nextHref: string | null;
  nextLabel: string;
}) {
  const teacher = useWorkspaceTeacher();
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";
  const completed = roadmap?.completedQuestions ?? 0;
  const total = roadmap?.totalQuestions ?? 0;
  const activeChapter = useMemo(
    () =>
      roadmap?.chapters.find((chapter) => chapter.id === roadmap.currentChapterTemplateSlug) ??
      null,
    [roadmap]
  );

  const script = useMemo(() => {
    if (!roadmap || total === 0) {
      return `${purpose} Work through the chapters in order. Say the brute-force approach out loud before you optimise it.`;
    }
    if (completed === 0) {
      return `You have ${total} questions ahead. We’ll begin with ${activeChapter?.title ?? "the first pattern"}. Read the problem twice, explain the simple approach, then improve it.`;
    }
    if (completed >= total) {
      return `You finished all ${total} questions. Revisit anything you skipped, then carry these patterns into your next session.`;
    }
    return `${completed} of ${total} questions are done. You’re working through ${activeChapter?.title ?? "your current pattern"}. Name the pattern before you code, and explain each trade-off as you go.`;
  }, [activeChapter, completed, purpose, roadmap, total]);

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
    <header className="practice-reveal">
      <div className="mx-auto flex min-h-[30rem] w-full max-w-3xl flex-col items-center justify-center py-4 text-center sm:min-h-[34rem]">
        <div className="relative h-[16rem] w-full max-w-[27rem] sm:h-[19rem]">
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[45%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent-soft)] blur-[72px]"
          />
          <div
            className="absolute inset-x-[-12%] bottom-[-5%] top-[-10%] sm:inset-x-[-7%]"
            style={{
              maskImage:
                "linear-gradient(180deg,#000 0%,#000 78%,rgba(0,0,0,0.86) 88%,transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(180deg,#000 0%,#000 78%,rgba(0,0,0,0.86) 88%,transparent 100%)"
            }}
          >
            <MayaStage speaking={speaking} transparent />
          </div>
        </div>

        <div className="relative z-10 -mt-7 flex w-full max-w-2xl flex-col items-center sm:-mt-10">
          <section className="w-full">
            <div className="relative rounded-[1.45rem] bg-[#17181b] px-5 py-5 text-left sm:px-7 sm:py-6">
              <span
                aria-hidden
                className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#17181b]"
              />
              <p className="relative text-base leading-7 text-cream/68 sm:text-lg sm:leading-8">
                {script}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {nextHref ? (
                <Link
                  href={nextHref}
                  className="group inline-flex h-12 items-center gap-2 rounded-xl bg-cream px-5 text-[15px] font-semibold text-[#17181a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <Play size={15} aria-hidden="true" fill="currentColor" />
                  {nextLabel}
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ) : null}
              <button
                type="button"
                onClick={say}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white/[0.045] px-4 text-[14px] font-semibold text-cream/62 transition hover:bg-white/[0.075] hover:text-cream"
              >
                {state === "loading" ? (
                  <Loader2 size={15} aria-hidden="true" className="animate-spin" />
                ) : (
                  <Volume2 size={15} aria-hidden="true" />
                )}
                Hear {teacher.name}
              </button>
            </div>
          </section>
        </div>
      </div>
    </header>
  );
}
