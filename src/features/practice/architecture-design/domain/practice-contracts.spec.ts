import { describe, expect, it } from "vitest";
import {
  architectureDesignAttemptFeedbackSchema,
  architectureDesignAttemptInputSchema,
  architectureDesignDraftWorkSchema,
  architectureDesignPrepareInputSchema
} from "./practice-contracts";

const ID = "11111111-1111-4111-8111-111111111111";

describe("Architecture & Design practice contracts", () => {
  it("accepts only choice or written work and has no executable shape", () => {
    expect(
      architectureDesignDraftWorkSchema.safeParse({ kind: "text", text: "A design draft" }).success
    ).toBe(true);
    expect(
      architectureDesignDraftWorkSchema.safeParse({ kind: "choice", selectedChoiceIndex: 2 })
        .success
    ).toBe(true);
    expect(
      architectureDesignDraftWorkSchema.safeParse({ kind: "code", code: "return true" }).success
    ).toBe(false);
  });

  it("strictly validates replay-safe preparation and attempt requests", () => {
    expect(
      architectureDesignPrepareInputSchema.safeParse({ requestId: ID, focusRevisionId: ID }).success
    ).toBe(true);
    expect(
      architectureDesignAttemptInputSchema.safeParse({
        questionId: ID,
        requestId: ID,
        work: { kind: "text", text: "A genuine design answer" },
        scenarioKey: "browser-controlled"
      }).success
    ).toBe(false);
  });

  it("bounds evaluator feedback to a ten-point design rubric", () => {
    const feedback = {
      schemaVersion: 1,
      score: 7,
      result: "The response is coherent.",
      constraintUse: "The answer uses the supplied throughput.",
      designReasoning: "Components follow the requested access path.",
      tradeoffQuality: "One rejected alternative is quantified.",
      operationalSafety: "Failure isolation is explicit.",
      communicationQuality: "Assumptions are ordered.",
      interviewerFollowUp: "What changes at ten times scale?",
      missedConsiderations: []
    };
    expect(architectureDesignAttemptFeedbackSchema.safeParse(feedback).success).toBe(true);
    expect(
      architectureDesignAttemptFeedbackSchema.safeParse({ ...feedback, score: 11 }).success
    ).toBe(false);
  });
});
