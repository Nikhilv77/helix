import { describe, expect, it, vi } from "vitest";
import {
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  architectureDesignDimensionSchema,
  publicArchitectureDesignAssessmentSnapshot,
  type ArchitectureDesignBaselineEvidence,
  type ArchitectureDesignConfirmedFocus
} from "@/lib/practice/architecture-design";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/lib/practice/architecture-design/reviewed-scenarios";
import type { PrismaService } from "@/server/database/prisma.service";
import { storyPracticeFingerprint } from "@/server/story-practice/practice-orchestrator";
import { buildArchitectureDesignAssessmentSnapshot } from "./assessment-blueprint";
import { ArchitectureDesignAssessmentEvaluator } from "./assessment-evaluator";
import { ArchitectureDesignAssessmentService } from "./assessment.service";
import { ArchitectureDesignScenarioRankingService } from "./scenario-ranking.service";

const FINGERPRINT = `sha256:${"a".repeat(64)}`;
const BLOCK_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-09-08T13:00:00Z");

describe("Architecture assessment blueprint and evaluator", () => {
  it("freezes five prompts from four terminal questions without exposing evaluation material", () => {
    const snapshot = assessmentSnapshot();
    const publicSnapshot = publicArchitectureDesignAssessmentSnapshot(snapshot);

    expect(snapshot.prompts).toHaveLength(5);
    expect(snapshot.prompts.map(({ kind }) => kind)).toEqual([
      "requirements-scope",
      "api-data-capacity",
      "architecture-tradeoffs",
      "reliability-security-operability",
      "communication-evolution"
    ]);
    expect(JSON.stringify(publicSnapshot)).not.toMatch(/privateEvaluation|expectedAnswer|rubric/);
    expect(() =>
      buildArchitectureDesignAssessmentSnapshot({
        blockContentFingerprint: FINGERPRINT,
        selectionSnapshot: selection(),
        questions: blueprintQuestions().map((question, index) =>
          index === 0 ? { ...question, status: "ACTIVE" as const } : question
        ),
        preparedAt: new Date("2026-09-08T12:00:00Z")
      })
    ).toThrow("four terminal questions");
  });

  it("produces a versioned immutable report, zeroes Learned practice mastery, and adapts", async () => {
    const generateStructured = vi.fn().mockResolvedValue(evaluation());
    const evaluator = new ArchitectureDesignAssessmentEvaluator(
      { generateStructured },
      new ArchitectureDesignScenarioRankingService(publishedCatalogue()),
      { provider: "test-provider", model: "test-model" }
    );
    const snapshot = assessmentSnapshot();
    const responses = snapshot.prompts.map(({ id }) => ({
      promptId: id,
      answer: "A bounded candidate answer with explicit assumptions and trade-offs."
    }));

    const result = await evaluator.evaluate({
      assessmentId: ASSESSMENT_ID,
      blockId: BLOCK_ID,
      scenarioKey: selection().selectedScenario.scenarioKey,
      focus: focus(),
      snapshot: {
        ...snapshot,
        submission: {
          requestId: "33333333-3333-4333-8333-333333333333",
          responseFingerprint: FINGERPRINT,
          responses,
          submittedAt: "2026-09-08T12:30:00.000Z"
        }
      },
      responses,
      questions: blueprintQuestions().map((question, index) => ({
        order: question.order,
        status: index === 0 ? ("LEARNED" as const) : ("COMPLETED" as const),
        privateSnapshot: question.privateSnapshot,
        state: { revealedHintCount: index },
        attempts: index === 0 ? [] : [{ score: 8, verificationStatus: "VERIFIED" }]
      })),
      priorScenarioKeys: [selection().selectedScenario.scenarioKey],
      priorTopicKeys: ["webhook-delivery"],
      finalizedAt: new Date("2026-09-08T13:00:00Z")
    });

    expect(result.report).toMatchObject({
      overallScore: 72,
      model: { provider: "test-provider", model: "test-model" },
      solvedVsLearned: { completedCount: 3, learnedCount: 1, learnedQuestionOrders: [1] }
    });
    expect(result.report.dimensionMastery).toHaveLength(16);
    expect(result.report.nextScenario.selectedScenario.scenarioKey).not.toBe(
      selection().selectedScenario.scenarioKey
    );
    expect(result.evidence.practice.meanVerifiedScore).toBe(6);
    expect(result.transcript.entries).toHaveLength(5);
    expect(JSON.stringify(result.transcript)).not.toMatch(/expectedAnswer|rubric/);
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "architecture-design.assessment.finalize" })
    );
  });

  it("starts once, persists the frozen blueprint, and resumes it without rebuilding", async () => {
    const frozen = assessmentSnapshot();
    const assessmentUpdate = vi.fn();
    const txFind = vi
      .fn()
      .mockResolvedValueOnce(startRecord(null, "READY"))
      .mockResolvedValueOnce(startRecord(frozen, "IN_PROGRESS"));
    const tx = {
      $executeRaw: vi.fn(),
      architectureAssessment: { findFirst: txFind, update: assessmentUpdate },
      architectureBlockQuestion: { updateMany: vi.fn() },
      architectureBlock: { update: vi.fn() },
      architectureScenarioProgress: { update: vi.fn() }
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((work: (client: typeof tx) => unknown) => work(tx)),
      architectureAssessment: {
        findFirst: vi.fn().mockResolvedValue(readAssessment("IN_PROGRESS", frozen))
      }
    } as unknown as PrismaService;
    const service = new ArchitectureDesignAssessmentService(
      prisma,
      { evaluate: vi.fn() },
      () => new Date("2026-09-08T12:00:00Z")
    );

    const started = await service.start("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: "33333333-3333-4333-8333-333333333333"
    });
    expect(started.status).toBe("IN_PROGRESS");
    expect(JSON.stringify(started)).not.toMatch(/privateEvaluation|expectedAnswer|rubric/);
    expect(assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "IN_PROGRESS",
          assessmentSnapshot: frozen
        })
      })
    );

    await service.start("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: "44444444-4444-4444-8444-444444444444"
    });
    expect(assessmentUpdate).toHaveBeenCalledTimes(1);
  });

  it("checkpoints finalization before atomically publishing one immutable report", async () => {
    const frozen = assessmentSnapshot();
    const responses = frozen.prompts.map(({ id }) => ({
      promptId: id,
      answer: "A bounded candidate answer with explicit assumptions and trade-offs."
    }));
    const submitted = {
      ...frozen,
      submission: {
        requestId: REQUEST_ID,
        responseFingerprint: storyPracticeFingerprint(responses),
        responses,
        submittedAt: NOW.toISOString()
      }
    };
    const evaluated = await evaluatedFixture(submitted, responses);
    const assessmentUpdate = vi.fn();
    const reportCreate = vi.fn();
    const txFind = vi
      .fn()
      .mockResolvedValueOnce({
        status: "IN_PROGRESS",
        finalizationRequestId: null,
        assessmentSnapshot: frozen,
        report: null,
        block: { isCurrent: true }
      })
      .mockResolvedValueOnce({
        blockId: BLOCK_ID,
        status: "FINALIZING",
        finalizationRequestId: REQUEST_ID,
        report: null,
        block: { scenarioVersion: { scenarioKey: selection().selectedScenario.scenarioKey } }
      });
    const tx = {
      $executeRaw: vi.fn(),
      architectureAssessment: { findFirst: txFind, update: assessmentUpdate },
      architectureAssessmentReport: { create: reportCreate },
      architectureBlock: { update: vi.fn() },
      architectureScenarioProgress: { update: vi.fn() }
    };
    const evidenceQuestions = blueprintQuestions().map((question) => ({
      order: question.order,
      status: question.status,
      privateSnapshot: question.privateSnapshot,
      state: { revealedHintCount: 0 },
      attempts: [{ score: 8, verificationStatus: "VERIFIED" }]
    }));
    const completedRead = {
      ...readAssessment("COMPLETED", submitted),
      completedAt: NOW,
      report: {
        reportSnapshot: evaluated.report,
        transcriptSnapshot: evaluated.transcript,
        finalizedAt: NOW
      }
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((work: (client: typeof tx) => unknown) => work(tx)),
      architectureAssessment: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            block: {
              id: BLOCK_ID,
              ordinal: 1,
              focusRevision: { focusSnapshot: focus() },
              scenarioVersion: { scenarioKey: selection().selectedScenario.scenarioKey },
              questions: evidenceQuestions
            }
          })
          .mockResolvedValueOnce(completedRead)
      },
      architectureBlock: {
        findMany: vi.fn().mockResolvedValue([
          {
            scenarioVersion: { scenarioKey: selection().selectedScenario.scenarioKey },
            questions: blueprintQuestions().map(({ privateSnapshot }) => ({ privateSnapshot }))
          }
        ])
      }
    } as unknown as PrismaService;
    const evaluate = vi.fn().mockResolvedValue(evaluated);
    const service = new ArchitectureDesignAssessmentService(prisma, { evaluate }, () => NOW);

    const finalized = await service.finalize("owner-1", {
      assessmentId: ASSESSMENT_ID,
      requestId: REQUEST_ID,
      responses
    });

    expect(finalized).toMatchObject({ status: "COMPLETED", report: { overallScore: 72 } });
    expect(assessmentUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ status: "FINALIZING", finalizationRequestId: REQUEST_ID })
      })
    );
    expect(reportCreate).toHaveBeenCalledOnce();
    expect(assessmentUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { status: "COMPLETED", completedAt: NOW } })
    );
  });

  it("replays a completed finalization without evaluating or creating another report", async () => {
    const frozen = assessmentSnapshot();
    const responses = frozen.prompts.map(({ id }) => ({
      promptId: id,
      answer: "A bounded candidate answer with explicit assumptions and trade-offs."
    }));
    const requestId = "33333333-3333-4333-8333-333333333333";
    const submitted = {
      ...frozen,
      submission: {
        requestId,
        responseFingerprint: storyPracticeFingerprint(responses),
        responses,
        submittedAt: "2026-09-08T12:30:00.000Z"
      }
    };
    const evaluated = await evaluatedFixture(submitted, responses);
    const tx = {
      $executeRaw: vi.fn(),
      architectureAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          status: "COMPLETED",
          finalizationRequestId: requestId,
          assessmentSnapshot: submitted,
          report: { id: "report-1" },
          block: { isCurrent: true }
        })
      }
    };
    const evaluate = vi.fn();
    const prisma = {
      $transaction: vi.fn().mockImplementation((work: (client: typeof tx) => unknown) => work(tx)),
      architectureAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          ...readAssessment("COMPLETED", submitted),
          completedAt: new Date("2026-09-08T13:00:00Z"),
          report: {
            reportSnapshot: evaluated.report,
            transcriptSnapshot: evaluated.transcript,
            finalizedAt: new Date("2026-09-08T13:00:00Z")
          }
        })
      }
    } as unknown as PrismaService;
    const service = new ArchitectureDesignAssessmentService(prisma, { evaluate });

    await expect(
      service.finalize("owner-1", { assessmentId: ASSESSMENT_ID, requestId, responses })
    ).resolves.toMatchObject({ status: "COMPLETED", report: { overallScore: 72 } });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("rejects a completed replay when the same request ID carries different answers", async () => {
    const frozen = assessmentSnapshot();
    const responses = frozen.prompts.map(({ id }) => ({
      promptId: id,
      answer: "A bounded candidate answer with explicit assumptions and trade-offs."
    }));
    const submitted = {
      ...frozen,
      submission: {
        requestId: REQUEST_ID,
        responseFingerprint: storyPracticeFingerprint(responses),
        responses,
        submittedAt: NOW.toISOString()
      }
    };
    const tx = {
      $executeRaw: vi.fn(),
      architectureAssessment: {
        findFirst: vi.fn().mockResolvedValue({
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
    const service = new ArchitectureDesignAssessmentService(prisma, { evaluate: vi.fn() });

    await expect(
      service.finalize("owner-1", {
        assessmentId: ASSESSMENT_ID,
        requestId: REQUEST_ID,
        responses: responses.map((response, index) =>
          index === 0 ? { ...response, answer: `${response.answer} Changed.` } : response
        )
      })
    ).rejects.toMatchObject({ code: "ARCHITECTURE_DESIGN_FINALIZATION_REQUEST_CONFLICT" });
  });
});

function assessmentSnapshot() {
  return buildArchitectureDesignAssessmentSnapshot({
    blockContentFingerprint: FINGERPRINT,
    selectionSnapshot: selection(),
    questions: blueprintQuestions(),
    preparedAt: new Date("2026-09-08T12:00:00Z")
  });
}

function startRecord(assessmentSnapshot: unknown, status: "READY" | "IN_PROGRESS") {
  return {
    id: ASSESSMENT_ID,
    status,
    assessmentSnapshot,
    block: {
      id: BLOCK_ID,
      isCurrent: true,
      contentFingerprint: FINGERPRINT,
      selectionSnapshot: selection(),
      scenarioVersion: { scenarioKey: selection().selectedScenario.scenarioKey },
      questions: blueprintQuestions()
    }
  };
}

function readAssessment(status: "IN_PROGRESS" | "COMPLETED", assessmentSnapshot: unknown) {
  return {
    id: ASSESSMENT_ID,
    blockId: BLOCK_ID,
    status,
    schemaVersion: 1,
    evaluatorVersion: "architecture-design-assessment-evaluator-v1",
    evaluatorFingerprint: FINGERPRINT,
    assessmentSnapshot,
    readyAt: new Date("2026-09-08T11:00:00Z"),
    startedAt: new Date("2026-09-08T12:00:00Z"),
    completedAt: null,
    report: null
  };
}

async function evaluatedFixture(
  snapshot: ReturnType<typeof assessmentSnapshot> & {
    submission: {
      requestId: string;
      responseFingerprint: string;
      responses: Array<{ promptId: string; answer: string }>;
      submittedAt: string;
    };
  },
  responses: Array<{ promptId: string; answer: string }>
) {
  return new ArchitectureDesignAssessmentEvaluator(
    { generateStructured: vi.fn().mockResolvedValue(evaluation()) },
    new ArchitectureDesignScenarioRankingService(publishedCatalogue())
  ).evaluate({
    assessmentId: ASSESSMENT_ID,
    blockId: BLOCK_ID,
    scenarioKey: selection().selectedScenario.scenarioKey,
    focus: focus(),
    snapshot,
    responses,
    questions: blueprintQuestions().map((question) => ({
      order: question.order,
      status: "COMPLETED" as const,
      privateSnapshot: question.privateSnapshot,
      state: { revealedHintCount: 0 },
      attempts: [{ score: 8, verificationStatus: "VERIFIED" }]
    })),
    priorScenarioKeys: [selection().selectedScenario.scenarioKey],
    priorTopicKeys: ["webhook-delivery"],
    finalizedAt: new Date("2026-09-08T13:00:00Z")
  });
}

function blueprintQuestions() {
  return ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!.questionBlock.questions.map(
    (privateSnapshot, index) => ({
      id: `${index + 1}1111111-1111-4111-8111-111111111111`,
      order: index + 1,
      status: "COMPLETED" as const,
      contentFingerprint: `sha256:${String(index + 1).repeat(64)}`,
      privateSnapshot
    })
  );
}

function evaluation() {
  return {
    scores: {
      requirementsScope: 60,
      apiDataCapacity: 65,
      architectureTradeoffs: 70,
      reliabilitySecurityOperability: 80,
      communicationEvolution: 85
    },
    teacherSummary: "The candidate supplied a coherent design with clear room for deeper evidence.",
    strengths: ["Clear component boundaries"],
    improvementAreas: ["Quantify overload behavior"],
    nextSteps: ["Practise capacity estimates against a second traffic profile."],
    dimensionMastery: architectureDesignDimensionSchema.options.map((dimensionKey) => ({
      dimensionKey,
      score: 70,
      evidence: "The submitted answers provide bounded evidence for this design dimension."
    }))
  };
}

function selection() {
  return new ArchitectureDesignScenarioRankingService(publishedCatalogue()).rankFirstScenario(
    focus()
  );
}

function publishedCatalogue() {
  return ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.map((candidate) => ({
    ...candidate,
    publicationStatus: "published" as const
  }));
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
