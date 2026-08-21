"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Mic, Play, Sparkles } from "lucide-react";
import type { Curriculum, CurriculumSession } from "@/lib/curriculum/curriculum";
import { ROUND_LABEL } from "@/lib/curriculum/curriculum";
import type { RoundType } from "@/lib/shared/types";

const roundTone: Record<RoundType, string> = {
  behavioral: "bg-cream/[0.13] text-cream/82 shadow-soft-inset",
  technical: "bg-[#9fc4ff]/18 text-[#d8e5ff] shadow-soft-inset",
  "hiring-manager": "bg-[#71d6a5]/18 text-[#b5efd2] shadow-soft-inset"
};

interface SessionPlanProps {
  /** Server-rendered when Maya has already written the plan. */
  initial: Curriculum | null;
  /** Session ids the candidate has already interviewed on. */
  completedIds: string[];
  locked?: boolean;
}

export function SessionPlan({ initial, completedIds, locked = false }: SessionPlanProps) {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(initial);
  const [failed, setFailed] = useState(false);

  // Only ever runs the first time a candidate reaches the workspace: the plan
  // is written once and stored against their profile.
  useEffect(() => {
    if (curriculum || failed) return;
    let cancelled = false;

    void fetch("/api/curriculum", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((payload: { data: Curriculum }) => {
        if (!cancelled) setCurriculum(payload.data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [curriculum, failed]);

  if (!curriculum) {
    return <PlanBuilding failed={failed} />;
  }

  const done = new Set(completedIds);
  const nextUp = curriculum.sessions.find((session) => !done.has(session.id));

  return (
    <section id="sessions-plan" className="mt-10 scroll-mt-20 lg:scroll-mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-cream">Your sessions</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream/45">{curriculum.headline}</p>
        </div>

        <Link
          href={locked ? "#" : "/interview?resume=1"}
          aria-disabled={locked}
          className={[
            "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-5 text-sm font-semibold text-cream shadow-soft-inset transition",
            locked ? "pointer-events-none opacity-40" : "hover:bg-white/[0.12] hover:text-cream"
          ].join(" ")}
        >
          <Mic size={14} /> Full interview across all sessions
        </Link>
      </div>

      <ol className="mt-6 grid gap-3">
        {curriculum.sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            complete={done.has(session.id)}
            isNext={session.id === nextUp?.id}
            locked={locked}
          />
        ))}
      </ol>
    </section>
  );
}

function SessionRow({
  session,
  complete,
  isNext,
  locked
}: {
  session: CurriculumSession;
  complete: boolean;
  isNext: boolean;
  locked: boolean;
}) {
  return (
    <li>
      <Link
        href={`/session/${session.id}`}
        className={[
          "surface surface-interactive group flex flex-col gap-4 p-5 outline-none sm:flex-row sm:items-center sm:gap-5 sm:p-6",
          locked
            ? "pointer-events-none opacity-40"
            : "focus-visible:ring-2 focus-visible:ring-cream/60"
        ].join(" ")}
      >
        <span
          className={[
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-mono text-xs font-semibold shadow-soft-inset",
            complete
              ? "bg-[#71d6a5]/22 text-[#a9f0cd]"
              : isNext
                ? "bg-cream text-blueprint shadow-[0_18px_44px_-26px_rgba(239,232,214,0.75)]"
                : "bg-white/[0.07] text-cream/55"
          ].join(" ")}
        >
          {complete ? <CheckCircle2 size={18} /> : String(session.order).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-cream">{session.title}</h3>
            {isNext && !complete ? (
              <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-blueprint">
                Next up
              </span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-cream/50">{session.summary}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${roundTone[session.roundType]}`}
            >
              {ROUND_LABEL[session.roundType]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-cream/52 shadow-soft-inset">
              <Clock3 size={11} /> {session.minutes} min
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-cream/52 shadow-soft-inset">
              <Sparkles size={11} /> {session.keyIdeas.length} things to learn
            </span>
          </div>
        </div>

        <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/[0.055] px-4 text-sm font-semibold text-cream/65 shadow-soft-inset transition group-hover:bg-white/[0.11] group-hover:text-cream">
          {complete ? "Review" : "Open session"}
          <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}

function PlanBuilding({ failed }: { failed: boolean }) {
  return (
    <section className="mt-10">
      <h2 className="text-3xl font-semibold tracking-tight text-cream">Your sessions</h2>

      {failed ? (
        <div className="surface mt-6 p-6">
          <p className="text-sm text-cream/70">
            Maya could not build your plan just now. Refresh and she will try again.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream/45">
            Maya is reading your resume and writing a plan around it. This happens once.
          </p>
          <div className="mt-6 grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="surface flex items-center gap-5 p-5">
                <div className="skeleton h-12 w-12 !rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="skeleton h-4 w-56" />
                  <div className="skeleton mt-2.5 h-3 w-full max-w-md" />
                  <div className="mt-3 flex gap-2">
                    <div className="skeleton h-5 w-20 !rounded-full" />
                    <div className="skeleton h-5 w-16 !rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Shown on the session page: the one action that starts the round. */
export function StartSessionButton({ sessionId }: { sessionId: string }) {
  return (
    <Link
      href={`/interview?session=${sessionId}`}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cream px-6 text-sm font-semibold text-blueprint shadow-[0_14px_34px_rgba(7,18,58,0.32)] transition hover:bg-white"
    >
      <Play size={15} fill="currentColor" /> Start this session
    </Link>
  );
}
