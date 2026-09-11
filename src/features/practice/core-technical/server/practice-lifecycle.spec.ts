import { describe, expect, it, vi } from "vitest";
import rawArtifact from "@/features/practice/core-technical/domain/generated/follow-operation-guided-benchmark.json";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";
import type { CoreTechnicalConfirmedFocus } from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { toPublicCoreTechnicalQuestion } from "@/features/practice/core-technical/domain/question-contracts";
import { coreTechnicalStoryReviewArtifactSchema } from "@/features/practice/core-technical/domain/review-artifact-contracts";
import type { PrismaService } from "@/server/database/prisma.service";
import { codeFingerprint } from "@/features/interviews/server/code-fingerprint";
import { CoreTechnicalAttemptEvaluator } from "./attempt-evaluator";
import { CoreTechnicalPracticeService } from "./practice.service";
import type { CoreTechnicalRunResult } from "./runner-contracts";

const artifact = coreTechnicalStoryReviewArtifactSchema.parse(rawArtifact);
const mcq = artifact.questionBlock.questions[0]!;
const NOW = new Date("2026-09-07T15:00:00.000Z");
const QUESTION_ID = "11111111-1111-4111-8111-111111111111";
const BLOCK_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

describe("Core Technical practice lifecycle", () => {
  it("restores candidate state through an allowlisted read without private evaluation material", async () => {
    const prisma = {
      coreTechnicalBlock: { findFirst: vi.fn().mockResolvedValue(blockRecord()) }
    } as unknown as PrismaService;
    const service = createService(prisma);

    const current = await service.current("owner-1");
    expect(current?.questions[0]).toMatchObject({
      status: "ACTIVE",
      draft: { kind: "choice", selectedChoiceIndex: 1 },
      revealedHints: [mcq.hints[0]]
    });
    expect(current?.remainingQuestionCount).toBe(1);
    expect(current?.selection).toMatchObject({
      difficulty: artifact.story.difficulty,
      reason: expect.stringContaining("saved Node.js assessment evidence")
    });
    expect(current?.focus).toMatchObject({
      role: "backend",
      seniority: "mid",
      stack: { runtimeVersion: "22 LTS", framework: "express" },
      excludedTopicKeys: ["nodejs-work-isolation"]
    });
    expect(current?.questions[0]?.authorizedAnswer).toBeNull();
    const serialized = JSON.stringify(current);
    expect(serialized).not.toContain("correctChoiceIndex");
    expect(serialized).not.toContain("hiddenTests");
    expect(serialized).not.toContain("commonMistakes");
    expect(serialized).not.toContain("rubric");
    expect(serialized).not.toContain("rankings");
    expect(serialized).not.toContain("baselineEvidence");
  });

  it("reveals an explicit hint level idempotently and refuses skipped levels", async () => {
    const upsert = vi.fn();
    const tx = mutableTransaction({ revealedHintCount: 1, upsert });
    const prisma = transactionalPrisma(tx, questionRecord({ revealedHintCount: 1 }));
    const service = createService(prisma);

    const replay = await service.revealHint("owner-1", { questionId: QUESTION_ID, hintNumber: 1 });
    expect(replay.revealedHints).toEqual([mcq.hints[0]]);
    expect(upsert).not.toHaveBeenCalled();

    const skippedTx = mutableTransaction({ revealedHintCount: 1, upsert: vi.fn() });
    const skippedService = createService(transactionalPrisma(skippedTx, questionRecord()));
    await expect(
      skippedService.revealHint("owner-1", {
        questionId: QUESTION_ID,
        hintNumber: 3
      })
    ).rejects.toMatchObject({ code: "CORE_TECHNICAL_HINT_OUT_OF_ORDER" });
  });

  it("replays an identical attempt without evaluating twice and rejects request-ID reuse", async () => {
    const evaluate = vi.fn();
    const stored = attemptRecord();
    const prisma = {
      coreTechnicalQuestionAttempt: { findUnique: vi.fn().mockResolvedValue(stored) },
      coreTechnicalBlockQuestion: {
        findFirst: vi.fn().mockResolvedValue(questionRecord({ attempts: [stored] }))
      }
    } as unknown as PrismaService;
    const service = new CoreTechnicalPracticeService(prisma, { run: vi.fn() }, { evaluate });
    const work = { kind: "choice" as const, selectedChoiceIndex: 1 };

    const replay = await service.submitAttempt("owner-1", {
      questionId: QUESTION_ID,
      requestId: REQUEST_ID,
      work
    });
    expect(replay.attempt.id).toBe("attempt-1");
    expect(evaluate).not.toHaveBeenCalled();

    await expect(
      service.submitAttempt("owner-1", {
        questionId: QUESTION_ID,
        requestId: REQUEST_ID,
        work: { kind: "choice", selectedChoiceIndex: 2 }
      })
    ).rejects.toMatchObject({ code: "CORE_TECHNICAL_ATTEMPT_REQUEST_CONFLICT" });
  });

  it("replays an identical code run without executing twice and rejects request-ID reuse", async () => {
    const executable = artifact.questionBlock.questions.find(
      (question) => question.runnerContract
    )!;
    const code = executable.referenceSolution!;
    const runner = { run: vi.fn() };
    const stored = {
      id: "run-1",
      blockQuestionId: QUESTION_ID,
      codeFingerprint: codeFingerprint(code),
      resultSnapshot: runResult(true),
      createdAt: NOW
    };
    const prisma = {
      coreTechnicalCodeRun: { findUnique: vi.fn().mockResolvedValue(stored) }
    } as unknown as PrismaService;
    const service = new CoreTechnicalPracticeService(prisma, runner, { evaluate: vi.fn() });

    await expect(
      service.runCode("owner-1", {
        questionId: QUESTION_ID,
        requestId: REQUEST_ID,
        code
      })
    ).resolves.toMatchObject({ id: "run-1", result: { accepted: true } });
    expect(runner.run).not.toHaveBeenCalled();

    await expect(
      service.runCode("owner-1", {
        questionId: QUESTION_ID,
        requestId: REQUEST_ID,
        code: `${code}\n// changed`
      })
    ).rejects.toMatchObject({ code: "CORE_TECHNICAL_RUN_REQUEST_CONFLICT" });
    expect(runner.run).not.toHaveBeenCalled();
  });

  it("keeps MCQ and code verdicts deterministic", async () => {
    const ai = { generateStructured: vi.fn() };
    const evaluator = new CoreTechnicalAttemptEvaluator(ai as never);
    const correct = await evaluator.evaluate(
      mcq,
      { kind: "choice", selectedChoiceIndex: mcq.answer.correctChoiceIndex! },
      null
    );
    expect(correct).toMatchObject({
      complete: true,
      verificationStatus: "VERIFIED",
      feedback: { score: 10 }
    });
    expect(ai.generateStructured).not.toHaveBeenCalled();

    const executable = artifact.questionBlock.questions.find(
      (question) => question.runnerContract
    )!;
    const failed = await evaluator.evaluate(
      executable,
      { kind: "code", code: "export {};", runId: REQUEST_ID },
      runResult(false)
    );
    expect(failed).toMatchObject({
      complete: false,
      verificationStatus: "VERIFIED",
      feedback: { score: 0 }
    });
  });

  it("makes the assessment READY atomically when Learn closes the final question", async () => {
    const questionUpdate = vi.fn().mockResolvedValue({});
    const assessmentUpdate = vi.fn().mockResolvedValue({});
    const progressUpdate = vi.fn().mockResolvedValue({});
    const blockUpdate = vi
      .fn()
      .mockResolvedValue({ storyVersion: { storyKey: artifact.story.key } });
    const tx = {
      $executeRaw: vi.fn(),
      coreTechnicalBlockQuestion: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: QUESTION_ID, blockId: BLOCK_ID, status: "ACTIVE" }),
        update: questionUpdate,
        count: vi.fn().mockResolvedValue(0)
      },
      coreTechnicalBlock: {
        findUnique: vi.fn().mockResolvedValue({
          isCurrent: true,
          contentFingerprint: `sha256:${"b".repeat(64)}`,
          storySnapshot: artifact.story,
          questions: artifact.questionBlock.questions.map((question, index) => ({
            id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
            order: index + 1,
            status: index === 0 ? "LEARNED" : "COMPLETED",
            contentFingerprint: `sha256:${String(index + 1)
              .repeat(64)
              .slice(0, 64)}`,
            privateSnapshot: question,
            attempts: index === 0 ? [] : [{ score: 8, verificationStatus: "VERIFIED" }]
          }))
        }),
        update: blockUpdate
      },
      coreTechnicalAssessment: { update: assessmentUpdate },
      coreTechnicalStoryProgress: { update: progressUpdate }
    };
    const prisma = transactionalPrisma(tx, questionRecord({ status: "LEARNED", learnedAt: NOW }));
    const service = createService(prisma);

    const learned = await service.learn("owner-1", { questionId: QUESTION_ID, confirmed: true });
    expect(learned.status).toBe("LEARNED");
    expect(learned.authorizedAnswer).toMatchObject({ concise: mcq.answer.concise });
    expect(questionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "LEARNED", learnedAt: NOW }
      })
    );
    expect(blockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "ASSESSMENT_READY", assessmentReadyAt: NOW }
      })
    );
    expect(assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "READY", readyAt: NOW })
      })
    );
    expect(progressUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "ASSESSMENT_READY" }
      })
    );
  });

  it("saves terminal progress on a loose path without unlocking its assessment", async () => {
    const blockUpdate = vi.fn();
    const assessmentUpdate = vi.fn();
    const progressUpdate = vi.fn();
    const tx = {
      $executeRaw: vi.fn(),
      coreTechnicalBlockQuestion: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: QUESTION_ID, blockId: BLOCK_ID, status: "ACTIVE" }),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0)
      },
      coreTechnicalBlock: {
        findUnique: vi.fn().mockResolvedValue({
          isCurrent: false,
          contentFingerprint: `sha256:${"b".repeat(64)}`,
          storySnapshot: artifact.story,
          questions: []
        }),
        update: blockUpdate
      },
      coreTechnicalAssessment: { update: assessmentUpdate },
      coreTechnicalStoryProgress: { update: progressUpdate }
    };
    const prisma = transactionalPrisma(tx, questionRecord({ status: "LEARNED", learnedAt: NOW }));

    await createService(prisma).learn("owner-1", {
      questionId: QUESTION_ID,
      confirmed: true
    });

    expect(blockUpdate).not.toHaveBeenCalled();
    expect(assessmentUpdate).not.toHaveBeenCalled();
    expect(progressUpdate).not.toHaveBeenCalled();
  });
});

