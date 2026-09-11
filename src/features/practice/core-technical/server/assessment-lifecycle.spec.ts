import { describe, expect, it, vi } from "vitest";
import {
  coreTechnicalAssessmentReportSchema,
  publicCoreTechnicalAssessmentSnapshot
} from "@/features/practice/core-technical/domain/assessment-contracts";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";
import type {
  CoreTechnicalAdaptiveEvidence,
  CoreTechnicalConfirmedFocus
} from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "@/features/practice/core-technical/domain/story-ranking-catalogue";
import type { PrismaService } from "@/server/database/prisma.service";
import { buildCoreTechnicalAssessmentSnapshot } from "./assessment-blueprint";
import { CoreTechnicalAssessmentEvaluator } from "./assessment-evaluator";
import { CoreTechnicalAssessmentService } from "./assessment.service";
import { CoreTechnicalContinuationService } from "./continuation.service";
import { CoreTechnicalHistoryService } from "./history.service";
import { focusedPracticePathFallback } from "./focused-practice-path-fallbacks";
import { CoreTechnicalStoryRankingService } from "./story-ranking.service";

const first = requiredFallback("javascript-values-copying-mutation");
const second = requiredFallback("javascript-scope-closures-retained-state");
const NOW = new Date("2026-09-07T17:00:00.000Z");
const BLOCK_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

function requiredFallback(storyKey: string) {
  const draft = focusedPracticePathFallback(storyKey);
  if (!draft) throw new Error(`Missing focused Core Technical fixture: ${storyKey}`);
  return draft;
}

