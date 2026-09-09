"use client";

import { Check } from "lucide-react";
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

  return (
    <div className="flex items-center gap-2.5">
      {Array.from({ length: questionCount }, (_, index) => {
        const state = stateFor(index);

        return (
          <div key={index} className="flex items-center gap-2.5">
            <Node state={state} label={String(index + 1)} />
            {state === "active" ? (
              <FollowUpPips used={followUpCount} maximum={maxFollowUps} />
            ) : null}
            {index < questionCount - 1 ? <Connector filled={state === "done"} /> : null}
          </div>
        );
      })}

      <Connector filled={phase === "wrap" || finished} />
      <Node state={wrapState} label="W" title="Wrap" />
    </div>
  );
}

function Node({ state, label, title }: { state: NodeState; label: string; title?: string }) {
  const styles =
    state === "done"
      ? "border-cream/70 bg-cream/70 text-blueprint"
      : state === "active"
        ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent)] text-black shadow-[0_0_0_4px_var(--workspace-accent-soft)]"
        : "border-cream/25 text-cream/35";

  return (
    <span
      title={title}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] transition-all duration-300 ${styles}`}
    >
      {state === "done" ? <Check size={11} aria-hidden="true" /> : label}
    </span>
  );
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <span
      className={`h-px w-4 shrink-0 transition-colors duration-300 ${filled ? "bg-cream/50" : "bg-cream/15"}`}
    />
  );
}

/** How much of the follow-up budget this question has burned. */
function FollowUpPips({ used, maximum }: { used: number; maximum: number }) {
  if (maximum <= 0) return null;
  return (
    <span className="flex items-center gap-1" title={`${used} of ${maximum} follow-ups`}>
      {Array.from({ length: maximum }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${index < used ? "bg-[var(--workspace-accent)]" : "bg-cream/20"}`}
        />
      ))}
    </span>
  );
}
