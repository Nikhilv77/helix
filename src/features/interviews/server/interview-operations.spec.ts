import {
  buildInterviewOperationsDashboard,
  InterviewOperationsService,
  PrismaInterviewOperationsRepository,
  type InterviewOperationsReadModel,
  type InterviewOperationsRepository,
  type InterviewRetentionPolicy
} from "./interview-operations";
import type { PrismaService } from "@/server/database/prisma.service";
import type { InterviewState } from "./types";

const now = Date.UTC(2026, 8, 14, 12);
const policy: InterviewRetentionPolicy = {
  authenticatedDays: 365,
  anonymousDays: 30,
  operationalDays: 30,
  batchSize: 250
};

function state(overrides: Partial<InterviewState> = {}): InterviewState {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    setup: {
      role: "fullstack",
      level: "3-5",
      roundType: "hiring-manager",
      intensity: "realistic",
      context: "PRIVATE candidate context",
      templateId: "hiring-manager-final"
    },
    plan: [],
    phase: "done",
    questionIndex: 1,
    followUpCount: 0,
    startedAt: now - 60_000,
    turns: [
      {
        speaker: "user",
        text: "PRIVATE candidate transcript",
        startMs: 100,
        endMs: 200
      },
      {
        speaker: "agent",
        text: "PRIVATE interviewer transcript",
        startMs: 300,
        endMs: 400,
        action: "probe",
        forcedBy: "follow-up-budget",
        runtime: {
          engineVersion: "test",
          promptVersion: "test",
          durationMs: 1_200,
          usedFallback: true,
          calls: []
        }
      }
    ],
    questionEvaluations: {
      "0": {
        source: "semantic-evaluator",
        score: 75,
        verdict: "mostly-correct",
        confidence: 0.8,
        summary: "PRIVATE evaluation summary",
        strengths: [],
        gaps: [],
        rubricScores: [],
        answerExcerpts: ["PRIVATE candidate transcript"],
        execution: null,
        evaluatedAt: now,
        runtime: {
          engineVersion: "test",
          promptVersion: "test",
          durationMs: 2_100,
          recovered: true,
          calls: []
        }
      }
    },
    ...overrides
  };
}

function readModel(states: unknown[]): InterviewOperationsReadModel {
  return {
    sessions: states.map((item, index) => ({
      state: item,
      createdAt: now - index * 1_000,
      touchedAt: now - index * 500
    })),
    evaluationQueue: {
      byStatus: { COMPLETED: 3 },
      averageAttemptsByStatus: { COMPLETED: 1 },
      oldestOutstandingCreatedAt: null
    }
  };
}

