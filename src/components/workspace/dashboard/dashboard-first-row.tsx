"use client";

import Link from "next/link";
import { type CSSProperties } from "react";
import {
  ArrowRight,
  Loader2,
  RotateCcw,
  Square,
  TrendingDown,
  TrendingUp,
  Volume2
} from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import type { DashboardOverviewData } from "@/lib/dashboard/dashboard-overview";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";

export function DashboardFirstRow({
  data
}: {
  data: Pick<DashboardOverviewData, "coaching" | "readiness">;
}) {
  const { state, speak, stop, awaitingGesture } = useMayaVoice();
  const speaking = state === "loading" || state === "speaking";

  const toggleVoice = () => {
    if (speaking) {
      stop();
      return;
    }
    void speak(data.coaching.spokenSummary);
  };

  return (
    <section
      aria-label="Overview highlights"
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-5"
    >
      <article
        aria-label="Teacher coaching"
        className="dashboard-overview-card relative min-h-[21rem] min-w-0 overflow-hidden rounded-[1.65rem] bg-[#17181b] shadow-[0_24px_80px_-58px_rgba(0,0,0,0.95)]"
      >
        <div className="relative grid h-full min-h-[21rem] md:grid-cols-[minmax(14rem,0.82fr)_minmax(0,1.18fr)]">
          <div className="relative min-h-[17rem] overflow-hidden bg-black/10 md:min-h-[21rem]">
            <div
              className="absolute inset-x-[-8%] bottom-[-8%] top-[-14%]"
              style={{
                maskImage: "linear-gradient(180deg,#000 0%,#000 78%,transparent 100%)",
                WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 78%,transparent 100%)"
              }}
            >
              <MayaStage speaking={speaking} transparent />
            </div>
          </div>

          <div className="relative z-10 flex min-h-[21rem] min-w-0 flex-col p-5 sm:p-6 lg:p-7">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={speaking ? "Stop teacher summary" : "Play teacher summary"}
                title={speaking ? "Stop teacher summary" : "Listen to teacher summary"}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cream/[0.07] bg-cream/[0.045] text-cream/58 transition hover:bg-cream/[0.09] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
              >
                {state === "loading" ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : state === "speaking" ? (
                  <Square size={13} fill="currentColor" aria-hidden="true" />
                ) : state === "unavailable" ? (
                  <RotateCcw size={16} aria-hidden="true" />
                ) : (
                  <Volume2 size={17} aria-hidden="true" />
                )}
              </button>
            </div>

            <h2 className="relative z-10 mt-3 max-w-[30rem] text-[1.45rem] font-semibold leading-[1.2] tracking-[-0.025em] text-cream sm:text-[1.65rem]">
              <StaggeredWords text={data.coaching.title} baseMs={70} />
            </h2>
            <p className="relative z-10 mt-4 max-w-[34rem] text-[14px] leading-6 text-cream/56">
              <StaggeredWords text={data.coaching.body} baseMs={250} stepMs={20} />
            </p>

            <div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-4 pt-7">
              <p className="min-h-4 text-[11px] leading-4 text-cream/34" aria-live="polite">
                {state === "unavailable"
                  ? "Voice unavailable — tap to retry"
                  : awaitingGesture
                    ? "Tap to hear the summary"
                    : speaking
                      ? "Teacher summary is playing"
                      : ""}
              </p>
              <Link
                href={data.coaching.actionHref}
                className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cream px-4 text-[13px] font-semibold text-[#171a16] shadow-[0_12px_30px_-20px_rgba(239,232,214,0.9)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181b]"
              >
                {data.coaching.actionLabel}
                <ArrowRight
                  size={15}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </div>
      </article>

      <ReadinessCard readiness={data.readiness} />
    </section>
  );
}

