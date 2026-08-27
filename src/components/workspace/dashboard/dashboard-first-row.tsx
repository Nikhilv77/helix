"use client";

import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useRef } from "react";
import {
  ArrowRight,
  Loader2,
  RotateCcw,
  Square,
  Volume2
} from "lucide-react";
import { MayaStage } from "@/components/workspace/shared/maya/maya-stage";
import type { DashboardOverviewData } from "@/lib/dashboard/dashboard-overview";
import { useMayaVoice } from "@/lib/voice/use-maya-voice";

export function DashboardFirstRow({ data }: { data: DashboardOverviewData }) {
  const voiceAttempted = useRef(false);
  const { state, speak, stop, awaitingGesture } = useMayaVoice();
  const speaking = state === "loading" || state === "speaking";

  const speakSummary = useCallback(() => {
    if (voiceAttempted.current) return;
    voiceAttempted.current = true;
    void speak(data.coaching.spokenSummary).then((result) => {
      if (result !== "started") voiceAttempted.current = false;
    });
  }, [data.coaching.spokenSummary, speak]);

  useEffect(() => {
    voiceAttempted.current = false;
    const timer = window.setTimeout(speakSummary, 650);
    return () => window.clearTimeout(timer);
  }, [speakSummary]);

  const toggleVoice = () => {
    if (speaking) {
      stop();
      return;
    }
    voiceAttempted.current = false;
    speakSummary();
  };

  return (
    <section
      aria-label="Overview highlights"
      className="grid min-w-0 gap-4 lg:grid-cols-3 lg:gap-5"
    >
      <article
        aria-label="Teacher"
        className="dashboard-overview-card relative flex min-h-[17rem] min-w-0 flex-col overflow-hidden rounded-[1.4rem] border border-cream/[0.08] bg-[#17181b]"
      >
        <div className="relative h-full min-h-[17rem] overflow-hidden">
          <div
            className="absolute inset-x-[-8%] bottom-[-8%] top-[-14%]"
            style={{
              maskImage: "linear-gradient(180deg,#000 0%,#000 74%,transparent 100%)",
              WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 74%,transparent 100%)"
            }}
          >
            <MayaStage speaking={speaking} transparent />
          </div>
        </div>
      </article>

      <article
        aria-label="Coaching summary"
        className="dashboard-overview-card relative flex min-h-[17rem] min-w-0 flex-col overflow-hidden rounded-[1.4rem] border border-cream/[0.08] bg-[#17181b] p-5"
      >
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={speaking ? "Stop teacher summary" : "Play teacher summary"}
          className="absolute right-5 top-5 z-20 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cream/[0.055] text-cream/62 transition hover:bg-cream/[0.1] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
        >
          {state === "loading" ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : state === "speaking" ? (
            <Square size={13} fill="currentColor" aria-hidden="true" />
          ) : state === "unavailable" ? (
            <RotateCcw size={15} aria-hidden="true" />
          ) : (
            <Volume2 size={16} aria-hidden="true" />
          )}
        </button>

        <h2 className="relative z-10 mt-1 pr-12 text-[1.18rem] font-semibold leading-7 tracking-[-0.02em] text-cream">
          <StaggeredWords text={data.coaching.title} baseMs={70} />
        </h2>
        <p className="relative z-10 mt-3 text-[14px] leading-6 text-cream/55">
          <StaggeredWords text={data.coaching.body} baseMs={250} stepMs={20} />
        </p>

        <div className="relative z-10 mt-auto flex items-end justify-between gap-4 pt-5">
          {state === "unavailable" || awaitingGesture || speaking ? (
            <p className="text-[11px] leading-4 text-cream/34" aria-live="polite">
              {state === "unavailable"
                ? "Voice unavailable"
                : awaitingGesture
                  ? "Tap the speaker to listen"
                  : "Voice summary playing"}
            </p>
          ) : (
            <span />
          )}
          <Link
            href={data.coaching.actionHref}
            className="group inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-cream/72 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)]"
          >
            {data.coaching.actionLabel}
            <ArrowRight
              size={14}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </article>

      <ReadinessCard readiness={data.readiness} />
    </section>
  );
}

function ReadinessCard({ readiness }: { readiness: DashboardOverviewData["readiness"] }) {
  if (readiness.status !== "scored" || readiness.score === null) {
    return (
      <article
        aria-label="Interview readiness"
        className="relative flex min-h-[17rem] min-w-0 flex-col justify-center overflow-hidden bg-transparent px-5 py-8"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/40">
          <StaggeredWords text="Interview readiness" baseMs={120} />
        </p>
        <h2 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.02em] text-cream">
          <StaggeredWords text={readiness.label} baseMs={280} />
        </h2>
        <p className="mt-3 max-w-sm text-[14px] leading-6 text-cream/55">
          <StaggeredWords text={readiness.detail} baseMs={430} stepMs={34} />
        </p>
      </article>
    );
  }

  const score = readiness.score;

  return (
    <article
      aria-label="Interview readiness"
      className="relative flex min-h-[17rem] min-w-0 flex-col items-center overflow-hidden bg-transparent px-5 py-5 text-center"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/40">
        <StaggeredWords text="Interview readiness" baseMs={120} />
      </p>
      <h2 className="mt-1.5 text-lg font-semibold text-cream">
        <StaggeredWords text={readiness.label} baseMs={260} />
      </h2>

      <div
        className="relative my-auto grid h-36 w-36 place-items-center"
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
        <span className="font-mono text-[2rem] font-medium tracking-[-0.04em] text-cream">
          {score}%
        </span>
      </div>

      <p className="max-w-[17rem] text-[13px] leading-5 text-cream/48">
        <StaggeredWords text={readiness.detail} baseMs={520} stepMs={30} />
      </p>
    </article>
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
