import { describe, expect, it, vi } from "vitest";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/lib/practice/architecture-design/reviewed-scenarios";
import {
  ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_FINGERPRINT,
  ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION,
  ArchitectureDesignAttemptEvaluator
} from "./attempt-evaluator";

const written = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!.questionBlock.questions[0]!;
const choice = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[1]!.questionBlock.questions[0]!;

describe("ArchitectureDesignAttemptEvaluator", () => {
  it("grades an MCQ deterministically from the frozen private answer", async () => {
    const evaluator = new ArchitectureDesignAttemptEvaluator();
    const result = await evaluator.evaluate(choice, {
      kind: "choice",
      selectedChoiceIndex: choice.correctChoiceIndex!
    });

    expect(result).toMatchObject({
      complete: true,
      verificationStatus: "VERIFIED",
      evaluatorVersion: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION,
      evaluatorFingerprint: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_FINGERPRINT,
      feedback: { score: 10 }
    });
  });

  it("keeps the no-model written fallback bounded and unverified", async () => {
    const result = await new ArchitectureDesignAttemptEvaluator().evaluate(written, {
      kind: "text",
      text: "I would frame requirements, estimate capacity, and state latency assumptions."
    });

    expect(result).toMatchObject({ complete: true, verificationStatus: "UNVERIFIED" });
    expect(result.feedback.score).toBeGreaterThanOrEqual(1);
    expect(result.feedback.score).toBeLessThanOrEqual(10);
  });

  it("binds AI evaluation to the frozen scenario evidence and private rubric", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      schemaVersion: 1,
      score: 7,
      result: "The capacity argument is mostly coherent.",
      constraintUse: "The response uses the supplied peak throughput.",
      designReasoning: "The estimates connect to the proposed queue boundary.",
      tradeoffQuality: "The rejected synchronous path needs a clearer threshold.",
      operationalSafety: "Backpressure is addressed but recovery needs more detail.",
      communicationQuality: "Assumptions are explicit and ordered.",
      interviewerFollowUp: "What measurement would invalidate the estimate?",
      missedConsiderations: ["Regional failover capacity"]
    });
    const result = await new ArchitectureDesignAttemptEvaluator({ generateStructured }).evaluate(
      written,
      {
        kind: "text",
        text: "At peak I would partition queued delivery work and bound tenant concurrency."
      }
    );

    expect(result.verificationStatus).toBe("VERIFIED");
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "architecture-design.practice.attempt",
        prompt: expect.stringContaining(written.referenceAnswer.summary)
      })
    );
  });
});