function createService(prisma: PrismaService) {
  return new CoreTechnicalPracticeService(
    prisma,
    { run: vi.fn() },
    { evaluate: vi.fn() },
    () => NOW
  );
}

function transactionalPrisma(tx: object, question: object): PrismaService {
  return {
    $transaction: vi.fn().mockImplementation((work) => work(tx)),
    coreTechnicalBlockQuestion: { findFirst: vi.fn().mockResolvedValue(question) }
  } as unknown as PrismaService;
}

function mutableTransaction(options: {
  revealedHintCount: number;
  upsert: ReturnType<typeof vi.fn>;
}) {
  return {
    $executeRaw: vi.fn(),
    coreTechnicalBlockQuestion: {
      findFirst: vi.fn().mockResolvedValue({
        id: QUESTION_ID,
        blockId: BLOCK_ID,
        contentFingerprint: `sha256:${"a".repeat(64)}`,
        privateSnapshot: mcq
      })
    },
    coreTechnicalQuestionState: {
      findUnique: vi.fn().mockResolvedValue({ revealedHintCount: options.revealedHintCount }),
      upsert: options.upsert
    }
  };
}

function blockRecord() {
  return {
    id: BLOCK_ID,
    ordinal: 1,
    status: "PRACTISING",
    contentFingerprint: `sha256:${"b".repeat(64)}`,
    preparedAt: NOW,
    assessmentReadyAt: null,
    selectionSnapshot: firstStorySelection(),
    storySnapshot: artifact.story,
    focusRevision: { focusSnapshot: confirmedFocus() },
    questions: [questionRecord()],
    assessment: { id: "assessment-1", status: "LOCKED", readyAt: null }
  };
}