describe("Core Technical assessment, adaptation, and history lifecycle", () => {
  it("freezes five prompts and exposes only their public projection", () => {
    const snapshot = assessmentSnapshot();
    expect(snapshot.prompts.map((prompt) => prompt.kind)).toEqual([
      "weak-response-review",
      "code-evidence-defence",
      "unseen-diagnosis-transfer",
      "repair-implementation-transfer",
      "production-verification-defence"
    ]);
    const serialized = JSON.stringify(publicCoreTechnicalAssessmentSnapshot(snapshot));
    expect(serialized).not.toContain("privateEvaluation");
    expect(serialized).not.toContain("expectedAnswer");
    expect(serialized).not.toContain("rubric");
    expect(serialized).toContain('"submission":null');
    expect(serialized).not.toContain("responseFingerprint");

    const submitted = publicCoreTechnicalAssessmentSnapshot({
      ...snapshot,
      submission: {
        requestId: REQUEST_ID,
        responseFingerprint: `sha256:${"d".repeat(64)}`,
        responses: snapshot.prompts.map((prompt) => ({
          promptId: prompt.id,
          answer: `Candidate-owned saved response for ${prompt.id}.`
        })),
        submittedAt: NOW.toISOString()
      }
    });
    expect(submitted.submission).toMatchObject({ requestId: REQUEST_ID });
    expect(JSON.stringify(submitted)).not.toContain("responseFingerprint");
  });

  it("uses verified assessment and Practice weakness to select a novel next story", () => {
    const selection = ranking().rankNextStory(focus(), adaptiveEvidence());
    expect(selection.policyVersion).toBe(2);
    expect(selection.selectedStory.storyKey).toBe("javascript-scope-closures-retained-state");
    expect(selection.selectedStory.difficulty).toBe("standard");
    expect(selection.selectedStory.scores).toMatchObject({
      assessmentWeakness: expect.any(Number),
      practiceWeakness: expect.any(Number),
      targetRoleJob: expect.any(Number),
      plannedCoverage: expect.any(Number),
      novelty: expect.any(Number)
    });
  });

  it("keeps deterministic code evidence authoritative and Learn at zero Practice mastery", async () => {
    const snapshot = assessmentSnapshot();
    const responses = snapshot.prompts.map((prompt) => ({
      promptId: prompt.id,
      answer: `A technically grounded response for ${prompt.id} with mechanism and production evidence.`
    }));
    const generateStructured = vi.fn().mockResolvedValue(aiEvaluation(snapshot));
    const evaluator = new CoreTechnicalAssessmentEvaluator(
      { generateStructured } as never,
      ranking()
    );
    const result = await evaluator.evaluate({
      assessmentId: ASSESSMENT_ID,
      blockId: BLOCK_ID,
      storyKey: first.story.key,
      focus: focus(),
      snapshot,
      responses,
      questions: evidenceQuestions({ learnedFirst: true, acceptedCodeRuns: 0 }),
      priorStoryKeys: [first.story.key],
      priorTopicKeys: first.questionBlock.questions.flatMap((question) => question.topicKeys),
      finalizedAt: NOW
    });

    expect(result.report.scores.debuggingImplementation).toBe(35);
    expect(result.report.deterministicEvidence).toMatchObject({
      acceptedCodeQuestionCount: 0,
      totalCodeQuestionCount: 2,
      implementationScoreCapped: true
    });
    expect(result.report.solvedVsLearned).toMatchObject({
      learnedCount: 1,
      learnedQuestionOrders: [1]
    });
    expect(result.report.nextStory!.selectedStory.storyKey).toBe(second.story.key);
    expect(JSON.stringify(result.transcript)).not.toContain("expectedAnswer");
    expect(JSON.stringify(result.transcript)).not.toContain("rubric");
  });

  it("completes the Core curriculum when the final published path has no successor", async () => {
    const snapshot = assessmentSnapshot();
    const evaluator = new CoreTechnicalAssessmentEvaluator(
      { generateStructured: vi.fn().mockResolvedValue(aiEvaluation(snapshot)) } as never,
      new CoreTechnicalStoryRankingService(
        NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE.filter(
          (candidate) => candidate.key === first.story.key
        ).map((candidate) => ({ ...candidate, publicationStatus: "published" as const }))
      )
    );

    const result = await evaluator.evaluate({
      assessmentId: ASSESSMENT_ID,
      blockId: BLOCK_ID,
      storyKey: first.story.key,
      focus: focus(),
      snapshot,
      responses: snapshot.prompts.map((prompt) => ({
        promptId: prompt.id,
        answer: `Grounded answer for ${prompt.id}.`
      })),
      questions: evidenceQuestions({ learnedFirst: true, acceptedCodeRuns: 1 }),
      priorStoryKeys: [first.story.key],
      priorTopicKeys: first.questionBlock.questions.flatMap((question) => question.topicKeys),
      finalizedAt: NOW
    });

    expect(result.report.nextStory).toBeUndefined();
    expect(result.report.continuation).toMatchObject({ kind: "complete" });
  });

  it("starts once and resumes the same durable assessment", async () => {
    const snapshot = assessmentSnapshot();
    const assessmentUpdate = vi.fn();
    const tx = startTransaction(snapshot, assessmentUpdate);
    const prisma = {
      $transaction: vi.fn().mockImplementation((work) => work(tx)),
      coreTechnicalAssessment: {
        findFirst: vi.fn().mockResolvedValue(readAssessment("IN_PROGRESS", snapshot))
      }
    } as unknown as PrismaService;
    const service = new CoreTechnicalAssessmentService(prisma, { evaluate: vi.fn() }, () => NOW);

    const started = await service.start("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: REQUEST_ID
    });
    expect(started.status).toBe("IN_PROGRESS");
    expect(started.assessment?.prompts).toHaveLength(5);
    expect(assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_PROGRESS", startRequestId: REQUEST_ID })
      })
    );

    tx.coreTechnicalAssessment.findFirst.mockResolvedValueOnce({
      ...startTransactionRecord(snapshot),
      status: "IN_PROGRESS"
    });
    await service.start("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: "44444444-4444-4444-8444-444444444444"
    });
    expect(assessmentUpdate).toHaveBeenCalledTimes(1);
  });

  it("allows an explicit development preview to start early and records unfinished work as Learned", async () => {
    const snapshot = assessmentSnapshot();
    const assessmentUpdate = vi.fn();
    const questionUpdate = vi.fn();
    const tx = {
      ...startTransaction(snapshot, assessmentUpdate),
      coreTechnicalBlockQuestion: { updateMany: questionUpdate }
    };
    tx.coreTechnicalAssessment.findFirst.mockResolvedValueOnce({
      ...startTransactionRecord(snapshot),
      status: "LOCKED"
    });
    const prisma = {
      $transaction: vi.fn().mockImplementation((work) => work(tx)),
      coreTechnicalAssessment: {
        findFirst: vi.fn().mockResolvedValue(readAssessment("IN_PROGRESS", snapshot))
      }
    } as unknown as PrismaService;
    const service = new CoreTechnicalAssessmentService(prisma, { evaluate: vi.fn() }, () => NOW);

    await service.start(
      "owner-1",
      { assessmentId: ASSESSMENT_ID, requestId: REQUEST_ID },
      { allowLocked: true }
    );

    expect(questionUpdate).toHaveBeenCalledWith({
      where: { blockId: BLOCK_ID, ownerId: "owner-1", status: "ACTIVE" },
      data: { status: "LEARNED", learnedAt: NOW }
    });
    expect(assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ readyAt: NOW }) })
    );
  });

  it("durably checkpoints finalization before atomically publishing its report", async () => {
    const snapshot = assessmentSnapshot();
    const responses = snapshot.prompts.map((prompt) => ({
      promptId: prompt.id,
      answer: `A complete assessment response for ${prompt.id}.`
    }));
    const nextStory = ranking().rankNextStory(focus(), adaptiveEvidence());
    const report = reportWith(nextStory);
    const transcript = {
      schemaVersion: 1 as const,
      assessmentId: ASSESSMENT_ID,
      blockId: BLOCK_ID,
      entries: snapshot.prompts.map((prompt, index) => ({
        promptId: prompt.id,
        order: prompt.order,
        kind: prompt.kind,
        prompt: prompt.prompt,
        answer: responses[index]!.answer
      }))
    };
    const assessmentUpdate = vi.fn();
    const reportCreate = vi.fn();
    const txFind = vi
      .fn()
      .mockResolvedValueOnce({
        id: ASSESSMENT_ID,
        blockId: BLOCK_ID,
        status: "IN_PROGRESS",
        finalizationRequestId: null,
        assessmentSnapshot: snapshot,
        report: null,
        block: { isCurrent: true }
      })
      .mockResolvedValueOnce({
        blockId: BLOCK_ID,
        status: "FINALIZING",
        finalizationRequestId: REQUEST_ID,
        report: null,
        block: { storyVersion: { storyKey: first.story.key } }
      });
    const tx = {
      $executeRaw: vi.fn(),
      coreTechnicalAssessment: { findFirst: txFind, update: assessmentUpdate },
      coreTechnicalAssessmentReport: { create: reportCreate },
      coreTechnicalBlock: { update: vi.fn() },
      coreTechnicalStoryProgress: { update: vi.fn() }
    };
    const evidenceBlock = {
      id: BLOCK_ID,
      ordinal: 1,
      focusRevision: { focusSnapshot: focus() },
      storyVersion: { storyKey: first.story.key },
      questions: evidenceQuestions({ learnedFirst: true, acceptedCodeRuns: 1 })
    };
    const completedRead = {
      ...readAssessment("COMPLETED", {
        ...snapshot,
        submission: {
          requestId: REQUEST_ID,
          responseFingerprint: `sha256:${"e".repeat(64)}`,
          responses,
          submittedAt: NOW.toISOString()
        }
      }),
      completedAt: NOW,
      report: { reportSnapshot: report, transcriptSnapshot: transcript, finalizedAt: NOW }
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((work) => work(tx)),
      coreTechnicalAssessment: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ block: evidenceBlock })
          .mockResolvedValueOnce(completedRead)
      },
      coreTechnicalBlock: {
        findMany: vi.fn().mockResolvedValue([
          {
            storyVersion: { storyKey: first.story.key },
            questions: first.questionBlock.questions.map((question) => ({
              privateSnapshot: question
            }))
          }
        ])
      }
    } as unknown as PrismaService;
    const evaluate = vi
      .fn()
      .mockResolvedValue({ report, transcript, evidence: adaptiveEvidence() });
    const service = new CoreTechnicalAssessmentService(prisma, { evaluate }, () => NOW);

    const finalized = await service.finalize("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: REQUEST_ID,
      responses
    });

    expect(finalized.status).toBe("COMPLETED");
    expect(finalized.report?.nextStory!.selectedStory.storyKey).toBe(second.story.key);
    expect(assessmentUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ status: "FINALIZING", finalizationRequestId: REQUEST_ID })
      })
    );
    expect(reportCreate).toHaveBeenCalledOnce();
    expect(assessmentUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: { status: "COMPLETED", completedAt: NOW }
      })
    );
  });

  it("returns an existing completed report without evaluating or creating a duplicate", async () => {
    const snapshot = assessmentSnapshot();
    const report = reportWith(ranking().rankNextStory(focus(), adaptiveEvidence()));
    const transcript = {
      schemaVersion: 1 as const,
      assessmentId: ASSESSMENT_ID,
      blockId: BLOCK_ID,
      entries: snapshot.prompts.map((prompt) => ({
        promptId: prompt.id,
        order: prompt.order,
        kind: prompt.kind,
        prompt: prompt.prompt,
        answer: `A previously saved response for ${prompt.id}.`
      }))
    };
    const transaction = {
      $executeRaw: vi.fn(),
      coreTechnicalAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          id: ASSESSMENT_ID,
          blockId: BLOCK_ID,
          status: "COMPLETED",
          finalizationRequestId: REQUEST_ID,
          assessmentSnapshot: snapshot,
          report: { id: "report-1" },
          block: { isCurrent: true }
        })
      },
      coreTechnicalAssessmentReport: { create: vi.fn() }
    };
    const completed = {
      ...readAssessment("COMPLETED", snapshot),
      completedAt: NOW,
      report: { reportSnapshot: report, transcriptSnapshot: transcript, finalizedAt: NOW }
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((work) => work(transaction)),
      coreTechnicalAssessment: { findFirst: vi.fn().mockResolvedValue(completed) }
    } as unknown as PrismaService;
    const evaluate = vi.fn();
    const service = new CoreTechnicalAssessmentService(prisma, { evaluate }, () => NOW);

    const result = await service.finalize("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: "44444444-4444-4444-8444-444444444444",
      responses: snapshot.prompts.map((prompt) => ({
        promptId: prompt.id,
        answer: `A repeated response for ${prompt.id}.`
      }))
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.report?.overallScore).toBe(report.overallScore);
    expect(evaluate).not.toHaveBeenCalled();
    expect(transaction.coreTechnicalAssessmentReport.create).not.toHaveBeenCalled();
  });

  it("keeps the completed report current until Continue atomically publishes the next block", async () => {
    const selection = ranking().rankNextStory(focus(), adaptiveEvidence());
    const report = reportWith(selection);
    const publishPreparedBlock = vi.fn().mockResolvedValue({ id: "next-block" });
    const activateLibraryBlock = vi.fn().mockResolvedValue(null);
    const recordPreparationFailure = vi.fn();
    const prepareReviewedDraft = vi.fn().mockResolvedValue({
      story: second.story,
      storyReview: second.storyReview,
      questionBlock: second.questionBlock,
      questionBlockReview: second.questionBlockReview
    });
    const prisma = {
      coreTechnicalPreparationAttempt: { findUnique: vi.fn().mockResolvedValue(null) },
      coreTechnicalBlock: {
        findFirst: vi.fn().mockResolvedValue({
          id: BLOCK_ID,
          status: "ASSESSED",
          focusRevisionId: "55555555-5555-4555-8555-555555555555",
          focusRevision: { focusSnapshot: focus() },
          assessment: { status: "COMPLETED", report: { reportSnapshot: report } }
        })
      },
      coreTechnicalStoryVersion: {
        findUnique: vi.fn().mockResolvedValue({
          publicationStatus: "PUBLISHED",
          storySnapshot: second.story
        })
      }
    } as unknown as PrismaService;
    const service = new CoreTechnicalContinuationService({
      prisma,
      generation: { prepareReviewedDraft },
      persistence: { activateLibraryBlock, publishPreparedBlock, recordPreparationFailure },
      practice: {
        current: vi.fn().mockResolvedValue({ id: "next-block" }),
        historyBlock: vi.fn()
      }
    });

    const result = await service.continue("owner-1", { blockId: BLOCK_ID, requestId: REQUEST_ID });
    expect(result).toEqual({ replayed: false, block: { id: "next-block" } });
    expect(prepareReviewedDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        seniority: "mid",
        baselineState: "STANDARD",
        resumeTopicKeys: [],
        resumeMechanismKeys: []
      }),
      { fallbackToApprovedArtifactOnProviderFailure: true }
    );
    expect(publishPreparedBlock).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        previousBlockId: BLOCK_ID,
        selection
      })
    );
    expect(recordPreparationFailure).not.toHaveBeenCalled();
    expect(activateLibraryBlock).toHaveBeenCalledOnce();
  });

  it("replays a successful Continue request without generating or publishing a duplicate block", async () => {
    const prepareReviewedDraft = vi.fn();
    const publishPreparedBlock = vi.fn();
    const activateLibraryBlock = vi.fn();
    const recordPreparationFailure = vi.fn();
    const current = vi.fn().mockResolvedValue({ id: "next-block", ordinal: 2 });
    const prisma = {
      coreTechnicalPreparationAttempt: {
        findUnique: vi.fn().mockResolvedValue({ status: "SUCCEEDED", blockId: "next-block" })
      }
    } as unknown as PrismaService;
    const service = new CoreTechnicalContinuationService({
      prisma,
      generation: { prepareReviewedDraft },
      persistence: { activateLibraryBlock, publishPreparedBlock, recordPreparationFailure },
      practice: { current, historyBlock: vi.fn() }
    });

    const input = { blockId: BLOCK_ID, requestId: REQUEST_ID };
    await expect(service.continue("owner-1", input)).resolves.toEqual({
      replayed: true,
      block: { id: "next-block", ordinal: 2 }
    });
    await expect(service.continue("owner-1", input)).resolves.toMatchObject({ replayed: true });

    expect(current).toHaveBeenCalledTimes(2);
    expect(prepareReviewedDraft).not.toHaveBeenCalled();
    expect(publishPreparedBlock).not.toHaveBeenCalled();
    expect(recordPreparationFailure).not.toHaveBeenCalled();
  });

  it("lists and reads owner-scoped history from frozen block snapshots only", async () => {
    const report = reportWith(ranking().rankNextStory(focus(), adaptiveEvidence()));
    const findMany = vi.fn().mockResolvedValue([
      {
        id: BLOCK_ID,
        ordinal: 1,
        isCurrent: true,
        status: "ASSESSED",
        storySnapshot: first.story,
        preparedAt: NOW,
        assessedAt: NOW,
        questions: [
          ...Array.from({ length: 7 }, () => ({ status: "COMPLETED" })),
          { status: "LEARNED" }
        ],
        assessment: {
          id: ASSESSMENT_ID,
          status: "COMPLETED",
          report: { reportSnapshot: report }
        }
      }
    ]);
    const historyBlock = vi.fn().mockResolvedValue({ id: BLOCK_ID, story: first.story });
    const service = new CoreTechnicalHistoryService(
      { coreTechnicalBlock: { findMany } } as unknown as PrismaService,
      { historyBlock }
    );

    const list = await service.list("owner-1");
    expect(list[0]).toMatchObject({
      id: BLOCK_ID,
      completedQuestionCount: 7,
      learnedQuestionCount: 1,
      assessment: { overallScore: report.overallScore }
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "owner-1" } })
    );
    await expect(service.read("owner-1", BLOCK_ID)).resolves.toMatchObject({ id: BLOCK_ID });
    expect(historyBlock).toHaveBeenCalledWith("owner-1", BLOCK_ID);
  });
});

