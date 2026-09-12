import { describe, expect, it, vi } from "vitest";
import {
  ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION,
  ARCHITECTURE_DESIGN_ASSESSMENT_SCORING_VERSION,
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  architectureDesignDimensionSchema,
  toPublicArchitectureDesignQuestion,
  type ArchitectureDesignAssessmentReport,
  type ArchitectureDesignBaselineEvidence,
  type ArchitectureDesignConfirmedFocus
} from "@/features/practice/architecture-design/domain";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/features/practice/architecture-design/domain/reviewed-scenarios";
import type { PrismaService } from "@/server/database/prisma.service";
import { ArchitectureDesignContinuationService } from "./continuation.service";
import { ArchitectureDesignHistoryService } from "./history.service";
import { ArchitectureDesignScenarioRankingService } from "./scenario-ranking.service";
import { ArchitectureDesignWorkspaceAnalyticsService } from "./workspace-analytics.service";

const first = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!;
const FINGERPRINT = `sha256:${"a".repeat(64)}`;
const BLOCK_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const FOCUS_ID = "33333333-3333-4333-8333-333333333333";
const ASSESSMENT_ID = "44444444-4444-4444-8444-444444444444";

describe("Architecture Step 8 services", () => {
  it("continues through the exact published snapshot and atomically hands off current", async () => {
    const report = assessmentReport();
    const selected = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.find(
      ({ caseKey }) => caseKey === report.nextScenario!.selectedScenario.scenarioKey
    )!;
    const publishPreparedBlock = vi.fn().mockResolvedValue({ id: "next-block" });
    const reviewedScenarioVersion = vi.fn().mockResolvedValue({
      contentFingerprint: FINGERPRINT,
      scenario: selected.scenario,
      questionBlock: selected.questionBlock
    });
    const current = vi.fn().mockResolvedValue({ id: "next-block", ordinal: 2 });
    const prisma = {
      architecturePreparationAttempt: { findUnique: vi.fn().mockResolvedValue(null) },
      architectureBlock: {
        findFirst: vi.fn().mockResolvedValue({
          id: BLOCK_ID,
          status: "ASSESSED",
          focusRevisionId: FOCUS_ID,
          focusRevision: { focusSnapshot: focus() },
          assessment: { status: "COMPLETED", report: { reportSnapshot: report } }
        })
      }
    } as unknown as PrismaService;
    const service = new ArchitectureDesignContinuationService({
      prisma,
      repository: {
        reviewedScenarioVersion,
        publishPreparedBlock,
        recordPreparationFailure: vi.fn()
      },
      practice: { current }
    });

    await expect(
      service.continue("owner-1", { blockId: BLOCK_ID, requestId: REQUEST_ID })
    ).resolves.toEqual({ replayed: false, block: { id: "next-block", ordinal: 2 } });
    expect(reviewedScenarioVersion).toHaveBeenCalledWith(
      report.nextScenario!.selectedScenario.scenarioKey,
      report.nextScenario!.selectedScenario.scenarioVersion
    );
    expect(publishPreparedBlock).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        previousBlockId: BLOCK_ID,
        selection: report.nextScenario,
        draft: { scenario: selected.scenario, questionBlock: selected.questionBlock }
      })
    );
  });

  it("promotes an existing loose scenario without republishing its reviewed questions", async () => {
    const report = assessmentReport();
    const activateLibraryBlock = vi.fn().mockResolvedValue({ id: "loose-block" });
    const publishPreparedBlock = vi.fn();
    const historyBlock = vi.fn().mockResolvedValue({ id: "loose-block", isCurrent: true });
    const service = new ArchitectureDesignContinuationService({
      prisma: {
        architecturePreparationAttempt: { findUnique: vi.fn().mockResolvedValue(null) },
        architectureBlock: {
          findFirst: vi.fn().mockResolvedValue({
            id: BLOCK_ID,
            status: "ASSESSED",
            focusRevisionId: FOCUS_ID,
            focusRevision: { focusSnapshot: focus() },
            assessment: { status: "COMPLETED", report: { reportSnapshot: report } }
          })
        }
      } as unknown as PrismaService,
      repository: {
        activateLibraryBlock,
        reviewedScenarioVersion: vi.fn(),
        publishPreparedBlock,
        recordPreparationFailure: vi.fn()
      },
      practice: { current: vi.fn(), historyBlock }
    });

    await expect(
      service.continue("owner-1", { blockId: BLOCK_ID, requestId: REQUEST_ID })
    ).resolves.toEqual({
      replayed: false,
      block: { id: "loose-block", isCurrent: true }
    });
    expect(activateLibraryBlock).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        previousBlockId: BLOCK_ID,
        selection: report.nextScenario
      })
    );
    expect(historyBlock).toHaveBeenCalledWith("owner-1", "loose-block");
    expect(publishPreparedBlock).not.toHaveBeenCalled();
  });

  it("replays successful continuation and does not republish", async () => {
    const publishPreparedBlock = vi.fn();
    const current = vi.fn().mockResolvedValue({ id: "next-block" });
    const service = new ArchitectureDesignContinuationService({
      prisma: {
        architecturePreparationAttempt: {
          findUnique: vi.fn().mockResolvedValue({
            status: "SUCCEEDED",
            blockId: "next-block"
          })
        }
      } as unknown as PrismaService,
      repository: {
        reviewedScenarioVersion: vi.fn(),
        publishPreparedBlock,
        recordPreparationFailure: vi.fn()
      },
      practice: { current }
    });

    await expect(
      service.continue("owner-1", { blockId: BLOCK_ID, requestId: REQUEST_ID })
    ).resolves.toEqual({ replayed: true, block: { id: "next-block" } });
    expect(publishPreparedBlock).not.toHaveBeenCalled();
  });

  it("lists owner-scoped history from immutable block snapshots", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: BLOCK_ID,
        ordinal: 1,
        isCurrent: false,
        status: "ASSESSED",
        selectionSnapshot: firstSelection(),
        scenarioSnapshot: first.scenario,
        preparedAt: new Date("2026-09-06T10:00:00Z"),
        assessedAt: new Date("2026-09-07T10:00:00Z"),
        questions: [
          { status: "COMPLETED" },
          { status: "COMPLETED" },
          { status: "COMPLETED" },
          { status: "LEARNED" }
        ],
        assessment: {
          id: ASSESSMENT_ID,
          status: "COMPLETED",
          report: { reportSnapshot: assessmentReport() }
        }
      }
    ]);
    const historyBlock = vi.fn().mockResolvedValue({ id: BLOCK_ID });
    const service = new ArchitectureDesignHistoryService(
      { architectureBlock: { findMany } } as unknown as PrismaService,
      { historyBlock }
    );

    const result = await service.list("owner-1");
    expect(result[0]).toMatchObject({
      scenario: { key: first.scenario.key },
      completedQuestionCount: 3,
      learnedQuestionCount: 1,
      assessment: { overallScore: 72 }
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "owner-1" } })
    );
    await expect(service.read("owner-1", BLOCK_ID)).resolves.toEqual({ id: BLOCK_ID });
    expect(historyBlock).toHaveBeenCalledWith("owner-1", BLOCK_ID);
  });

  it("projects owner-scoped practice activity, streak, next-up, and assessment rounds", async () => {
    const now = new Date("2026-09-08T12:00:00Z");
    const questionRows = [
      analyticsQuestion(1, "COMPLETED", new Date("2026-09-07T11:00:00Z")),
      analyticsQuestion(2, "LEARNED", new Date("2026-09-08T11:00:00Z")),
      analyticsQuestion(3, "ACTIVE", null)
    ];
    const findQuestions = vi.fn().mockResolvedValue(questionRows);
    const findAttempts = vi
      .fn()
      .mockResolvedValue([
        { createdAt: new Date("2026-09-08T11:30:00Z") },
        { createdAt: new Date("2026-09-07T11:30:00Z") }
      ]);
    const report = assessmentReport();
    const transcript = {
      schemaVersion: 1,
      assessmentId: ASSESSMENT_ID,
      blockId: BLOCK_ID,
      entries: [
        "requirements-scope",
        "api-data-capacity",
        "architecture-tradeoffs",
        "reliability-security-operability",
        "communication-evolution"
      ].map((kind, index) => ({
        promptId: `prompt-${index + 1}`,
        order: index + 1,
        kind,
        prompt: "Explain the bounded architecture decision and defend its main trade-offs.",
        answer: "I would bound the requirement and choose an explicit operational trade-off."
      }))
    };
    const prisma = {
      architectureBlockQuestion: { findMany: findQuestions },
      architectureQuestionAttempt: { findMany: findAttempts },
      candidateProfile: {
        findUnique: vi.fn().mockResolvedValue({ targetRole: "backend", level: "3-5" })
      },
      architectureAssessment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: ASSESSMENT_ID,
            status: "COMPLETED",
            startedAt: new Date("2026-09-08T10:00:00Z"),
            completedAt: now,
            createdAt: new Date("2026-09-08T10:00:00Z"),
            updatedAt: now,
            block: {
              id: BLOCK_ID,
              scenarioSnapshot: first.scenario,
              selectionSnapshot: firstSelection()
            },
            report: { reportSnapshot: report, transcriptSnapshot: transcript, finalizedAt: now }
          }
        ])
      }
    } as unknown as PrismaService;
    const service = new ArchitectureDesignWorkspaceAnalyticsService(prisma);

    await expect(service.practice("owner-1", 7, now)).resolves.toMatchObject({
      totalQuestions: 3,
      completedQuestions: 2,
      totalAttempts: 2,
      solvedThisWeek: 2,
      currentStreakDays: 2,
      nextUp: { title: first.scenario.stages[2]!.title, difficulty: "guided" }
    });
    const rounds = await service.rounds("owner-1", 10, now.getTime());
    expect(rounds.history[0]).toMatchObject({ status: "completed", answerCount: 5 });
    expect(rounds.reports[0]).toMatchObject({
      status: "completed",
      summary: { evidenceScore: 72 },
      codeExercise: null
    });
    expect(findQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "owner-1" } })
    );
  });
});

