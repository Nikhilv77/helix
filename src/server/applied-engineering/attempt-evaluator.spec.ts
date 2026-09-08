import { describe, expect, it } from "vitest";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/lib/practice/applied-engineering/reviewed-incidents";
import { AppliedEngineeringAttemptEvaluator } from "./attempt-evaluator";

const questions = APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]!.questionBlock.questions;

describe("AppliedEngineeringAttemptEvaluator", () => {
  it("grades a choice deterministically from the frozen answer", async () => {
    const question = questions[0]!;
    const evaluator = new AppliedEngineeringAttemptEvaluator();
    const result = await evaluator.evaluate(question, { kind: "choice", selectedChoiceIndex: question.answer.correctChoiceIndex! }, null);

    expect(result).toMatchObject({ complete: true, verificationStatus: "VERIFIED", feedback: { score: 10 } });
  });

  it("keeps written evaluation bounded when no model is available", async () => {
    const question = questions[2]!;
    const result = await new AppliedEngineeringAttemptEvaluator().evaluate(
      question,
      { kind: "text", text: "The root cause is a race condition and the rollout needs monitoring." },
      null
    );

    expect(result).toMatchObject({ complete: true, verificationStatus: "UNVERIFIED" });
    expect(result.feedback.score).toBeGreaterThanOrEqual(1);
    expect(result.feedback.score).toBeLessThanOrEqual(10);
  });
});
