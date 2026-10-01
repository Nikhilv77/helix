import { isResumableBlockAssessment, roundCaps, type InterviewState } from "./types";

/**
 * Ordinary interviews expire against their original wall-clock deadline.
 * Incomplete DSA block assessments are deliberately resumable, so each room
 * connection receives one fresh, bounded lease instead of inheriting an
 * already-expired deadline from the original assessment start.
 */
export function voiceConnectionLifetimeMs(
  state: Pick<InterviewState, "phase" | "setup" | "startedAt">,
  now = Date.now()
): number {
  const hardCapMs = roundCaps(state.setup).hardCapMs;
  const resumableBlockAssessment =
    isResumableBlockAssessment(state.setup) && state.phase !== "done";

  return resumableBlockAssessment ? hardCapMs : hardCapMs - (now - state.startedAt);
}

/**
 * An unfinished round whose own time limit has passed. It can never be
 * entered again (the voice token refuses it), so it must not be shown or
 * reused as "in progress", however recently it was touched.
 */
export function roundTimeExpired(
  state: Pick<InterviewState, "phase" | "setup" | "startedAt">,
  now = Date.now()
): boolean {
  return state.phase !== "done" && voiceConnectionLifetimeMs(state, now) <= 0;
}

/** When an unfinished round stops being enterable, for cache expiry. */
export function roundTimeLimitAt(
  state: Pick<InterviewState, "setup" | "startedAt">
): number | null {
  if (isResumableBlockAssessment(state.setup)) return null;
  return state.startedAt + roundCaps(state.setup).hardCapMs;
}
