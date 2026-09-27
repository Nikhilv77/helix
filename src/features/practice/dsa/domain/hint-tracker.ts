"use client";

/**
 * How many hints the coach has given out, readable from the editor beside it.
 *
 * QuestionCoach and DsaQuestionWorkspace are siblings in two different columns
 * of a server-rendered page, so neither can hold state for the other and the
 * page itself cannot hold it for them. A module-level store is how this codebase
 * already bridges that gap for the voice analyser — same reasoning here.
 *
 * The number matters: a help request carries it, and the stuck summary uses a
 * high count to tell a helper that the AI explanation is not landing, which is
 * the single strongest signal in the whole briefing.
 */

const counts = new Map<string, number>();

/** Called by the coach whenever another hint is revealed. */
export function recordHintsUsed(slug: string, used: number): void {
  counts.set(slug, used);
}

/** Zero for a question whose coach has not been mounted or asked. */
export function hintsUsedFor(slug: string): number {
  return counts.get(slug) ?? 0;
}

export const DSA_NEXT_HINT_EVENT = "trailgrad:dsa-next-hint";

/**
 * Asks the problem panel (the other column) to open its hints and reveal the
 * next one; used when a Trailmate request ends without a mate.
 */
export function requestNextHint(slug: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DSA_NEXT_HINT_EVENT, { detail: { slug } }));
}

/**
 * Only for tests. The store is per browser session and bounded by the number of
 * questions visited, so it is never cleared in normal use.
 */
export function resetHintTracker(): void {
  counts.clear();
}
