"use client";

import type { Phase } from "@/lib/shared/types";

interface PathRailProps {
  phase: Phase;
  questionIndex: number;
  questionCount: number;
  followUpCount: number;
  maxFollowUps?: number;
}

type NodeState = "done" | "active" | "upcoming";

/**
 * The interview path.
 *
 * Deliberately shows position and nothing else — the planned question text is
 * available in state, but revealing what is coming would let the candidate
 * prepare, which is the whole thing this product is trying to prevent.
 */
export function PathRail({
  phase,
  questionIndex,
  questionCount,
  followUpCount,
  maxFollowUps = 2
}: PathRailProps) {
  const finished = phase === "done";

  function stateFor(index: number): NodeState {
    if (finished) return "done";
    if (phase === "wrap") return "done";
    if (index < questionIndex) return "done";
    if (index === questionIndex) return "active";
    return "upcoming";
  }

  const wrapState: NodeState = finished ? "done" : phase === "wrap" ? "active" : "upcoming";
  const label = finished
    ? "Interview complete"
    : phase === "wrap"
      ? "Wrapping up"
      : `Question ${Math.min(questionIndex + 1, questionCount)} of ${questionCount}`;
  const doneCount = finished || phase === "wrap" ? questionCount : Math.min(questionIndex, questionCount);

  return (
    <div className="flex min-w-[15rem] items-center gap-4">
      <p className="shrink-0 text-[13px] font-semibold text-cream">
        {label}
        {!finished && phase !== "wrap" && followUpCount > 0 ? (
          <span className="font-medium text-cream/48">
            {" "}
            · Follow-up {Math.min(followUpCount, maxFollowUps)} of {maxFollowUps}
          </span>
        ) : null}
      </p>
      <div
        className="flex min-w-[8rem] flex-1 items-center gap-1"
        role="progressbar"
        aria-label="Interview progress"
        aria-valuemin={0}
        aria-valuemax={questionCount}
        aria-valuenow={doneCount}
      >
        {Array.from({ length: questionCount }, (_, index) => (
          <Segment key={index} state={stateFor(index)} />
        ))}
        <Segment state={wrapState} short title="Wrap-up" />
      </div>
    </div>
  );
}

/** One question's slice of the bar: filled when done, half-filled when current. */
function Segment({ state, short = false, title }: { state: NodeState; short?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`path-rail-track relative h-1 overflow-hidden rounded-full ${short ? "w-5 shrink-0" : "flex-1"}`}
    >
      <span
        className={`absolute inset-0 origin-left rounded-full bg-[var(--workspace-accent)] transition-transform duration-500 motion-reduce:transition-none ${
          state === "done" ? "scale-x-100" : state === "active" ? "scale-x-50" : "scale-x-0"
        }`}
      />
    </span>
  );
}