function analyticsQuestion(order: number, status: string, terminalAt: Date | null) {
  const question = first.questionBlock.questions[order - 1]!;
  return {
    id: `${order}1111111-1111-4111-8111-111111111111`,
    blockId: BLOCK_ID,
    order,
    status,
    publicSnapshot: toPublicArchitectureDesignQuestion(question, false),
    completedAt: status === "COMPLETED" ? terminalAt : null,
    learnedAt: status === "LEARNED" ? terminalAt : null,
    block: {
      isCurrent: true,
      scenarioSnapshot: first.scenario,
      selectionSnapshot: firstSelection()
    }
  };
}

function assessmentReport(): ArchitectureDesignAssessmentReport {
  const nextScenario = ranking().rankNextScenario(focus(), {
    schemaVersion: 1,
    assessmentScores: scores(),
    practice: {
      completedCount: 4,
      learnedCount: 0,
      meanVerifiedScore: 8,
      hintsUsed: 1,
      weakDimensionKeys: ["capacity-estimation"],
      strongDimensionKeys: ["requirements-framing"]
    },
    priorScenarioKeys: [first.scenario.key],
    priorTopicKeys: [first.scenario.primaryTopicKey]
  });
  return {
    schemaVersion: 1,
    evaluatorVersion: ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION,
    scoringVersion: ARCHITECTURE_DESIGN_ASSESSMENT_SCORING_VERSION,
    model: { provider: "test", model: "test-model" },
    promptFingerprint: FINGERPRINT,
    evaluationFingerprint: FINGERPRINT,
    finalizedAt: "2026-09-08T12:00:00.000Z",
    scores: scores(),
    overallScore: 72,
    teacherSummary:
      "The candidate made coherent decisions but needs more quantified operational evidence.",
    strengths: ["Clear boundaries"],
    improvementAreas: ["Quantify overload limits"],
    nextSteps: ["Practise a second scenario with explicit capacity estimates."],
    dimensionMastery: architectureDesignDimensionSchema.options.map((dimensionKey) => ({
      dimensionKey,
      score: 72,
      evidence: "The assessment response provides bounded evidence for this dimension."
    })),
    solvedVsLearned: {
      completedCount: 4,
      learnedCount: 0,
      learnedQuestionOrders: [],
      masteryCreditNote:
        "All four Practice questions were solved, so no Learn action reduced mastery credit."
    },
    nextScenario
  };
}

