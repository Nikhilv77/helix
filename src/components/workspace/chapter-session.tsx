"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Clock,
  Loader2,
  Play,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX
} from "lucide-react";
import { MayaStage } from "@/components/workspace/maya-stage";
import { useMayaVoice, voiceUrl } from "@/lib/use-maya-voice";
import type { BriefBeat, ChapterBrief } from "@/lib/chapter-brief";
import type { FrontendRoadmapChapterDetail } from "@/lib/roadmap";

/**
 * Maya takes the session; the user solves the questions.
 *
 * The briefing is a sequence of beats she narrates — the same string is shown
 * and spoken, so the screen never says something different from her voice.
 * Progress on the right is the user's own, so a returning user lands on the
 * question list rather than sitting through the briefing again.
 */
export function ChapterSession({
  brief,
  beats,
  detail
}: {
  brief: ChapterBrief;
  beats: BriefBeat[];
  detail: FrontendRoadmapChapterDetail | null;
}) {
  // Always open on the briefing. Roadmap "attempts" include merely opening a
  // question page, so they cannot tell us whether this session was ever
  // actually taken — only having watched it can, and that is remembered here.
  const [phase, setPhase] = useState<"brief" | "solve">("brief");
  const [step, setStep] = useState(0);
  const [muted, setMuted] = useState(false);
  const { state, speak, stop, awaitingGesture, setAwaitingGesture } = useMayaVoice();

  const beat = beats[step];
  const isLast = step === beats.length - 1;
  const speaking = state === "speaking";

  // Still "helix:" after the Trailgrad rename, on purpose: this key is already
  // written in real browsers, and renaming it would replay briefings users have
  // dismissed. Nobody sees the string.
  const seenKey = `helix:briefing-seen:${brief.slug}`;

  // Runs after hydration, so the server and first client render agree on
  // "brief" and a returning user is moved on a frame later.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(seenKey) === "1") setPhase("solve");
    } catch {
      // Private mode or blocked storage just means she briefs again.
    }
  }, [seenKey]);

  const finishBriefing = useCallback(() => {
    try {
      window.localStorage.setItem(seenKey, "1");
    } catch {
      // Not being able to remember is not a reason to block the handover.
    }
    setPhase("solve");
  }, [seenKey]);

  const lineFor = useCallback((item: BriefBeat) => `${item.title} ${item.body}`, []);

  const say = useCallback(
    (line: string) => {
      if (muted) return;
      void speak(line);
    },
    [muted, speak]
  );

  // Narrate whichever beat is on screen. Changing beats cancels the previous
  // line rather than letting two of Maya talk over each other. The short settle
  // keeps a gesture that also advances the beat from speaking both.
  useEffect(() => {
    if (phase !== "brief" || !beat || muted || awaitingGesture) return;

    const start = window.setTimeout(() => void speak(lineFor(beat)), 60);
    return () => {
      window.clearTimeout(start);
      stop();
    };
  }, [awaitingGesture, beat, lineFor, muted, phase, speak, stop]);

  // Autoplay is refused until the page has seen a real interaction. Arriving by
  // client-side navigation usually carries activation over; a hard load does
  // not, so wait for the next gesture and then start her.
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

  // Warm the next beat's audio so Continue plays from cache.
  useEffect(() => {
    const upcoming = beats[step + 1];
    if (!upcoming || muted) return;
    const warm = new Audio(voiceUrl(lineFor(upcoming)));
    warm.preload = "auto";
    warm.load();
  }, [beats, lineFor, muted, step]);

  useEffect(() => {
    if (phase === "solve") stop();
  }, [phase, stop]);

  // Arrow keys move through the briefing the way they move a carousel, and
  // Escape hands over to the questions. Ignored while the user is typing or
  // focused on a control, so it never hijacks a real interaction.
  useEffect(() => {
    if (phase !== "brief") return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName))
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setStep((current) => (current >= beats.length - 1 ? current : current + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStep((current) => Math.max(0, current - 1));
      }
      if (event.key === "Escape") {
        event.preventDefault();
        finishBriefing();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beats.length, finishBriefing, phase]);

  // Arrow keys move through the briefing, Escape hands over to the questions.
  // Ignored while typing so it cannot hijack a search field elsewhere.
  useEffect(() => {
    if (phase !== "brief") return;

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (isLast) finishBriefing();
        else setStep((s) => Math.min(beats.length - 1, s + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      }
      if (event.key === "Escape") {
        event.preventDefault();
        finishBriefing();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beats.length, finishBriefing, isLast, phase]);

  useEffect(() => {
    if (muted) stop();
  }, [muted, stop]);

  const hours = Math.max(Math.round(brief.totalMinutes / 60), 1);
  const completed = detail?.completedQuestions ?? 0;
  const percent = Math.round(detail?.progressPercent ?? 0);

  return (
    <div className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10">
      <Breadcrumb title={brief.title} />

      <section className="relative overflow-hidden rounded-[1.5rem] bg-[#3557b4] p-4 shadow-[inset_0_0_0_1px_rgba(239,232,214,0.07)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-stretch">
          <MayaColumn
            speaking={speaking}
            muted={muted}
            blocked={awaitingGesture}
            onToggleMute={() => setMuted((m) => !m)}
            onWake={() => {
              setAwaitingGesture(false);
              if (beat) say(lineFor(beat));
            }}
          />

          <div className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
            {phase === "brief" && beat ? (
              <BriefPanel
                beat={beat}
                step={step}
                total={beats.length}
                voiceState={state}
                onBack={() => setStep((s) => Math.max(0, s - 1))}
                onNext={() => {
                  if (isLast) {
                    finishBriefing();
                    return;
                  }
                  setStep((s) => s + 1);
                }}
                onSkip={finishBriefing}
                onReplay={() => say(beat.body)}
                isLast={isLast}
              />
            ) : (
              <SolvePanel
                brief={brief}
                detail={detail}
                onReplayBriefing={() => {
                  setStep(0);
                  setPhase("brief");
                }}
              />
            )}
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Questions" value={`${completed}/${brief.totalQuestions}`} hint="completed" />
        <StatCard label="Estimated" value={`~${hours}h`} hint="of focused practice" />
        <StatCard
          label="Chapter progress"
          value={`${percent}%`}
          hint={detail ? "from your saved progress" : "sign-in required to track"}
        />
      </div>
    </div>
  );
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav className="flex items-center gap-2 py-6 text-[13px] font-medium text-cream/45">
      <Link href="/" className="transition hover:text-cream">
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <Link href="/practice" className="transition hover:text-cream">
        Practice
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-cream/75">{title}</span>
    </nav>
  );
}