function ReadinessCard({ readiness }: { readiness: DashboardOverviewData["readiness"] }) {
  if (readiness.status === "forming") {
    return (
      <article
        aria-label="Interview readiness"
        className="dashboard-overview-card relative flex min-h-[21rem] min-w-0 flex-col items-start justify-center overflow-hidden rounded-[1.65rem] bg-[#151619] px-7 py-8"
      >
        <h2 className="max-w-[17rem] text-[1.55rem] font-semibold leading-tight tracking-[-0.025em] text-cream">
          <StaggeredWords text="Take your first interview" baseMs={120} />
        </h2>
        <p className="mt-4 max-w-[18rem] text-[14px] leading-6 text-cream/52">
          <StaggeredWords
            text="Complete one interview to establish your readiness score and receive evidence-based coaching."
            baseMs={260}
            stepMs={24}
          />
        </p>
        <Link
          href="/interview"
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cream px-4 text-[13px] font-semibold text-[#171a16] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#151619]"
        >
          Start interview <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </article>
    );
  }

  if (readiness.status !== "scored" || readiness.score === null) {
    return (
      <article
        aria-label="Interview readiness"
        className="dashboard-overview-card relative flex min-h-[21rem] min-w-0 flex-col items-start justify-center overflow-hidden rounded-[1.65rem] bg-[#151619] px-7 py-8"
      >
        <h2 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-cream">
          {readiness.label}
        </h2>
        <p className="mt-3 max-w-[18rem] text-[14px] leading-6 text-cream/52">{readiness.detail}</p>
        <Link
          href="/interview"
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cream px-4 text-[13px] font-semibold text-[#171a16] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#151619]"
        >
          Open interviews <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </article>
    );
  }

  const score = readiness.score;

  return (
    <article
      aria-label="Interview readiness"
      className="dashboard-overview-card relative flex h-[21rem] min-w-0 flex-col items-center overflow-hidden rounded-[1.65rem] bg-[#151619] px-6 py-5 text-center"
    >
      <div className="relative flex w-full items-start justify-between gap-3 text-left">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-cream/40">
          <StaggeredWords text="Interview readiness" baseMs={120} />
        </p>
        <ReadinessDelta delta={readiness.delta} />
      </div>
      <h2 className="relative mt-2 text-lg font-semibold text-cream">
        <StaggeredWords text={readiness.label} baseMs={260} />
      </h2>

      <div
        className="relative mt-3 grid h-28 w-28 shrink-0 place-items-center"
        role="img"
        aria-label={`Readiness score ${score} out of 100`}
      >
        <svg
          viewBox="0 0 140 140"
          className="absolute inset-0 h-full w-full rotate-[135deg] overflow-visible"
          aria-hidden="true"
        >
          <circle
            cx="70"
            cy="70"
            r="55"
            fill="none"
            stroke="rgba(241, 234, 216, 0.07)"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r="55"
            pathLength="100"
            fill="none"
            stroke="var(--workspace-accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${score} ${100 - score}`}
            style={{
              filter:
                "drop-shadow(0 8px 12px color-mix(in srgb, var(--workspace-accent) 22%, transparent))"
            }}
          />
        </svg>
        <span className="font-mono text-[1.7rem] font-medium tracking-[-0.04em] text-cream">
          {score}%
        </span>
      </div>

      <div className="relative mt-3 w-full rounded-2xl bg-black/20 px-4 py-3 text-left">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cream/34">
          What this means
        </p>
        <p className="mt-1.5 text-[11.5px] font-medium leading-[1.45] text-cream/70">
          {readinessSummary(score)}
        </p>
        <p className="mt-1.5 text-[10px] leading-4 text-cream/34">
          <StaggeredWords text={readiness.detail} baseMs={520} stepMs={30} />
        </p>
      </div>
    </article>
  );
}

function readinessSummary(score: number): string {
  if (score >= 75) {
    return "Your answers are holding up consistently. Keep making examples and trade-offs more specific.";
  }

  if (score >= 45) {
    return "Your foundation is taking shape. Make each answer more structured, specific, and evidence-led.";
  }

  return "Your signal is still early. Use one clear structure and support every answer with evidence.";
}

function ReadinessDelta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="rounded-full border border-cream/[0.07] bg-cream/[0.035] px-2.5 py-1 text-[10px] font-semibold text-cream/42">
        Baseline
      </span>
    );
  }

  if (delta === 0) {
    return (
      <span className="rounded-full border border-cream/[0.07] bg-cream/[0.035] px-2.5 py-1 text-[10px] font-semibold text-cream/42">
        No change
      </span>
    );
  }

  const improving = delta > 0;
  const Icon = improving ? TrendingUp : TrendingDown;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
        improving
          ? "border-[#9be8c1]/15 bg-[#71d6a5]/10 text-[#a9ebc9]"
          : "border-[#ffb4b4]/15 bg-[#ff8f8f]/[0.08] text-[#ffc1c1]"
      }`}
    >
      <Icon size={11} aria-hidden="true" />
      {improving ? "+" : ""}
      {delta} pts
    </span>
  );
}

function StaggeredWords({
  text,
  baseMs = 0,
  stepMs = 38
}: {
  text: string;
  baseMs?: number;
  stepMs?: number;
}) {
  return (
    <span
      aria-label={text}
      className="stagger-line"
      data-phase="in"
      style={
        {
          "--base": `${baseMs}ms`,
          "--step": `${stepMs}ms`
        } as CSSProperties
      }
    >
      {text.split(/\s+/).map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden="true"
          className="stagger-word mr-[0.24em] last:mr-0"
          style={{ "--i": index } as CSSProperties}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