function assessmentSnapshot() {
  return buildCoreTechnicalAssessmentSnapshot({
    blockContentFingerprint: `sha256:${"a".repeat(64)}`,
    storySnapshot: first.story,
    questions: first.questionBlock.questions.map((question, index) => ({
      id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
      order: index + 1,
      status: index === 0 ? ("LEARNED" as const) : ("COMPLETED" as const),
      contentFingerprint: `sha256:${String(index + 1)
        .repeat(64)
        .slice(0, 64)}`,
      privateSnapshot: question,
      attempts: index === 0 ? [] : [{ score: 8, verificationStatus: "VERIFIED" }]
    })),
    preparedAt: NOW
  });
}

function ranking() {
  return new CoreTechnicalStoryRankingService(
    NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE.map((story) => ({
      ...story,
      publicationStatus: "published" as const
    }))
  );
}

function adaptiveEvidence(): CoreTechnicalAdaptiveEvidence {
  return {
    schemaVersion: 1,
    assessmentScores: {
      technicalAccuracy: 70,
      mechanismReasoning: 65,
      diagnosisEvidence: 60,
      debuggingImplementation: 75,
      communicationProduction: 80
    },
    practice: {
      completedCount: 7,
      learnedCount: 1,
      meanVerifiedScore: 7,
      hintsUsed: 5,
      acceptedCodeQuestionCount: 1,
      totalCodeQuestionCount: 2,
      weakTopicKeys: ["errors-and-cancellation", "nodejs-streams-and-io"],
      weakMechanismKeys: ["resource-cleanup", "backpressure"]
    },
    priorStoryKeys: [first.story.key],
    priorTopicKeys: first.questionBlock.questions.flatMap((question) => question.topicKeys)
  };
}

