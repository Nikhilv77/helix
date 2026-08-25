"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Play, Sparkles, Volume2, VolumeX } from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useMayaVoice, voiceUrl } from "@/lib/voice/use-maya-voice";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import type { FrontendRoadmapHome } from "@/lib/roadmap/roadmap";

export interface PracticeIntroStat {
  label: string;
  value: string;
}

/**
 * Once the roadmap has no current session, `findIndex` returns -1 and naive
 * arithmetic lands back on "Session 1 of 6" for someone who has finished
 * everything. Say what is actually true instead.
 */
function sessionLabel(roadmap: FrontendRoadmapHome | null): string {
  if (!roadmap) return "Current session";

  const index = roadmap.sessions.findIndex(
    (session) => session.id === roadmap.currentSessionTemplateSlug
  );
  if (index >= 0) return `Session ${index + 1} of ${roadmap.totalSessions}`;

  const allDone =
    roadmap.totalQuestions > 0 && roadmap.completedQuestions >= roadmap.totalQuestions;
  return allDone ? "Session complete" : `${roadmap.totalSessions} sessions`;
}

/**
 * Maya opening the Practice session, the way she opens the welcome flow.
 *
 * She reads the user's real position — completed count, active chapter, next
 * question — so the introduction changes as they work rather than being a
 * fixed script. With no roadmap she still introduces the session, just without
 * claiming any progress.
 */