function confirmedFocus(): CoreTechnicalConfirmedFocus {
  const topics = NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key);
  const mechanisms = [
    ...new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys))
  ];
  return {
    schemaVersion: 1,
    focusFingerprint: `sha256:${"f".repeat(64)}`,
    confirmedAt: NOW.toISOString(),
    role: "backend",
    seniority: "mid",
    targetJob: "Platform Engineer",
    targetCompany: null,
    targetDate: null,
    stack: {
      language: "javascript",
      runtime: "nodejs",
      runtimeVersion: "22 LTS",
      framework: "express"
    },
    excludedTopicKeys: ["nodejs-work-isolation"],
    resumeEvidence: { topicKeys: [], mechanismKeys: [] },
    baselineEvidence: {
      schemaVersion: 1,
      registryVersion: 1,
      sourceFingerprint: `sha256:${"b".repeat(64)}`,
      state: "STANDARD",
      validAnswerCount: 3,
      correctAnswerCount: 2,
      questions: (["technical-1", "technical-2", "technical-3"] as const).map((section, index) => ({
        section,
        resolution: "RESOLVED" as const,
        questionId: `question-${index + 1}`,
        questionFingerprint: `sha256:${String(index + 1).repeat(64)}`,
        conceptKeys: [],
        mechanismKeys: [],
        correctness: index < 2 ? ("CORRECT" as const) : ("INCORRECT" as const)
      })),
      weakConceptKeys: [],
      strongConceptKeys: [],
      unassessedConceptKeys: topics,
      weakMechanismKeys: [],
      strongMechanismKeys: [],
      unassessedMechanismKeys: mechanisms
    }
  };
}