function focus(): CoreTechnicalConfirmedFocus {
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
    targetJob: "Backend Engineer",
    targetCompany: null,
    targetDate: null,
    stack: { language: "javascript", runtime: "nodejs", runtimeVersion: "22 LTS", framework: null },
    excludedTopicKeys: [],
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
        questionId: `technical-${index}`,
        questionFingerprint: `sha256:${String(index + 1).repeat(64)}`,
        conceptKeys: [],
        mechanismKeys: [],
        correctness: index < 2 ? ("CORRECT" as const) : ("INCORRECT" as const)
      })),
      weakConceptKeys: ["errors-and-cancellation"],
      strongConceptKeys: [],
      unassessedConceptKeys: topics,
      weakMechanismKeys: ["resource-cleanup"],
      strongMechanismKeys: [],
      unassessedMechanismKeys: mechanisms
    }
  };
}

function evidenceQuestions(options: { learnedFirst: boolean; acceptedCodeRuns: number }) {
  let accepted = 0;
  return first.questionBlock.questions.map((question, index) => {
    const executable = question.runnerContract !== undefined;
    const passed = executable && accepted < options.acceptedCodeRuns;
    if (passed) accepted += 1;
    return {
      order: index + 1,
      status: options.learnedFirst && index === 0 ? ("LEARNED" as const) : ("COMPLETED" as const),
      privateSnapshot: question,
      state: { revealedHintCount: index === 0 ? 3 : 0 },
      attempts: index === 0 ? [] : [{ score: 8, verificationStatus: "VERIFIED" }],
      codeRuns: executable ? [{ passed }] : []
    };
  });
}

