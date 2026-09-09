import { describe, expect, it, vi } from "vitest";
import {
  appliedEngineeringAssessmentReportSchema,
  publicAppliedEngineeringAssessmentSnapshot
} from "@/features/practice/applied-engineering/domain/assessment-contracts";
import type {
  AppliedEngineeringAdaptiveEvidence,
  AppliedEngineeringConfirmedFocus
} from "@/features/practice/applied-engineering/domain/focus-ranking-contracts";
import { NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE } from "@/features/practice/applied-engineering/domain/incident-ranking-catalogue";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/features/practice/applied-engineering/domain/reviewed-incidents";
import type { PrismaService } from "@/server/database/prisma.service";
import { buildAppliedEngineeringAssessmentSnapshot } from "./assessment-blueprint";
import { AppliedEngineeringAssessmentEvaluator } from "./assessment-evaluator";
import { AppliedEngineeringAssessmentService } from "./assessment.service";
import { AppliedEngineeringContinuationService } from "./continuation.service";
import { AppliedEngineeringHistoryService } from "./history.service";
import { AppliedEngineeringIncidentRankingService } from "./incident-ranking.service";
import { AppliedEngineeringWorkspaceAnalyticsService } from "./workspace-analytics.service";

const first = APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]!;
const second = APPLIED_ENGINEERING_REVIEW_CANDIDATES[1]!;
const NOW = new Date("2026-09-08T12:00:00.000Z");
const BLOCK_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