function firstStorySelection() {
  const selectedStory = {
    storyKey: artifact.story.key,
    storyVersion: 1,
    title: artifact.story.title,
    difficulty: artifact.story.difficulty,
    emphasizedConceptKeys: artifact.story.secondaryTopicKeys,
    scores: {
      baselineGapTransfer: 25,
      targetRoleJob: 20,
      resumeProjectRelevance: 10,
      plannedCoverage: 15,
      storyDiversity: 10,
      total: 80
    }
  };
  return {
    policyVersion: 1,
    focusFingerprint: `sha256:${"f".repeat(64)}`,
    selectedStory,
    rankings: [selectedStory],
    reason:
      "We chose this operation story because it matches the saved Node.js assessment evidence."
  };
}

function questionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: QUESTION_ID,
    blockId: BLOCK_ID,
    ownerId: "owner-1",
    order: 1,
    questionKey: mcq.key,
    contentVersion: 1,
    contentFingerprint: `sha256:${"a".repeat(64)}`,
    status: "ACTIVE",
    publicSnapshot: toPublicCoreTechnicalQuestion(mcq, false),
    privateSnapshot: mcq,
    completedAt: null,
    learnedAt: null,
    updatedAt: NOW,
    block: { id: BLOCK_ID, isCurrent: true, status: "PRACTISING" },
    state: {
      draft: { kind: "choice", selectedChoiceIndex: 1 },
      revealedHintCount: 1,
      updatedAt: NOW
    },
    attempts: [],
    codeRuns: [],
    ...overrides
  };
}

function attemptRecord() {
  return {
    id: "attempt-1",
    blockQuestionId: QUESTION_ID,
    requestId: REQUEST_ID,
    workFingerprint: "sha256:bb2a9d9c524168fb0a26482f8e257447cc3985e693d6c2b6a197fa39d1e669e0",
    answerSnapshot: { kind: "choice", selectedChoiceIndex: 1 },
    evaluationSnapshot: feedback(),
    verificationStatus: "VERIFIED",
    score: 10,
    createdAt: NOW
  };
}

function feedback() {
  return {
    schemaVersion: 1,
    score: 10,
    result: "Correct result.",
    mechanism: "The event loop processes the relevant queues in the demonstrated order.",
    didWell: "The response identified the governing mechanism.",
    missingOrIncorrect: "Nothing material was missing.",
    productionConsequence: "Ordering changes can alter observable request behaviour.",
    transferExample: "Apply the same reasoning to a timer and promise callback.",
    interviewerFollowUp: "How would the ordering change across an I/O boundary?",
    missedEdgeCases: []
  };
}

function runResult(accepted: boolean): CoreTechnicalRunResult {
  return {
    accepted,
    status: accepted ? "accepted" : "tests-failed",
    codeFingerprint: `sha256:${"c".repeat(64)}`,
    testSuiteFingerprint: `sha256:${"d".repeat(64)}`,
    runnerIdentity: "test-sandbox",
    runnerVersion: "core-technical-nodejs-22.23.2-isolated-v1",
    runtimeVersion: "22.23.2",
    limits: {
      timeoutMs: 1_000,
      memoryMb: 64,
      outputBytes: 65_536,
      filesystem: "read-only-submission",
      processes: 1,
      network: false
    },
    publicTests: [{ name: "public", input: "", expected: "true", passed: accepted }],
    hiddenTests: { passed: accepted ? 1 : 0, total: 1 },
    durationMs: 10,
    peakMemoryMb: 30
  };
}