describe("interview operations", () => {
  it("builds aggregate reliability metrics without leaking candidate content", () => {
    const dashboard = buildInterviewOperationsDashboard(
      readModel([state()]),
      { since: now - 24 * 60 * 60 * 1_000, hours: 24, sampleLimit: 5_000 },
      now
    );

    expect(dashboard.sessions).toEqual({
      total: 1,
      byPhase: { done: 1 },
      byRound: { "hiring-manager-final": 1 },
      completedRate: 1
    });
    expect(dashboard.decisions).toMatchObject({
      observed: 1,
      fallbackCount: 1,
      fallbackRate: 1,
      forcedCount: 1,
      latencyMs: { p50: 1_200, p95: 1_200, max: 1_200 }
    });
    expect(dashboard.evaluations).toMatchObject({
      observed: 1,
      recoveredCount: 1,
      unavailableCount: 0,
      latencyMs: { p50: 2_100, p95: 2_100, max: 2_100 }
    });
    const serialized = JSON.stringify(dashboard);
    expect(serialized).not.toContain("PRIVATE");
    expect(serialized).not.toContain("11111111");
  });

  it("survives malformed legacy state without breaking the dashboard", () => {
    const dashboard = buildInterviewOperationsDashboard(
      readModel([null, "old-row", { phase: "questioning", turns: "not-an-array" }]),
      { since: now - 3_600_000, hours: 1, sampleLimit: 5_000 },
      now
    );

    expect(dashboard.sessions.total).toBe(3);
    expect(dashboard.sessions.byPhase).toEqual({ "legacy-or-invalid": 2, questioning: 1 });
    expect(dashboard.sessions.byRound).toEqual({ unknown: 3 });
    expect(dashboard.decisions.observed).toBe(0);
  });

  it("raises actionable alerts for deadline, fallback, dead-letter, and queue-age failures", () => {
    const degraded = Array.from({ length: 10 }, (_, index) =>
      state({
        id: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
        turns: [
          {
            speaker: "agent",
            text: "hidden",
            startMs: 0,
            endMs: 1,
            runtime: {
              engineVersion: "test",
              promptVersion: "test",
              durationMs: index === 0 ? 5_001 : 4_500,
              usedFallback: index < 2,
              calls: []
            }
          }
        ]
      })
    );
    const model = readModel(degraded);
    model.evaluationQueue = {
      byStatus: { DEAD_LETTER: 2, PENDING: 1 },
      averageAttemptsByStatus: { DEAD_LETTER: 5, PENDING: 2 },
      oldestOutstandingCreatedAt: now - 16 * 60_000
    };

    const dashboard = buildInterviewOperationsDashboard(
      model,
      { since: now - 3_600_000, hours: 1, sampleLimit: 5_000 },
      now
    );

    expect(dashboard.alerts.map((alert) => alert.code)).toEqual([
      "DECISION_P95_BREACH",
      "FALLBACK_RATE_HIGH",
      "EVALUATION_DEAD_LETTER",
      "EVALUATION_QUEUE_AGE"
    ]);
  });

  it("enforces bounded retention using the configured policy", async () => {
    const expected = {
      cutoff: {
        authenticatedBefore: "2025-09-14T12:00:00.000Z",
        anonymousBefore: "2026-08-15T12:00:00.000Z",
        operationalBefore: "2026-08-15T12:00:00.000Z"
      },
      deleted: {
        authenticatedSessions: 2,
        anonymousSessions: 3,
        terminalAnswerRequests: 4,
        terminalEvaluationJobs: 5
      },
      batchLimit: 250,
      batchSaturated: false
    };
    const repository = {
      enforceRetention: vi.fn().mockResolvedValue(expected),
      readOperations: vi.fn()
    } satisfies InterviewOperationsRepository;
    const service = new InterviewOperationsService(repository, policy);

    await expect(service.enforceRetention(now)).resolves.toEqual(expected);
    expect(repository.enforceRetention).toHaveBeenCalledWith(policy, now);
  });

  it("fails closed when the retention store is unavailable", async () => {
    const repository = {
      enforceRetention: vi.fn().mockRejectedValue(new Error("database unavailable")),
      readOperations: vi.fn()
    } satisfies InterviewOperationsRepository;
    const service = new InterviewOperationsService(repository, policy);

    await expect(service.enforceRetention(now)).rejects.toThrow("database unavailable");
    expect(repository.enforceRetention).toHaveBeenCalledTimes(1);
  });

  it("never selects active recovery work for operational deletion and rechecks session cutoffs", async () => {
    const anonymousId = "11111111-1111-4111-8111-111111111111";
    const authenticatedId = "22222222-2222-4222-8222-222222222222";
    const sessionFindMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: anonymousId, touchedAt: new Date(now - 40 * 86_400_000) }])
      .mockResolvedValueOnce([
        { id: authenticatedId, touchedAt: new Date(now - 400 * 86_400_000) }
      ]);
    const answerDeleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const evaluationDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const sessionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      interviewAnswerRequest: { deleteMany: answerDeleteMany },
      interviewEvaluationJob: { deleteMany: evaluationDeleteMany },
      interviewSession: { deleteMany: sessionDeleteMany }
    };
    const prisma = {
      interviewSession: { findMany: sessionFindMany },
      $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction)
      )
    } as unknown as PrismaService;
    const repository = new PrismaInterviewOperationsRepository(prisma);

    const result = await repository.enforceRetention(policy, now);

    expect(result.deleted).toEqual({
      authenticatedSessions: 1,
      anonymousSessions: 1,
      terminalAnswerRequests: 3,
      terminalEvaluationJobs: 2
    });
    const evaluationWhere = evaluationDeleteMany.mock.calls[0]?.[0]?.where;
    expect(evaluationWhere.status.in).toEqual(["COMPLETED", "SUPERSEDED", "DEAD_LETTER"]);
    expect(evaluationWhere.status.in).not.toContain("PENDING");
    expect(evaluationWhere.status.in).not.toContain("PROCESSING");
    expect(sessionDeleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: [anonymousId] },
        ownerId: { startsWith: "anon:" },
        touchedAt: { lt: new Date(now - 30 * 86_400_000) }
      })
    });
    expect(sessionDeleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: [authenticatedId] },
        ownerId: { not: { startsWith: "anon:" } },
        touchedAt: { lt: new Date(now - 365 * 86_400_000) }
      })
    });
  });

  it("bounds dashboard windows and read volume", async () => {
    const repository = {
      enforceRetention: vi.fn(),
      readOperations: vi.fn().mockResolvedValue(readModel([]))
    } satisfies InterviewOperationsRepository;
    const service = new InterviewOperationsService(repository, policy, 321);

    const dashboard = await service.dashboard(10_000, now);

    expect(dashboard.window.hours).toBe(720);
    expect(repository.readOperations).toHaveBeenCalledWith(now - 720 * 60 * 60 * 1_000, 321);
  });
});