describe("Applied Engineering assessment, adaptation, continuation, and analytics", () => {
  it("freezes five production prompts and exposes only their public projection", () => {
    const snapshot = assessmentSnapshot();
    expect(snapshot.prompts.map((prompt) => prompt.kind)).toEqual([
      "evidence-defence",
      "repair-defence",
      "unseen-diagnosis-transfer",
      "verification-transfer",
      "rollout-defence"
    ]);
    const serialized = JSON.stringify(publicAppliedEngineeringAssessmentSnapshot(snapshot));
    expect(serialized).not.toContain("privateEvaluation");
    expect(serialized).not.toContain("expectedAnswer");
    expect(serialized).not.toContain("rubric");
    expect(serialized).not.toContain("responseFingerprint");
  });

  it("uses semantic scoring, caps unsupported code claims, and gives Learn zero mastery", async () => {
    const snapshot = assessmentSnapshot();
    const generateStructured = vi.fn().mockResolvedValue(aiEvaluation(snapshot));
    const evaluator = new AppliedEngineeringAssessmentEvaluator(
      { generateStructured } as never,
      ranking()
    );
    const result = await evaluator.evaluate({
      assessmentId: ASSESSMENT_ID,
      blockId: BLOCK_ID,
      incidentKey: first.incident.key,
      focus: focus(),
      snapshot,
      responses: responses(snapshot),
      questions: evidenceQuestions({ learnedFirst: true, acceptedCodeRuns: 0 }),
      priorIncidentKeys: [first.incident.key],
      priorTopicKeys: first.questionBlock.questions.flatMap((question) => question.topicKeys),
      finalizedAt: NOW
    });

    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "applied-engineering.assessment.finalize" })
    );
    expect(result.report.scores.implementationCorrectness).toBe(35);
    expect(result.report.deterministicEvidence).toMatchObject({
      acceptedCodeQuestionCount: 0,
      totalCodeQuestionCount: 2,
      implementationScoreCapped: true
    });
    expect(result.report.solvedVsLearned).toMatchObject({
      learnedCount: 1,
      learnedQuestionOrders: [1]
    });
    expect(result.report.nextIncident.selectedIncident.incidentKey).toBe(second.incident.key);
    expect(result.report.nextIncident.evidence.assessmentScores.implementationCorrectness).toBe(35);
    expect(JSON.stringify(result.transcript)).not.toContain("expectedAnswer");
    expect(JSON.stringify(result.transcript)).not.toContain("rubric");
  });

  it("starts a READY assessment once and resumes the frozen snapshot", async () => {
    const snapshot = assessmentSnapshot();
    const assessmentUpdate = vi.fn();
    const tx = startTransaction(snapshot, assessmentUpdate);
    const prisma = {
      $transaction: vi.fn().mockImplementation((work: (client: typeof tx) => unknown) => work(tx)),
      appliedEngineeringAssessment: {
        findFirst: vi.fn().mockResolvedValue(readAssessment("IN_PROGRESS", snapshot))
      }
    } as unknown as PrismaService;
    const service = new AppliedEngineeringAssessmentService(
      prisma,
      { evaluate: vi.fn() },
      () => NOW
    );

    const started = await service.start("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: REQUEST_ID
    });
    expect(started.status).toBe("IN_PROGRESS");
    expect(assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_PROGRESS", startRequestId: REQUEST_ID })
      })
    );

    tx.appliedEngineeringAssessment.findFirst.mockResolvedValueOnce({
      ...startTransactionRecord(snapshot),
      status: "IN_PROGRESS"
    });
    await service.start("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: "44444444-4444-4444-8444-444444444444"
    });
    expect(assessmentUpdate).toHaveBeenCalledTimes(1);
  });

  it("checkpoints finalization before atomically publishing one report", async () => {
    const snapshot = assessmentSnapshot();
    const answerSet = responses(snapshot);
    const report = reportWith(
      ranking().rankNextIncident(focus(), adaptiveEvidence())
    );
    const transcript = transcriptFor(snapshot, answerSet);
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
        block: { incidentVersion: { incidentKey: first.incident.key } }
      });
    const tx = {
      $executeRaw: vi.fn(),
      appliedEngineeringAssessment: { findFirst: txFind, update: assessmentUpdate },
      appliedEngineeringAssessmentReport: { create: reportCreate },
      appliedEngineeringBlock: { update: vi.fn() },
      appliedEngineeringIncidentProgress: { update: vi.fn() }
    };
    const evidenceBlock = {
      id: BLOCK_ID,
      ordinal: 1,
      focusRevision: { focusSnapshot: focus() },
      incidentVersion: { incidentKey: first.incident.key },
      questions: evidenceQuestions({ learnedFirst: true, acceptedCodeRuns: 1 })
    };
    const completedRead = {
      ...readAssessment("COMPLETED", {
        ...snapshot,
        submission: {
          requestId: REQUEST_ID,
          responseFingerprint: `sha256:${"e".repeat(64)}`,
          responses: answerSet,
          submittedAt: NOW.toISOString()
        }
      }),
      completedAt: NOW,
      report: { reportSnapshot: report, transcriptSnapshot: transcript, finalizedAt: NOW }
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((work: (client: typeof tx) => unknown) => work(tx)),
      appliedEngineeringAssessment: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ block: evidenceBlock })
          .mockResolvedValueOnce(completedRead)
      },
      appliedEngineeringBlock: {
        findMany: vi.fn().mockResolvedValue([
          {
            incidentVersion: { incidentKey: first.incident.key },
            questions: first.questionBlock.questions.map((question) => ({
              privateSnapshot: question
            }))
          }
        ])
      }
    } as unknown as PrismaService;
    const evaluate = vi.fn().mockResolvedValue({
      report,
      transcript,
      evidence: adaptiveEvidence()
    });
    const service = new AppliedEngineeringAssessmentService(
      prisma,
      { evaluate },
      () => NOW
    );

    const finalized = await service.finalize("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: REQUEST_ID,
      responses: answerSet
    });

    expect(finalized.status).toBe("COMPLETED");
    expect(reportCreate).toHaveBeenCalledOnce();
    expect(assessmentUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ status: "FINALIZING", finalizationRequestId: REQUEST_ID })
      })
    );
    expect(assessmentUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { status: "COMPLETED", completedAt: NOW } })
    );
  });

  it("rejects a completed finalization replay when the same request ID has different answers", async () => {
    const snapshot = assessmentSnapshot();
    const answerSet = responses(snapshot);
    const submitted = {
      ...snapshot,
      submission: {
        requestId: REQUEST_ID,
        responseFingerprint: `sha256:${"f".repeat(64)}`,
        responses: answerSet,
        submittedAt: NOW.toISOString()
      }
    };
    const tx = {
      $executeRaw: vi.fn(),
      appliedEngineeringAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          id: ASSESSMENT_ID,
          blockId: BLOCK_ID,
          status: "COMPLETED",
          finalizationRequestId: REQUEST_ID,
          assessmentSnapshot: submitted,
          report: { id: "report-1" },
          block: { isCurrent: true }
        })
      }
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;
    const service = new AppliedEngineeringAssessmentService(prisma, { evaluate: vi.fn() });

    await expect(
      service.finalize("owner-1", {
        assessmentId: ASSESSMENT_ID,
        requestId: REQUEST_ID,
        responses: answerSet.map((answer, index) =>
          index === 0 ? { ...answer, answer: `${answer.answer} changed` } : answer
        )
      })
    ).rejects.toMatchObject({ code: "APPLIED_ENGINEERING_FINALIZATION_REQUEST_CONFLICT" });
  });

  it("continues only through the exact published incident and atomically hands off current", async () => {
    const selection = ranking().rankNextIncident(focus(), adaptiveEvidence());
    const report = reportWith(selection);
    const publishPreparedBlock = vi.fn().mockResolvedValue({ id: "next-block" });
    const recordPreparationFailure = vi.fn();
    const current = vi.fn().mockResolvedValue({ id: "next-block", ordinal: 2 });
    const prisma = {
      appliedEngineeringPreparationAttempt: { findUnique: vi.fn().mockResolvedValue(null) },
      appliedEngineeringBlock: {
        findFirst: vi.fn().mockResolvedValue({
          id: BLOCK_ID,
          status: "ASSESSED",
          focusRevisionId: "55555555-5555-4555-8555-555555555555",
          focusRevision: { focusSnapshot: focus() },
          assessment: { status: "COMPLETED", report: { reportSnapshot: report } }
        })
      },
      appliedEngineeringIncidentVersion: {
        findUnique: vi.fn().mockResolvedValue({
          publicationStatus: "PUBLISHED",
          incidentSnapshot: second.incident
        })
      }
    } as unknown as PrismaService;
    const service = new AppliedEngineeringContinuationService({
      prisma,
      persistence: { publishPreparedBlock, recordPreparationFailure },
      practice: { current }
    });

    await expect(
      service.continue("owner-1", { blockId: BLOCK_ID, requestId: REQUEST_ID })
    ).resolves.toEqual({ replayed: false, block: { id: "next-block", ordinal: 2 } });
    expect(publishPreparedBlock).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({ previousBlockId: BLOCK_ID, selection })
    );
    expect(recordPreparationFailure).not.toHaveBeenCalled();
  });

  it("keeps the report current and records a retryable continuation publication failure", async () => {
    const selection = ranking().rankNextIncident(focus(), adaptiveEvidence());
    const report = reportWith(selection);
    const recordPreparationFailure = vi.fn().mockResolvedValue({ status: "FAILED" });
    const prisma = {
      appliedEngineeringPreparationAttempt: { findUnique: vi.fn().mockResolvedValue(null) },
      appliedEngineeringBlock: {
        findFirst: vi.fn().mockResolvedValue({
          id: BLOCK_ID,
          status: "ASSESSED",
          focusRevisionId: "55555555-5555-4555-8555-555555555555",
          focusRevision: { focusSnapshot: focus() },
          assessment: { status: "COMPLETED", report: { reportSnapshot: report } }
        })
      },
      appliedEngineeringIncidentVersion: {
        findUnique: vi.fn().mockResolvedValue({
          publicationStatus: "PUBLISHED",
          incidentSnapshot: second.incident
        })
      }
    } as unknown as PrismaService;
    const service = new AppliedEngineeringContinuationService({
      prisma,
      persistence: {
        publishPreparedBlock: vi.fn().mockRejectedValue(new Error("database unavailable")),
        recordPreparationFailure
      },
      practice: { current: vi.fn() }
    });

    await expect(
      service.continue("owner-1", { blockId: BLOCK_ID, requestId: REQUEST_ID })
    ).rejects.toMatchObject({ code: "APPLIED_ENGINEERING_CONTINUATION_FAILED" });
    expect(recordPreparationFailure).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        requestId: REQUEST_ID,
        diagnostic: expect.objectContaining({ stage: "publishing", retryable: true })
      })
    );
  });

  it("lists snapshot-only history with the frozen report score", async () => {
    const report = reportWith(ranking().rankNextIncident(focus(), adaptiveEvidence()));
    const findMany = vi.fn().mockResolvedValue([
      {
        id: BLOCK_ID,
        ordinal: 1,
        isCurrent: true,
        status: "ASSESSED",
        incidentSnapshot: first.incident,
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
    const historyBlock = vi.fn().mockResolvedValue({ id: BLOCK_ID });
    const service = new AppliedEngineeringHistoryService(
      { appliedEngineeringBlock: { findMany } } as unknown as PrismaService,
      { historyBlock }
    );

    const list = await service.list("owner-1");
    expect(list[0]).toMatchObject({
      completedQuestionCount: 7,
      learnedQuestionCount: 1,
      assessment: { overallScore: report.overallScore }
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "owner-1" } }));
  });

  it("projects practice activity, next question, streak, assessment history, and reports", async () => {
    const snapshot = assessmentSnapshot();
    const answerSet = responses(snapshot);
    const report = reportWith(ranking().rankNextIncident(focus(), adaptiveEvidence()));
    const prisma = {
      appliedEngineeringBlockQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "question-1",
            blockId: BLOCK_ID,
            order: 1,
            status: "COMPLETED",
            publicSnapshot: first.questionBlock.questions[0],
            completedAt: new Date("2026-09-07T10:00:00Z"),
            learnedAt: null,
            block: { isCurrent: true, incidentSnapshot: first.incident }
          },
          {
            id: "question-2",
            blockId: BLOCK_ID,
            order: 2,
            status: "ACTIVE",
            publicSnapshot: publicQuestion(first.questionBlock.questions[1]!),
            completedAt: null,
            learnedAt: null,
            block: { isCurrent: true, incidentSnapshot: first.incident }
          }
        ])
      },
      appliedEngineeringQuestionAttempt: {
        findMany: vi.fn().mockResolvedValue([{ createdAt: new Date("2026-09-08T10:00:00Z") }])
      },
      candidateProfile: {
        findUnique: vi.fn().mockResolvedValue({ targetRole: "backend", level: "3-5" })
      },
      appliedEngineeringAssessment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: ASSESSMENT_ID,
            status: "COMPLETED",
            startedAt: NOW,
            completedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
            block: { id: BLOCK_ID, incidentSnapshot: first.incident },
            report: {
              reportSnapshot: report,
              transcriptSnapshot: transcriptFor(snapshot, answerSet),
              finalizedAt: NOW
            }
          }
        ])
      }
    } as unknown as PrismaService;
    const service = new AppliedEngineeringWorkspaceAnalyticsService(prisma);

    const practice = await service.practice("owner-1", 7, NOW);
    expect(practice).toMatchObject({
      totalQuestions: 2,
      completedQuestions: 1,
      totalAttempts: 1,
      currentStreakDays: 1,
      nextUp: expect.objectContaining({
        href: expect.stringContaining("/practice/applied-engineering/questions/question-2")
      })
    });
    const rounds = await service.rounds("owner-1", 50, NOW.getTime());
    expect(rounds.history).toHaveLength(1);
    expect(rounds.reports[0]).toMatchObject({
      sessionId: `applied-engineering:${ASSESSMENT_ID}`,
      status: "completed",
      competencies: expect.any(Array)
    });
  });
});

