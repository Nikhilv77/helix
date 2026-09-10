import { roundCaps, type InterviewState } from "./types";

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
    state.setup.dsaBlockAssessment?.kind === "dsa-block-assessment" && state.phase !== "done";

  return resumableBlockAssessment ? hardCapMs : hardCapMs - (now - state.startedAt);
}
