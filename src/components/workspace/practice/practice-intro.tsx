"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Play, Sparkles, Volume2, VolumeX } from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import { useMayaVoice, voiceUrl } from "@/lib/voice/use-maya-voice";
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
  const [muted, setMuted] = useState(false);
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();
  const speaking = state === "speaking";

  const completed = roadmap?.completedQuestions ?? 0;
  const total = roadmap?.totalQuestions ?? 0;
  const percent = Math.round(roadmap?.overallProgressPercent ?? 0);

  const activeChapter = useMemo(
    () =>
      roadmap?.chapters.find(
        (chapter) => chapter.id === roadmap.currentChapterTemplateSlug
      ) ?? null,
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
    const warm = new Audio(voiceUrl(script));
    warm.preload = "auto";
    warm.load();
  }, [muted, script]);

  return (
    <section className="mt-6 overflow-hidden rounded-[1.25rem] border border-cream/20 bg-cream/[0.035] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-stretch">
        {/* Maya, mounted the way Home mounts her: an absolute layer over a box
            with real height, so the WebGL canvas always has dimensions. */}
        <div className="relative flex min-h-[22rem] flex-col overflow-hidden rounded-2xl bg-[#1b1d20] lg:min-h-[28rem]">
          {/* Stops above the control row so the status pill and Hear Maya
              button never sit across her. */}
          <div
            className="absolute inset-x-[-6%] bottom-[3.25rem] top-[3.5rem] z-0"
            style={{
              maskImage: "linear-gradient(180deg,#000 0%,#000 92%,transparent 100%)",
              WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 92%,transparent 100%)"
            }}
          >
            <MayaStage speaking={speaking} />
          </div>

          <div className="relative z-20 flex items-center justify-between gap-3 px-5 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cream text-[#254294]">
                <Sparkles size={15} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[14px] font-semibold leading-tight text-cream">Maya</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-cream/45">
                  Your interview coach
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? "Unmute Maya" : "Mute Maya"}
              className="grid h-8 w-8 place-items-center rounded-lg text-cream/55 transition hover:bg-cream/[0.1] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40"
            >
              {muted ? (
                <VolumeX size={15} aria-hidden="true" />
              ) : (
                <Volume2 size={15} aria-hidden="true" />
              )}
            </button>
          </div>

          <div aria-hidden="true" className="min-h-0 flex-1" />

          {/* Status only. The single "Hear Maya" control lives beside the
              primary CTA — having one here too meant two identical buttons on
              screen whenever autoplay was blocked. */}
          <div className="relative z-20 px-5 pb-5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                speaking ? "bg-[#8be6bd]/12 text-[#a9f0d0]" : "bg-cream/[0.07] text-cream/45"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${speaking ? "bg-[#8be6bd]" : "bg-cream/35"}`}
              />
              {speaking ? "Speaking" : muted ? "Muted" : awaitingGesture ? "Tap to start" : "Ready"}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-2 sm:p-5 lg:py-7 lg:pl-2 lg:pr-7">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-md bg-[#8be6bd]/14 px-2.5 py-1 text-[11.5px] font-semibold text-[#a9f0d0]">
              {sessionLabel(roadmap)}
            </span>
            {activeChapter ? (
              <span className="rounded-md bg-cream/[0.07] px-2.5 py-1 text-[11.5px] font-medium text-cream/60">
                Now: {activeChapter.title}
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 font-display text-[2rem] font-semibold leading-10 tracking-tight text-cream sm:text-[2.4rem] sm:leading-[3rem]">
            {sessionTitle}
          </h1>

          <p className="mt-3 max-w-2xl text-[15.5px] leading-7 text-cream/70">{script}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/42">
                  {stat.label}
                </dt>
                <dd className="mt-1.5 font-display text-[1.4rem] font-semibold tracking-tight text-cream">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          {roadmap && total > 0 ? (
            <div className="mt-6">
              <div className="flex items-baseline gap-3 text-[12.5px] font-medium text-cream/50">
                <span>
                  {completed} of {total} complete
                </span>
                <span className="ml-auto text-cream/70">{percent}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1e3c88]">
                <div
                  className="h-full rounded-full bg-[#8be6bd] transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-6">
            {nextHref ? (
              <Link
                href={nextHref}
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-6 text-[14.5px] font-semibold text-[#171a16] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Play size={15} aria-hidden="true" fill="currentColor" />
                {nextLabel}
                <ArrowRight
                  size={15}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ) : null}

            <button
              type="button"
              onClick={say}
              disabled={muted}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-cream/[0.07] px-4 text-[14px] font-semibold text-cream/70 transition hover:bg-cream/[0.13] hover:text-cream disabled:pointer-events-none disabled:opacity-40"
            >
              {state === "loading" ? (
                <Loader2 size={15} aria-hidden="true" className="animate-spin" />
              ) : (
                <Volume2 size={15} aria-hidden="true" />
              )}
              Hear Maya
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