function assessmentSnapshot() {
  return buildAppliedEngineeringAssessmentSnapshot({
    blockContentFingerprint: `sha256:${"a".repeat(64)}`,
    selectionSnapshot: firstSelection(),
    preparedAt: NOW,
    questions: first.questionBlock.questions.map((question, index) => ({
      id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
      order: question.order,
      status: index === 0 ? ("LEARNED" as const) : ("COMPLETED" as const),
      contentFingerprint: `sha256:${String(index + 1).repeat(64).slice(0, 64)}`,
      privateSnapshot: question,
      attempts: index === 0 ? [] : [{ score: 8, verificationStatus: "VERIFIED" }]
    }))
  });
}

function firstSelection() {
  const selectedIncident = {
    incidentKey: first.incident.key,
    incidentVersion: 1,
    title: first.incident.title,
    difficulty: first.incident.difficulty,
    emphasizedSignalKeys: first.incident.productionSignalKeys.slice(0, 4),
    scores: {
      baselineGapTransfer: 20,
      targetRoleJob: 12,
      resumeProjectRelevance: 4,
      productionEvidenceCoverage: 10,
      plannedCoverage: 4,
      novelty: 5,
      total: 55
    }
  };
  return {
    policyVersion: 1 as const,
    focusFingerprint: focus().focusFingerprint,
    selectedIncident,
    rankings: [selectedIncident],
    reason: "This incident reinforces production diagnosis and safe delivery."
  };
}