function scores() {
  return {
    requirementsScope: 70,
    apiDataCapacity: 60,
    architectureTradeoffs: 75,
    reliabilitySecurityOperability: 75,
    communicationEvolution: 80
  };
}

function firstSelection() {
  return ranking().rankFirstScenario(focus());
}

function ranking() {
  return new ArchitectureDesignScenarioRankingService(
    ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.filter(
      ({ publicationStatus }) => publicationStatus === "published"
    )
  );
}

function focus(): ArchitectureDesignConfirmedFocus {
  return {
    schemaVersion: 1,
    focusFingerprint: FINGERPRINT,
    confirmedAt: "2026-09-08T10:00:00.000Z",
    path: "role-aligned",
    role: "backend",
    seniority: "mid",
    targetJob: "Backend Platform Engineer",
    targetCompany: null,
    targetDate: null,
    excludedScenarioKeys: [],
    resumeEvidence: { architectureSkillKeys: ["distributed-systems"], projectKeywords: [] },
    planEvidence: { blueprintId: null, topicKeys: [], skillKeys: [] },
    baselineEvidence: baseline()
  };
}

function baseline(): ArchitectureDesignBaselineEvidence {
  return {
    schemaVersion: 1,
    registryVersion: 1,
    sourceFingerprint: FINGERPRINT,
    questionId: null,
    questionFingerprint: null,
    resolution: "MISSING",
    correctness: "UNKNOWN",
    state: "UNKNOWN",
    dimensionKeys: [],
    weakDimensionKeys: [],
    strongDimensionKeys: [],
    unassessedDimensionKeys: ["requirements-framing", "capacity-estimation"],
    signalConsistency: "UNAVAILABLE"
  };
}