function MayaColumn({
  speaking,
  muted,
  blocked,
  onToggleMute,
  onWake
}: {
  speaking: boolean;
  muted: boolean;
  blocked: boolean;
  onToggleMute: () => void;
  onWake: () => void;
}) {
  return (
    <div className="relative flex min-h-[26rem] flex-col overflow-hidden rounded-2xl bg-[#2a4aa0] lg:min-h-[34rem]">
      {/* Same absolute mount Home uses: the WebGL canvas sizes to its parent,
          so it needs a box with real dimensions rather than a flex child that
          can collapse to nothing. */}
      {/* Stops above the control row: running the canvas to the bottom put the
          status pill and Hear Maya button across her chest. */}
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
              Taking this session
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute Maya" : "Mute Maya"}
          className="grid h-8 w-8 place-items-center rounded-lg text-cream/55 transition hover:bg-cream/[0.1] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/40"
        >
          {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
        </button>
      </div>

      <div aria-hidden="true" className="min-h-0 flex-1" />

      <div className="relative z-20 px-5 pb-5">
        {blocked && !muted ? (
          <button
            type="button"
            onClick={onWake}
            className="inline-flex items-center gap-2 rounded-full bg-cream px-3.5 py-1.5 text-[12px] font-semibold text-[#1d3a86] transition hover:bg-white"
          >
            <Volume2 size={13} aria-hidden="true" />
            Hear Maya
          </button>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
              speaking ? "bg-[#8be6bd]/12 text-[#a9f0d0]" : "bg-cream/[0.07] text-cream/45"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${speaking ? "bg-[#8be6bd]" : "bg-cream/35"}`}
            />
            {speaking ? "Speaking" : muted ? "Muted" : "Ready"}
          </span>
        )}
      </div>
    </div>
  );
}

function BriefPanel({
  beat,
  step,
  total,
  voiceState,
  onBack,
  onNext,
  onSkip,
  onReplay,
  isLast
}: {
  beat: BriefBeat;
  step: number;
  total: number;
  voiceState: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onReplay: () => void;
  isLast: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" role="img" aria-label={`Step ${step + 1} of ${total}`}>
          {Array.from({ length: total }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === step ? "w-6 bg-cream" : index < step ? "w-1.5 bg-cream/45" : "w-1.5 bg-cream/20"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-[11.5px] font-medium text-cream/30 sm:flex">
            <kbd className="rounded border border-cream/15 px-1.5 py-0.5 font-sans text-[10px]">
              ←
            </kbd>
            <kbd className="rounded border border-cream/15 px-1.5 py-0.5 font-sans text-[10px]">
              →
            </kbd>
            to move
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="text-[12px] font-semibold text-cream/45 transition hover:text-cream"
          >
            Skip briefing
          </button>
        </div>
      </div>

      {/* Centred, because the opening and closing beats carry no bullet list and
          top-aligning them left a large hole above the footer. */}
      <div key={beat.id} className="fade-slide mt-6 flex min-h-0 flex-1 flex-col justify-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/50">
          {beat.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-9 tracking-tight text-cream sm:text-[2rem] sm:leading-10">
          {beat.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-cream/70">{beat.body}</p>

        {beat.points.length ? (
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {beat.points.map((point) => (
              <li
                key={point}
                className="flex gap-2.5 rounded-xl bg-[#24439b] p-3.5 text-[13.5px] leading-6 text-cream/78"
              >
                <CircleDot size={14} aria-hidden="true" className="mt-1 shrink-0 text-cream/35" />
                <span className="min-w-0">{point}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-cream/[0.09] pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-cream/60 transition hover:bg-cream/[0.08] hover:text-cream disabled:pointer-events-none disabled:opacity-35"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-cream/60 transition hover:bg-cream/[0.08] hover:text-cream"
        >
          {voiceState === "loading" ? (
            <Loader2 size={15} aria-hidden="true" className="animate-spin" />
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
          Hear again
        </button>
        <button
          type="button"
          onClick={onNext}
          className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-5 text-[14px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {isLast ? "Start solving" : "Continue"}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

function SolvePanel({
  brief,
  detail,
  onReplayBriefing
}: {
  brief: ChapterBrief;
  detail: FrontendRoadmapChapterDetail | null;
  onReplayBriefing: () => void;
}) {
  // Without saved progress we still list the chapter, just without state.
  const rows = useMemo(() => {
    if (detail?.questions.length) return detail.questions;
    return [];
  }, [detail]);

  const nextSlug = detail?.nextQuestionSlug ?? brief.firstQuestionSlug;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/50">
            Your turn
          </p>
          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-9 tracking-tight text-cream">
            {brief.title}
          </h1>
        </div>
        <button
          type="button"
          onClick={onReplayBriefing}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-cream/[0.08] px-3 text-[12.5px] font-semibold text-cream/70 transition hover:bg-cream/[0.13] hover:text-cream"
        >
          <Sparkles size={14} aria-hidden="true" />
          Replay briefing
        </button>
      </div>

      {detail ? (
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#1e3c88]">
            <span
              className="block h-full rounded-full bg-[#8be6bd] transition-all"
              style={{ width: `${Math.round(detail.progressPercent)}%` }}
            />
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-cream/70">
            {detail.completedQuestions}/{detail.totalQuestions}
          </span>
        </div>
      ) : null}

      <ol className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {rows.length ? (
          rows.map((question) => (
            <QuestionRow
              key={question.slug}
              slug={question.slug}
              title={question.title}
              difficulty={question.difficulty}
              minutes={question.minutes}
              status={question.status}
              isNext={question.slug === detail?.nextQuestionSlug}
            />
          ))
        ) : (
          <li className="rounded-xl bg-[#24439b] p-4 text-[13.5px] leading-6 text-cream/60">
            This chapter is not part of your saved roadmap yet. Open it from Home to start tracking
            progress.
          </li>
        )}
      </ol>

      {nextSlug ? (
        <div className="mt-5 border-t border-cream/[0.09] pt-5">
          <Link
            href={`/dsa-questions/${nextSlug}`}
            className="group flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-gradient-to-b from-[#f7f2e5] to-[#e4dcc6] px-4 text-[14px] font-semibold text-[#1d3a86] transition hover:from-white hover:to-[#efe8d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="min-w-0 truncate">
              {detail?.completedQuestions ? "Continue where you left off" : "Solve the first question"}
            </span>
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-[#8be6bd]/10 p-4 text-[13.5px] font-medium text-[#a9f0d0]">
          <Check size={16} aria-hidden="true" />
          Chapter complete. Maya has moved your path to the next pattern.
        </div>
      )}
    </>
  );
}

const DIFFICULTY_TONE: Record<string, string> = {
  easy: "text-[#8be6bd]",
  medium: "text-[#f4d58b]",
  hard: "text-[#f0a3a3]"
};

function QuestionRow({
  slug,
  title,
  difficulty,
  minutes,
  status,
  isNext
}: {
  slug: string;
  title: string;
  difficulty: string;
  minutes: number;
  status: string;
  isNext: boolean;
}) {
  const done = status === "COMPLETED";
  const skipped = status === "SKIPPED";

  return (
    <li>
      <Link
        href={`/dsa-questions/${slug}`}
        className={`group flex items-center gap-3 rounded-xl p-3.5 transition ${
          isNext ? "bg-[#2f56b8] ring-1 ring-inset ring-cream/20" : "bg-[#24439b] hover:bg-[#27479f]"
        }`}
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
            done
              ? "bg-[#8be6bd]/15 text-[#8be6bd]"
              : skipped
                ? "bg-cream/[0.07] text-cream/40"
                : "bg-cream/[0.07] text-cream/45"
          }`}
        >
          {done ? (
            <Check size={14} aria-hidden="true" />
          ) : skipped ? (
            <SkipForward size={13} aria-hidden="true" />
          ) : (
            <CircleDot size={13} aria-hidden="true" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[14px] font-semibold ${
              done ? "text-cream/50 line-through decoration-cream/25" : "text-cream/85"
            }`}
          >
            {title}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[12px] font-medium text-cream/42">
            <span className={DIFFICULTY_TONE[difficulty] ?? "text-cream/50"}>{difficulty}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={10} aria-hidden="true" />
              {minutes}m
            </span>
            {isNext ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-cream/70">up next</span>
              </>
            ) : null}
          </span>
        </span>

        <ArrowRight
          size={15}
          aria-hidden="true"
          className="shrink-0 text-cream/25 transition group-hover:translate-x-0.5 group-hover:text-cream/60"
        />
      </Link>
    </li>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-[#2a4aa0] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-cream/45">{label}</p>
      <p className="mt-2 font-display text-[1.6rem] font-semibold tracking-tight text-cream">
        {value}
      </p>
      <p className="mt-1 text-[12.5px] font-medium text-cream/45">{hint}</p>
    </div>
  );
}
