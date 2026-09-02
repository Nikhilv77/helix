import {
  PRACTICE_ALERT_POLICY,
  PRACTICE_ALERT_SIGNALS,
  PracticeTelemetry
} from "./practice-telemetry";
import { ApiRouteError } from "../http/api-error";

describe("PracticeTelemetry", () => {
  it("emits a content-safe, alertable state-save failure", () => {
    const sink = { log: vi.fn(), warn: vi.fn() };
    const telemetry = new PracticeTelemetry(sink);

    telemetry.stateSaveFailed({
      ownerId: "owner-1",
      sessionKey: "core-technical",
      questionId: "question-1",
      changedFields: ["draftAnswer", "note"],
      retryCount: 2,
      durationMs: 81,
      error: Object.assign(new Error("private draft must not be logged"), { code: "ETIMEDOUT" })
    });

    expect(sink.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "practice.state_save_failed",
        outcome: "failure",
        retryCount: 2,
        durationMs: 81,
        errorCode: "ETIMEDOUT",
        alertSignal: PRACTICE_ALERT_SIGNALS.stateSaveOutage,
        alertWindowSeconds: PRACTICE_ALERT_POLICY.stateSaveOutage.windowSeconds,
        alertThreshold: PRACTICE_ALERT_POLICY.stateSaveOutage.threshold
      })
    );
    expect(JSON.stringify(sink.warn.mock.calls)).not.toContain("private draft");
  });

  it("emits evaluator latency and an unverified outage counter", () => {
    const sink = { log: vi.fn(), warn: vi.fn() };
    const telemetry = new PracticeTelemetry(sink);

    telemetry.evaluationUnverified({
      questionId: "question-1",
      format: "spoken",
      evaluatorVersion: "prep-rubric-v1",
      durationMs: 1_204,
      error: new Error("provider unavailable")
    });

    expect(sink.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "practice.answer_evaluation_unverified",
        unverifiedEvaluationDelta: 1,
        durationMs: 1_204,
        errorCode: "Error",
        alertSignal: PRACTICE_ALERT_SIGNALS.evaluatorOutage,
        alertThreshold: PRACTICE_ALERT_POLICY.evaluatorOutage.threshold
      })
    );
  });

  it("counts candidate errors without treating them as infrastructure outages", () => {
    const sink = { log: vi.fn(), warn: vi.fn() };
    const telemetry = new PracticeTelemetry(sink);

    telemetry.stateSaveFailed({
      ownerId: null,
      sessionKey: null,
      questionId: null,
      changedFields: [],
      retryCount: 0,
      durationMs: 2,
      error: new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required")
    });

    expect(sink.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "AUTH_REQUIRED",
        alertSignal: null,
        alertWindowSeconds: null,
        alertThreshold: null
      })
    );
  });
});
