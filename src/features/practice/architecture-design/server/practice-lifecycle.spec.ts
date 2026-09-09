import { describe, expect, it, vi } from "vitest";
import {
  toPublicArchitectureDesignQuestion,
  type ArchitectureDesignQuestion
} from "@/features/practice/architecture-design/domain/question-contracts";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/features/practice/architecture-design/domain/reviewed-scenarios";
import type { PrismaService } from "@/server/database/prisma.service";
import {
  ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_FINGERPRINT,
  ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION
} from "./attempt-evaluator";
import { ArchitectureDesignPracticeService } from "./practice.service";

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const BLOCK_ID = "33333333-3333-4333-8333-333333333333";
const question = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!.questionBlock.questions[0]!;

describe("ArchitectureDesignPracticeService", () => {
  it("returns an active question without private answers, hints, or rubrics", async () => {
    const service = new ArchitectureDesignPracticeService(
      {
        architectureBlockQuestion: {
          findFirst: vi.fn().mockResolvedValue(publicRow(question))
        }
      } as unknown as PrismaService,
      evaluator()
    );

    const result = await service.question("owner-1", QUESTION_ID);
    const serialized = JSON.stringify(result);

    expect(result.authorizedAnswer).toBeNull();
    expect(result.revealedHints).toEqual([]);
    expect(serialized).not.toMatch(
      /referenceAnswer|correctChoiceIndex|rubric|commonMistakes|hints/
    );
  });

  it("rejects foreign question IDs before writing learner state", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      architectureBlockQuestion: { findFirst: vi.fn().mockResolvedValue(null) }
    };
    const service = new ArchitectureDesignPracticeService(prisma(tx), evaluator());

    await expect(
      service.learn("owner-1", { questionId: QUESTION_ID, confirmed: true })
    ).rejects.toMatchObject({ code: "ARCHITECTURE_DESIGN_QUESTION_NOT_FOUND" });
    expect(tx.architectureBlockQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: QUESTION_ID, ownerId: "owner-1" })
      })
    );
  });

  it("saves a draft without completing the question", async () => {
    const upsert = vi.fn();
    const tx = {
      $executeRaw: vi.fn(),
      architectureBlockQuestion: { findFirst: vi.fn().mockResolvedValue(mutableRow(question)) },
      architectureQuestionState: { upsert }
    };
    const root = {
      architectureBlockQuestion: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            publicRow(question, { draft: { kind: "text", text: "A bounded draft" } })
          )
      }
    };
    const service = new ArchitectureDesignPracticeService(prisma(tx, root), evaluator());

    const result = await service.saveDraft("owner-1", {
      questionId: QUESTION_ID,
      draft: { kind: "text", text: "A bounded draft" }
    });

    expect(result.status).toBe("ACTIVE");
    expect(upsert).toHaveBeenCalledOnce();
    expect(tx.architectureBlockQuestion).not.toHaveProperty("update");
  });

  it("enforces progressive hint order without changing lifecycle state", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      architectureBlockQuestion: { findFirst: vi.fn().mockResolvedValue(mutableRow(question)) },
      architectureQuestionState: {
        findUnique: vi.fn().mockResolvedValue({ revealedHintCount: 0 }),
        upsert: vi.fn()
      }
    };
    const service = new ArchitectureDesignPracticeService(prisma(tx), evaluator());

    await expect(
      service.revealHint("owner-1", { questionId: QUESTION_ID, hintNumber: 2 })
    ).rejects.toMatchObject({ code: "ARCHITECTURE_DESIGN_HINT_OUT_OF_ORDER" });
    expect(tx.architectureQuestionState.upsert).not.toHaveBeenCalled();
  });

  it("persists replay-safe evaluator identity and completes an attempted question", async () => {
    const work = {
      kind: "text" as const,
      text: "I would quantify peak delivery load, latency, and availability before sizing queues."
    };
    const evaluation = evaluationFixture();
    const created = attemptRow(work, evaluation);
    const tx = {
      $executeRaw: vi.fn(),
      architectureQuestionAttempt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created)
      },
      architectureBlockQuestion: {
        findFirst: vi.fn().mockResolvedValue(mutableRow(question)),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(1)
      }
    };
    const root = {
      architectureQuestionAttempt: { findUnique: vi.fn().mockResolvedValue(null) },
      architectureBlockQuestion: {
        findFirst: vi.fn().mockResolvedValue(
          publicRow(question, {
            status: "COMPLETED",
            completedAt: new Date("2026-09-08T12:00:00Z"),
            attempts: [created]
          })
        )
      }
    };
    const evaluate = vi.fn().mockResolvedValue(evaluation);
    const service = new ArchitectureDesignPracticeService(prisma(tx, root), { evaluate });

    const result = await service.submitAttempt("owner-1", {
      questionId: QUESTION_ID,
      requestId: REQUEST_ID,
      work
    });

    expect(result.question.status).toBe("COMPLETED");
    expect(result.question.authorizedAnswer).not.toBeNull();
    expect(tx.architectureQuestionAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          evaluatorVersion: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION,
          evaluatorFingerprint: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_FINGERPRINT
        })
      })
    );
  });

  it("unlocks one assessment after the fourth terminal question and records Learn as zero mastery", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      architectureBlockQuestion: {
        findFirst: vi.fn().mockResolvedValue({
          id: QUESTION_ID,
          blockId: BLOCK_ID,
          status: "ACTIVE"
        }),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0)
      },
      architectureBlock: {
        findUnique: vi.fn().mockResolvedValue({
          scenarioVersion: { scenarioKey: question.scenarioKey }
        }),
        update: vi.fn()
      },
      architectureAssessment: { update: vi.fn() },
      architectureScenarioProgress: { update: vi.fn() }
    };
    const root = {
      architectureBlockQuestion: {
        findFirst: vi.fn().mockResolvedValue(
          publicRow(question, {
            status: "LEARNED",
            learnedAt: new Date("2026-09-08T12:00:00Z")
          })
        )
      }
    };
    const service = new ArchitectureDesignPracticeService(
      prisma(tx, root),
      evaluator(),
      () => new Date("2026-09-08T12:00:00Z")
    );

    const result = await service.learn("owner-1", {
      questionId: QUESTION_ID,
      confirmed: true
    });

    expect(result.status).toBe("LEARNED");
    expect(result.latestAttempt).toBeNull();
    expect(tx.architectureBlock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ASSESSMENT_READY" }) })
    );
    expect(tx.architectureAssessment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "READY" }) })
    );
    expect(tx.architectureScenarioProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ASSESSMENT_READY" } })
    );
  });

  it("does not persist anything when the bounded evaluator is unavailable", async () => {
    const tx = { $executeRaw: vi.fn() };
    const root = {
      architectureQuestionAttempt: { findUnique: vi.fn().mockResolvedValue(null) },
      architectureBlockQuestion: { findFirst: vi.fn().mockResolvedValue(mutableRow(question)) }
    };
    const database = prisma(tx, root);
    const service = new ArchitectureDesignPracticeService(database, {
      evaluate: vi.fn().mockRejectedValue(new Error("provider down"))
    });

    await expect(
      service.submitAttempt("owner-1", {
        questionId: QUESTION_ID,
        requestId: REQUEST_ID,
        work: { kind: "text", text: "A genuine system design response." }
      })
    ).rejects.toMatchObject({ code: "ARCHITECTURE_DESIGN_EVALUATOR_UNAVAILABLE" });
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});