function focus(): AppliedEngineeringConfirmedFocus {
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
    excludedIncidentKeys: [],
    resumeEvidence: {
      technologyKeys: ["nodejs"],
      projectKeywords: ["payments api"],
      productionSignalKeys: ["retry-safety", "testing-verification"]
    },
    baselineEvidence: {
      schemaVersion: 1,
      registryVersion: 1,
      sourceFingerprint: `sha256:${"b".repeat(64)}`,
      source: "initial-baseline",
      state: "STANDARD",
      evidence: "baseline",
      confidence: 0.8,
      questionId: "applied-engineering-baseline",
      familiarity: "needs-refresh",
      weakSignalKeys: ["retry-safety"],
      strongSignalKeys: ["customer-impact"],
      unassessedSignalKeys: ["database-performance", "caching"],
      sourceTopicLabels: ["Retries"],
      sourceAreaId: "applied-engineering"
    }
  };
}

function ranking() {
  return new AppliedEngineeringIncidentRankingService(
    NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE
  );
}

function adaptiveEvidence(): AppliedEngineeringAdaptiveEvidence {
  return {
    schemaVersion: 1,
    assessmentScores: {
      diagnosisEvidence: 65,
      implementationCorrectness: 60,
      testingVerification: 55,
      productionJudgment: 70,
      ownershipDelivery: 75
    },
    practice: {
      completedCount: 7,
      learnedCount: 1,
      meanVerifiedScore: 7,
      hintsUsed: 4,
      acceptedCodeQuestionCount: 1,
      weakTopicKeys: first.questionBlock.questions.flatMap((question) => question.topicKeys).slice(0, 2),
      weakSignalKeys: ["database-performance", "caching", "testing-verification"]
    },
    priorIncidentKeys: [first.incident.key],
    priorTopicKeys: first.questionBlock.questions.flatMap((question) => question.topicKeys)
  };
}

