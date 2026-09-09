/**
 * Interruption watchdog.
 *
 * Deliberately source-agnostic: it takes an elapsed duration and the text so
 * far, nothing else. In text mode that duration comes from a typing timer; in
 * voice mode it will come from speech duration and partial STT. Same
 * thresholds, same utterances, no rewrite when voice lands.
 */

export const SOFT_INTERRUPT_MS = 60_000;
export const HARD_INTERRUPT_MS = 90_000;
/** Never interrupt twice in a row without the agent speaking in between. */
export const INTERRUPT_COOLDOWN_MS = 10_000;

/**
 * Cheap lexical check for "they landed the point". Someone who reaches an
 * outcome at 80 seconds should not get cut off.
 */
const OUTCOME_MARKERS =
  /\b(\d+\s*(%|percent|x|ms|s|qps|rps)|so we|so i|ended up|resulted in|the result|the outcome|which meant|in the end|we shipped|i shipped|we cut|i cut|reduced|dropped by|went from)\b/i;

const ROLE_MARKERS = /\b(i built|i wrote|i designed|i led|i owned|i decided|my job|i chose)\b/i;

export interface SpeechWindow {
  elapsedMs: number;
  text: string;
}

export type InterruptReason = "no-point" | "hard-cap";

export interface InterruptDecision {
  reason: InterruptReason;
  /** Targets whatever the answer is still missing. */
  utterance: string;
}

export function hasReachedPoint(text: string): boolean {
  return OUTCOME_MARKERS.test(text);
}

export function evaluateInterruption(window: SpeechWindow): InterruptDecision | null {
  const { elapsedMs, text } = window;

  if (elapsedMs < SOFT_INTERRUPT_MS) {
    return null;
  }

  if (elapsedMs >= HARD_INTERRUPT_MS) {
    return { reason: "hard-cap", utterance: pickUtterance(text) };
  }

  if (!hasReachedPoint(text)) {
    return { reason: "no-point", utterance: pickUtterance(text) };
  }

  return null;
}

function pickUtterance(text: string): string {
  if (!hasReachedPoint(text)) {
    return "Let me stop you there — what was the outcome?";
  }

  if (!ROLE_MARKERS.test(text)) {
    return "Let me stop you there — which part of that was yours?";
  }

  return "Let me stop you there — give me the one number that changed.";
}