function aiEvaluation(snapshot: ReturnType<typeof assessmentSnapshot>) {
  return {
    scores: {
      technicalAccuracy: 78,
      mechanismReasoning: 74,
      diagnosisEvidence: 70,
      debuggingImplementation: 95,
      communicationProduction: 82
    },
    teacherSummary:
      "The candidate explained the main mechanisms clearly but needs stronger deterministic implementation evidence.",
    strengths: ["Clear mechanism reasoning", "Useful production framing"],
    improvementAreas: ["Prove implementation claims with accepted runs"],
    promptFeedback: snapshot.prompts.map((prompt) => ({
      promptId: prompt.id,
      score: 75,
      feedback:
        "The response is grounded but should connect the conclusion to stronger saved evidence."
    }))
  };
}

function startTransaction(
  snapshot: ReturnType<typeof assessmentSnapshot>,
  update: ReturnType<typeof vi.fn>
) {
  return {
    $executeRaw: vi.fn(),
    coreTechnicalAssessment: {
      findFirst: vi.fn().mockResolvedValue(startTransactionRecord(snapshot)),
      update
    },
    coreTechnicalBlock: { update: vi.fn() },
    coreTechnicalStoryProgress: { update: vi.fn() }
  };
}

function startTransactionRecord(snapshot: ReturnType<typeof assessmentSnapshot>) {
  return {
    id: ASSESSMENT_ID,
    status: "READY",
    assessmentSnapshot: snapshot,
    block: {
      id: BLOCK_ID,
      isCurrent: true,
      status: "ASSESSMENT_READY",
      contentFingerprint: snapshot.blockContentFingerprint,
      storySnapshot: first.story,
      storyVersion: { storyKey: first.story.key },
      questions: []
    }
  };
}