function evidenceQuestions(options: { learnedFirst: boolean; acceptedCodeRuns: number }) {
  let accepted = 0;
  return first.questionBlock.questions.map((question, index) => {
    const executable = question.runnerContract !== undefined;
    const passed = executable && accepted < options.acceptedCodeRuns;
    if (passed) accepted += 1;
    return {
      order: question.order,
      status: options.learnedFirst && index === 0 ? ("LEARNED" as const) : ("COMPLETED" as const),
      privateSnapshot: question,
      state: { revealedHintCount: index === 0 ? 3 : 0 },
      attempts: index === 0 ? [] : [{ score: 8, verificationStatus: "VERIFIED" }],
      codeRuns: executable ? [{ passed }] : []
    };
  });
}

function responses(snapshot: ReturnType<typeof assessmentSnapshot>) {
  return snapshot.prompts.map((prompt) => ({
    promptId: prompt.id,
    answer: `A grounded response for ${prompt.id} with evidence, invariant, tests, rollout signals, and rollback thresholds.`
  }));
}

function aiEvaluation(snapshot: ReturnType<typeof assessmentSnapshot>) {
  return {
    scores: {
      diagnosisEvidence: 78,
      implementationCorrectness: 95,
      testingVerification: 72,
      productionJudgment: 82,
      ownershipDelivery: 80
    },
    teacherSummary:
      "The candidate connects production evidence to a repair but needs stronger deterministic implementation proof.",
    strengths: ["Clear evidence-led diagnosis", "Useful rollout framing"],
    improvementAreas: ["Prove implementation claims with accepted runs"],
    promptFeedback: snapshot.prompts.map((prompt) => ({
      promptId: prompt.id,
      score: 75,
      feedback: "The response is grounded but should tie the conclusion to stronger saved evidence."
    }))
  };
}

