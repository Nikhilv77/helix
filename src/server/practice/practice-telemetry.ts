import type { PrepPracticeReview } from "@/lib/practice/prep-practice";
import { isApiRouteError } from "../http/api-error";
import { Logger } from "../common/logger";

export const PRACTICE_ALERT_SIGNALS = {
  stateSaveOutage: "practice-state-save-outage",
  evaluatorOutage: "practice-evaluator-outage"
} as const;

export const PRACTICE_ALERT_POLICY = {
  stateSaveOutage: { windowSeconds: 300, threshold: 10 },
  evaluatorOutage: { windowSeconds: 300, threshold: 5 }
} as const;

type PracticeLogSink = Pick<Logger, "log" | "warn">;

export class PracticeTelemetry {
  constructor(private readonly logger: PracticeLogSink = new Logger("PracticeTelemetry")) {}

  stateSaveSucceeded(input: {
    ownerId: string;
    sessionKey: string;
    questionId: string;
    changedFields: string[];
    retryCount: number;
    durationMs: number;
  }): void {
    this.logger.log({
      event: "practice.state_save_succeeded",
      metric: "practice_state_save_total",
      metricDelta: 1,
      outcome: "success",
      ...input
    });
  }

  stateSaveFailed(input: {
    ownerId: string | null;
    sessionKey: string | null;
    questionId: string | null;
    changedFields: string[];
    retryCount: number;
    durationMs: number;
    error: unknown;
  }): void {
    const alertable = !isApiRouteError(input.error) || input.error.statusCode >= 500;
    this.logger.warn({
      event: "practice.state_save_failed",
      metric: "practice_state_save_total",
      metricDelta: 1,
      outcome: "failure",
      ownerId: input.ownerId,
      sessionKey: input.sessionKey,
      questionId: input.questionId,
      changedFields: input.changedFields,
      retryCount: input.retryCount,
      durationMs: input.durationMs,
      errorCode: safeErrorCode(input.error),
      alertSignal: alertable ? PRACTICE_ALERT_SIGNALS.stateSaveOutage : null,
      alertWindowSeconds: alertable ? PRACTICE_ALERT_POLICY.stateSaveOutage.windowSeconds : null,
      alertThreshold: alertable ? PRACTICE_ALERT_POLICY.stateSaveOutage.threshold : null
    });
  }

  evaluationVerified(input: {
    questionId: string;
    format: string;
    review: PrepPracticeReview;
    durationMs: number;
  }): void {
    this.logger.log({
      event: "practice.answer_evaluation_completed",
      metric: "practice_evaluation_total",
      metricDelta: 1,
      outcome: "verified",
      questionId: input.questionId,
      format: input.format,
      verificationStatus: input.review.verificationStatus,
      evaluatorVersion: input.review.evaluatorVersion,
      score: input.review.score,
      durationMs: input.durationMs
    });
  }

  evaluationUnverified(input: {
    questionId: string;
    format: string;
    evaluatorVersion: string;
    durationMs: number;
    error: unknown;
  }): void {
    this.logger.warn({
      event: "practice.answer_evaluation_unverified",
      metric: "practice_evaluation_total",
      metricDelta: 1,
      unverifiedEvaluationDelta: 1,
      outcome: "unverified",
      questionId: input.questionId,
      format: input.format,
      evaluatorVersion: input.evaluatorVersion,
      durationMs: input.durationMs,
      errorCode: safeErrorCode(input.error),
      alertSignal: PRACTICE_ALERT_SIGNALS.evaluatorOutage,
      alertWindowSeconds: PRACTICE_ALERT_POLICY.evaluatorOutage.windowSeconds,
      alertThreshold: PRACTICE_ALERT_POLICY.evaluatorOutage.threshold
    });
  }
}

export const practiceTelemetry = new PracticeTelemetry();

function safeErrorCode(error: unknown): string {
  if (isApiRouteError(error)) return error.code;
  if (error && typeof error === "object" && "code" in error) return String(error.code);
  return error instanceof Error ? error.name : "UNKNOWN";
}