function readAssessment(status: string, snapshot: ReturnType<typeof assessmentSnapshot>) {
  return {
    id: ASSESSMENT_ID,
    blockId: BLOCK_ID,
    status,
    schemaVersion: 1,
    evaluatorVersion: "core-technical-assessment-evaluator-v1",
    assessmentSnapshot: snapshot,
    readyAt: NOW,
    startedAt: NOW,
    completedAt: null,
    report: null
  };
}

function reportWith(nextStory: ReturnType<CoreTechnicalStoryRankingService["rankNextStory"]>) {
  return coreTechnicalAssessmentReportSchema.parse({
    schemaVersion: 1,
    evaluatorVersion: "core-technical-assessment-evaluator-v1",
    scoringVersion: "core-technical-assessment-scoring-v1",
    finalizedAt: NOW.toISOString(),
    scores: adaptiveEvidence().assessmentScores,
    overallScore: 70,
    teacherSummary:
      "The assessment demonstrates useful progress and identifies the next mechanisms to strengthen.",
    strengths: ["Clear production reasoning"],
    improvementAreas: ["Strengthen cleanup evidence"],
    promptFeedback: assessmentSnapshot().prompts.map((prompt) => ({
      promptId: prompt.id,
      score: 70,
      feedback: "Good direction with room for more concrete verification evidence."
    })),
    solvedVsLearned: {
      completedCount: 7,
      learnedCount: 1,
      learnedQuestionOrders: [1],
      masteryCreditNote:
        "Question 1 was learned rather than solved and contributes zero Practice mastery credit."
    },
    deterministicEvidence: {
      acceptedCodeQuestionCount: 1,
      totalCodeQuestionCount: 2,
      implementationScoreCapped: true
    },
    nextStory
  });
}