function startTransaction(snapshot: ReturnType<typeof assessmentSnapshot>, update: ReturnType<typeof vi.fn>) {
  return {
    $executeRaw: vi.fn(),
    appliedEngineeringAssessment: {
      findFirst: vi.fn().mockResolvedValue(startTransactionRecord(snapshot)),
      update
    },
    appliedEngineeringBlock: { update: vi.fn() },
    appliedEngineeringIncidentProgress: { update: vi.fn() }
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
      contentFingerprint: snapshot.blockContentFingerprint,
      selectionSnapshot: firstSelection(),
      incidentVersion: { incidentKey: first.incident.key },
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
    evaluatorVersion: "applied-engineering-assessment-evaluator-v1",
    assessmentSnapshot: snapshot,
    readyAt: NOW,
    startedAt: NOW,
    completedAt: null,
    report: null
  };
}

function reportWith(nextIncident: ReturnType<AppliedEngineeringIncidentRankingService["rankNextIncident"]>) {
  return appliedEngineeringAssessmentReportSchema.parse({
    schemaVersion: 1,
    evaluatorVersion: "applied-engineering-assessment-evaluator-v1",
    scoringVersion: "applied-engineering-assessment-scoring-v1",
    finalizedAt: NOW.toISOString(),
    scores: adaptiveEvidence().assessmentScores,
    overallScore: 65,
    teacherSummary:
      "The assessment demonstrates useful production reasoning and identifies the next operational signals to strengthen.",
    strengths: ["Clear evidence-led production reasoning"],
    improvementAreas: ["Strengthen deterministic verification evidence"],
    promptFeedback: assessmentSnapshot().prompts.map((prompt) => ({
      promptId: prompt.id,
      score: 65,
      feedback: "Good direction with room for more concrete verification evidence."
    })),
    solvedVsLearned: {
      completedCount: 7,
      learnedCount: 1,
      learnedQuestionOrders: [1],
      masteryCreditNote: "Question 1 was learned rather than solved and contributes zero Practice mastery credit."
    },
    deterministicEvidence: {
      acceptedCodeQuestionCount: 1,
      totalCodeQuestionCount: 2,
      implementationScoreCapped: true
    },
    nextIncident
  });
}

function transcriptFor(
  snapshot: ReturnType<typeof assessmentSnapshot>,
  answerSet: ReturnType<typeof responses>
) {
  return {
    schemaVersion: 1 as const,
    assessmentId: ASSESSMENT_ID,
    blockId: BLOCK_ID,
    entries: snapshot.prompts.map((prompt, index) => ({
      promptId: prompt.id,
      order: prompt.order,
      kind: prompt.kind,
      prompt: prompt.prompt,
      answer: answerSet[index]!.answer
    }))
  };
}

function publicQuestion(question: (typeof first.questionBlock.questions)[number]) {
  return {
    key: question.key,
    incidentKey: question.incidentKey,
    stageKey: question.stageKey,
    order: question.order,
    format: question.format,
    topicKeys: question.topicKeys,
    productionSignalKeys: question.productionSignalKeys,
    prompt: question.prompt,
    artifact: question.artifact,
    choices: question.choices,
    hintCount: 3,
    starterCode: question.starterCode,
    publicTests: question.publicTests,
    runnerContract: question.runnerContract
  };
}
