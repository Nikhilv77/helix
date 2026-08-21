import { RoadmapProgressStatus, RoadmapQuestionAttemptStatus } from "@prisma/client";
import type { RoadmapQuestionAttemptAction } from "./types";

export function attemptStatus(action: RoadmapQuestionAttemptAction): RoadmapQuestionAttemptStatus {
  if (action === "complete") return RoadmapQuestionAttemptStatus.COMPLETED;
  if (action === "skip") return RoadmapQuestionAttemptStatus.SKIPPED;
  if (action === "submit") return RoadmapQuestionAttemptStatus.SUBMITTED;
  return RoadmapQuestionAttemptStatus.STARTED;
}

export function questionStatusAfterAction(
  current: RoadmapProgressStatus,
  action: RoadmapQuestionAttemptAction
): RoadmapProgressStatus {
  if (action === "complete") return RoadmapProgressStatus.COMPLETED;
  if (action === "skip") return RoadmapProgressStatus.SKIPPED;
  if (current === RoadmapProgressStatus.COMPLETED) return RoadmapProgressStatus.COMPLETED;
  return RoadmapProgressStatus.IN_PROGRESS;
}

export function normalizedScore(
  score: number | null | undefined,
  action: RoadmapQuestionAttemptAction
): number | null {
  if (typeof score === "number" && Number.isFinite(score)) {
    return Math.max(0, Math.min(1, score));
  }
  return action === "complete" ? 1 : null;
}
