import { describe, expect, it, vi } from "vitest";
import { AppliedEngineeringAttemptEvaluator } from "./attempt-evaluator";
import { AppliedEngineeringPracticeService } from "./practice.service";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/features/practice/applied-engineering/domain/reviewed-incidents";
import { toPublicAppliedEngineeringQuestion } from "@/features/practice/applied-engineering/domain/question-contracts";

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

    await expect(
      service.learn("owner-1", { questionId: QUESTION_ID, confirmed: true })
    ).rejects.toMatchObject({
      code: "APPLIED_ENGINEERING_QUESTION_NOT_FOUND"
    });
    expect(tx.appliedEngineeringBlockQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: QUESTION_ID, ownerId: "owner-1" })
      })
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

    await expect(
      service.saveDraft("owner-1", { questionId: QUESTION_ID, draft: null })
    ).rejects.toMatchObject({
      code: "APPLIED_ENGINEERING_QUESTION_READ_ONLY"
    });
  });
});

describe("AppliedEngineeringPracticeService replies", () => {
  it("answers draft and hint writes from the row read in their transaction", async () => {
    const frozen = APPLIED_ENGINEERING_REVIEW_CANDIDATES[0].questionBlock.questions.find(
      (candidate) => candidate.format !== "mcq"
    )!;
    const now = new Date("2026-09-27T10:00:00Z");
    const row = {
      id: QUESTION_ID,
      blockId: "33333333-3333-4333-8333-333333333333",
      ownerId: "owner-1",
      order: frozen.order,
      questionKey: frozen.key,
      contentVersion: 1,
      contentFingerprint: `sha256:${"a".repeat(64)}`,
      status: "ACTIVE",
      publicSnapshot: toPublicAppliedEngineeringQuestion(frozen, false),
      privateSnapshot: frozen,
      completedAt: null,
      learnedAt: null,
      updatedAt: now,
      block: { id: "33333333-3333-4333-8333-333333333333", isCurrent: true, status: "PRACTISING" },
      state: { draft: null, revealedHintCount: 0, updatedAt: now },
      attempts: [],
      codeRuns: []
    };
    const draft = { kind: "text" as const, text: "Retries duplicate the charge." };
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ draft, revealedHintCount: 0, updatedAt: now })
      .mockResolvedValueOnce({ draft: null, revealedHintCount: 1, updatedAt: now });
    const tx = {
      $executeRaw: vi.fn(),
      appliedEngineeringBlockQuestion: { findFirst: vi.fn().mockResolvedValue(row) },
      appliedEngineeringQuestionState: { upsert }
    };
    const root = { appliedEngineeringBlockQuestion: { findFirst: vi.fn() } };
    const service = new AppliedEngineeringPracticeService(
      {
        ...root,
        $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx))
      } as never,
      { run: vi.fn() } as never,
      new AppliedEngineeringAttemptEvaluator()
    );

    const drafted = await service.saveDraft("owner-1", { questionId: QUESTION_ID, draft });
    const hinted = await service.revealHint("owner-1", { questionId: QUESTION_ID, hintNumber: 1 });

    expect(drafted.draft).toEqual(draft);
    expect(hinted.revealedHints).toHaveLength(1);
    // No second read of the question after either commit.
    expect(root.appliedEngineeringBlockQuestion.findFirst).not.toHaveBeenCalled();
  });
});

function prisma(tx: Record<string, unknown>) {
  return {
    ...tx,
    $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx))
  } as never;
}
