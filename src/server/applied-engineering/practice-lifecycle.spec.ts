import { describe, expect, it, vi } from "vitest";
import { AppliedEngineeringAttemptEvaluator } from "./attempt-evaluator";
import { AppliedEngineeringPracticeService } from "./practice.service";

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";

describe("AppliedEngineeringPracticeService", () => {
  it("rejects foreign question IDs before writing learner state", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      appliedEngineeringBlockQuestion: { findFirst: vi.fn().mockResolvedValue(null) }
    };
    const service = new AppliedEngineeringPracticeService(
      prisma(tx),
      { run: vi.fn() } as never,
      new AppliedEngineeringAttemptEvaluator()
    );

    await expect(service.learn("owner-1", { questionId: QUESTION_ID, confirmed: true })).rejects.toMatchObject({
      code: "APPLIED_ENGINEERING_QUESTION_NOT_FOUND"
    });
    expect(tx.appliedEngineeringBlockQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: QUESTION_ID, ownerId: "owner-1" }) })
    );
  });

  it("does not allow a draft to bypass the owner/current-block boundary", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      appliedEngineeringBlockQuestion: { findFirst: vi.fn().mockResolvedValue(null) }
    };
    const service = new AppliedEngineeringPracticeService(
      prisma(tx),
      { run: vi.fn() } as never,
      new AppliedEngineeringAttemptEvaluator()
    );

    await expect(service.saveDraft("owner-1", { questionId: QUESTION_ID, draft: null })).rejects.toMatchObject({
      code: "APPLIED_ENGINEERING_QUESTION_READ_ONLY"
    });
  });
});

function prisma(tx: Record<string, unknown>) {
  return {
    ...tx,
    $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx))
  } as never;
}