export function PracticeIntro({
  sessionTitle,
  purpose,
  roadmap,
  stats,
  nextHref,
  nextLabel
}: {
  sessionTitle: string;
  purpose: string;
  roadmap: FrontendRoadmapHome | null;
  stats: PracticeIntroStat[];
  nextHref: string | null;
  nextLabel: string;
}) {
  const teacher = useWorkspaceTeacher();
  const [muted, setMuted] = useState(false);
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";

  const completed = roadmap?.completedQuestions ?? 0;
  const total = roadmap?.totalQuestions ?? 0;
  const percent = Math.round(roadmap?.overallProgressPercent ?? 0);

  const activeChapter = useMemo(
    () =>
      roadmap?.chapters.find((chapter) => chapter.id === roadmap.currentChapterTemplateSlug) ??
      null,
    [roadmap]
  );

  // One string, shown and spoken, so her voice never drifts from the screen.
  const script = useMemo(() => {
    if (!roadmap || total === 0) {
      // The heading directly above already names the session, so leading with
      // it again read as a stutter on screen.
      return `${purpose} Work through the chapters in order — each one sets up the next. Say your brute force out loud before you optimise it.`;
    }

    if (completed === 0) {
      return `This is ${sessionTitle}, and you have not started yet. ${total} questions across ${roadmap.totalChapters} chapters. We begin with ${activeChapter?.title ?? "the first pattern"}. My advice: read the problem twice, say the brute force out loud, then improve it. That is the order interviewers want to hear.`;
    }

    if (completed >= total) {
      return `You have finished all ${total} questions in ${sessionTitle}. That is the whole pattern set. Go back to anything you marked skipped, then we move to the next session.`;
    }

    return `You are ${percent} percent through ${sessionTitle} — ${completed} of ${total} questions done. Right now you are in ${activeChapter?.title ?? "your current chapter"}. Keep naming the pattern before you write anything, and narrate your tradeoffs as you go. That is what gets scored.`;
  }, [activeChapter, completed, percent, purpose, roadmap, sessionTitle, total]);

  const say = useCallback(() => {
    if (muted) return;
    // Also releases the autoplay lock: this is now the only control that
    // starts her, so pressing it has to work in the blocked state too.
    setAwaitingGesture(false);
    void speak(script);
  }, [muted, script, setAwaitingGesture, speak]);

  // Autoplay is refused until the page has seen a gesture; wait for one rather
  // than silently failing.
  useEffect(() => {
    if (muted || awaitingGesture) return;
    const start = window.setTimeout(() => void speak(script), 80);
    return () => {
      window.clearTimeout(start);
      stop();
    };
  }, [awaitingGesture, muted, script, speak, stop]);

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
    if (muted) stop();
  }, [muted, stop]);

  useEffect(() => {
    if (muted) return;
    const warm = new Audio(voiceUrl(script, teacher.id));
    warm.preload = "auto";
    warm.load();
  }, [muted, script, teacher.id]);

  return (
    <section className="practice-glass practice-reveal relative mt-7 overflow-hidden rounded-[1.75rem]">
      <div className="practice-accent-glow absolute -left-20 top-8 h-80 w-80" />
      <div className="grid min-h-[31rem] lg:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="relative min-h-[22rem] overflow-hidden border-b border-cream/10 lg:min-h-full lg:border-b-0 lg:border-r">
          <div
            className="absolute inset-x-[-9%] bottom-0 top-3"
            style={{
              maskImage: "linear-gradient(180deg,#000 0%,#000 84%,transparent 100%)",
              WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 84%,transparent 100%)"
            }}
          >
            <MayaStage speaking={speaking} />
          </div>

          <div className="relative z-20 flex items-center justify-between p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Sparkles size={17} aria-hidden="true" style={{ color: "var(--workspace-accent)" }} />
              <div>
                <p className="text-[15px] font-semibold text-cream">{teacher.name}</p>
                <p className="text-[12px] text-cream/45">Practice coach</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? `Unmute ${teacher.name}` : `Mute ${teacher.name}`}
              className="grid h-9 w-9 place-items-center rounded-full text-cream/55 transition hover:bg-cream/[0.07] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/30"
            >
              {muted ? (
                <VolumeX size={17} aria-hidden="true" />
              ) : (
                <Volume2 size={17} aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="absolute bottom-5 left-5 z-20 sm:bottom-6 sm:left-6">
            <span className="practice-glass-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium text-cream/68">
              <span className="workspace-accent-dot h-1.5 w-1.5 rounded-full" />
              {speaking
                ? `${teacher.name} is speaking`
                : muted
                  ? "Voice muted"
                  : awaitingGesture
                    ? "Ready when you are"
                    : "Coach ready"}
            </span>
          </div>
        </div>

        <div className="relative flex min-w-0 flex-col px-6 py-7 sm:px-9 sm:py-9 lg:px-11 lg:py-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{
                background: "var(--workspace-accent-soft)",
                color: "var(--workspace-accent)"
              }}
            >
              {sessionLabel(roadmap)}
            </span>
            {activeChapter ? (
              <span className="rounded-full bg-cream/[0.055] px-3 py-1.5 text-[12px] font-medium text-cream/58">
                Now · {activeChapter.title}
              </span>
            ) : null}
          </div>

          <h1 className="mt-5 max-w-3xl font-display text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.035em] text-cream sm:text-[3rem]">
            {sessionTitle}
          </h1>
          <p className="mt-5 max-w-3xl text-[16px] leading-7 text-cream/68 sm:text-[17px] sm:leading-8">
            {script}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="practice-glass-soft rounded-2xl px-4 py-3.5">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/40">
                  {stat.label}
                </dt>
                <dd className="mt-1.5 font-display text-[1.35rem] font-semibold tracking-tight text-cream">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          {roadmap && total > 0 ? (
            <div className="mt-6">
              <div className="flex items-baseline gap-3 text-[13px] text-cream/50">
                <span>
                  {completed} of {total} complete
                </span>
                <span className="ml-auto font-semibold text-cream/76">{percent}%</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-cream/[0.075]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${percent}%`, background: "var(--workspace-accent)" }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
            {nextHref ? (
              <Link
                href={nextHref}
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-cream px-5 text-[15px] font-semibold text-[#171a16] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
              disabled={muted}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-cream/[0.065] px-4 text-[14px] font-semibold text-cream/72 transition hover:bg-cream/[0.11] hover:text-cream disabled:pointer-events-none disabled:opacity-40"
            >
              {state === "loading" ? (
                <Loader2 size={16} aria-hidden="true" className="animate-spin" />
              ) : (
                <Volume2 size={16} aria-hidden="true" />
              )}
              Hear {teacher.name}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