function evaluator() {
  return { evaluate: vi.fn().mockResolvedValue(evaluationFixture()) };
}

function evaluationFixture() {
  return {
    feedback: {
      schemaVersion: 1 as const,
      score: 7,
      result: "The response is coherent.",
      constraintUse: "It uses the supplied scale constraint.",
      designReasoning: "The proposed boundary follows the access path.",
      tradeoffQuality: "One alternative is compared.",
      operationalSafety: "Backpressure is explicitly bounded.",
      communicationQuality: "Assumptions are stated clearly.",
      interviewerFollowUp: "What changes at ten times the traffic?",
      missedConsiderations: []
    },
    complete: true,
    verificationStatus: "VERIFIED" as const,
    evaluatorVersion: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_VERSION,
    evaluatorFingerprint: ARCHITECTURE_DESIGN_ATTEMPT_EVALUATOR_FINGERPRINT
  };
}

function mutableRow(frozen: ArchitectureDesignQuestion) {
  return {
    id: QUESTION_ID,
    blockId: BLOCK_ID,
    contentFingerprint: `sha256:${"b".repeat(64)}`,
    privateSnapshot: frozen
  };
}

function attemptRow(work: unknown, evaluation: ReturnType<typeof evaluationFixture>) {
  return {
    id: "attempt-1",
    blockQuestionId: QUESTION_ID,
    requestId: REQUEST_ID,
    workFingerprint: `sha256:${"c".repeat(64)}`,
    evaluatorVersion: evaluation.evaluatorVersion,
    evaluatorFingerprint: evaluation.evaluatorFingerprint,
    answerSnapshot: work,
    evaluationSnapshot: evaluation.feedback,
    verificationStatus: evaluation.verificationStatus,
    score: evaluation.feedback.score,
    createdAt: new Date("2026-09-08T12:00:00Z")
  };
}

function publicRow(frozen: ArchitectureDesignQuestion, overrides: Record<string, unknown> = {}) {
  return {
    id: QUESTION_ID,
    blockId: BLOCK_ID,
    ownerId: "owner-1",
    order: frozen.order,
    questionKey: frozen.key,
    contentVersion: frozen.schemaVersion,
    contentFingerprint: `sha256:${"b".repeat(64)}`,
    status: "ACTIVE",
    publicSnapshot: toPublicArchitectureDesignQuestion(frozen, false),
    privateSnapshot: frozen,
    completedAt: null,
    learnedAt: null,
    updatedAt: new Date("2026-09-08T12:00:00Z"),
    block: { id: BLOCK_ID, isCurrent: true, status: "PRACTISING" },
    state: { draft: null, revealedHintCount: 0, updatedAt: new Date("2026-09-08T12:00:00Z") },
    attempts: [],
    ...overrides
  };
}

function prisma(tx: Record<string, unknown>, root: Record<string, unknown> = {}) {
  return {
    ...root,
    $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx))
  } as unknown as PrismaService;
}
