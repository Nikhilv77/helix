import type { PrismaService } from "@/server/database/prisma.service";
import { Logger } from "@/server/common/logger";
import type { InterviewState } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_ANSWER_REQUEST_STATUSES = ["COMPLETED", "FAILED", "CONFLICTED"];
const TERMINAL_EVALUATION_JOB_STATUSES = ["COMPLETED", "SUPERSEDED", "DEAD_LETTER"];
const DEFAULT_RETENTION_POLICY: InterviewRetentionPolicy = {
  authenticatedDays: 365,
  anonymousDays: 30,
  operationalDays: 30,
  batchSize: 250
};

export interface InterviewRetentionPolicy {
  authenticatedDays: number;
  anonymousDays: number;
  operationalDays: number;
  batchSize: number;
}

export interface InterviewRetentionResult {
  cutoff: {
    authenticatedBefore: string;
    anonymousBefore: string;
    operationalBefore: string;
  };
  deleted: {
    authenticatedSessions: number;
    anonymousSessions: number;
    terminalAnswerRequests: number;
    terminalEvaluationJobs: number;
  };
  batchLimit: number;
  batchSaturated: boolean;
}

export interface InterviewOperationsSession {
  createdAt: number;
  touchedAt: number;
  state: unknown;
}

export interface EvaluationQueueSummary {
  byStatus: Record<string, number>;
  averageAttemptsByStatus: Record<string, number>;
  oldestOutstandingCreatedAt: number | null;
}

export interface InterviewOperationsReadModel {
  sessions: InterviewOperationsSession[];
  evaluationQueue: EvaluationQueueSummary;
}

export interface InterviewOperationsRepository {
  enforceRetention(
    policy: InterviewRetentionPolicy,
    now?: number
  ): Promise<InterviewRetentionResult>;
  readOperations(since: number, sampleLimit: number): Promise<InterviewOperationsReadModel>;
}

export interface InterviewOperationsDashboard {
  generatedAt: string;
  window: { since: string; hours: number; sampleLimit: number; sampleTruncated: boolean };
  retention: InterviewRetentionPolicy;
  sessions: {
    total: number;
    byPhase: Record<string, number>;
    byRound: Record<string, number>;
    completedRate: number;
  };
  decisions: {
    observed: number;
    fallbackCount: number;
    fallbackRate: number;
    forcedCount: number;
    latencyMs: { p50: number | null; p95: number | null; max: number | null };
  };
  evaluations: {
    observed: number;
    recoveredCount: number;
    unavailableCount: number;
    latencyMs: { p50: number | null; p95: number | null; max: number | null };
    queue: EvaluationQueueSummary & { oldestOutstandingAgeMinutes: number | null };
  };
  alerts: Array<{ severity: "warning" | "critical"; code: string; message: string }>;
}

/**
 * Operational controls for interview data. The service never returns session
 * ids, owner ids, answers, transcripts, prompts, or model output.
 */
export class InterviewOperationsService {
  private readonly logger = new Logger(InterviewOperationsService.name);

  constructor(
    private readonly repository: InterviewOperationsRepository,
    private readonly retentionPolicy: InterviewRetentionPolicy,
    private readonly sampleLimit = 5_000
  ) {}

  async enforceRetention(now = Date.now()): Promise<InterviewRetentionResult> {
    const result = await this.repository.enforceRetention(this.retentionPolicy, now);
    this.logger.log(JSON.stringify({ event: "interview.retention.completed", ...result.deleted }));
    return result;
  }

  async dashboard(hours = 24, now = Date.now()): Promise<InterviewOperationsDashboard> {
    const boundedHours = Math.max(1, Math.min(24 * 30, Math.round(hours)));
    const since = now - boundedHours * 60 * 60 * 1_000;
    const readModel = await this.repository.readOperations(since, this.sampleLimit);
    return buildInterviewOperationsDashboard(
      readModel,
      { since, hours: boundedHours, sampleLimit: this.sampleLimit },
      now,
      this.retentionPolicy
    );
  }
}

export class PrismaInterviewOperationsRepository implements InterviewOperationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enforceRetention(
    policy: InterviewRetentionPolicy,
    now = Date.now()
  ): Promise<InterviewRetentionResult> {
    const batchSize = Math.max(1, Math.min(1_000, Math.round(policy.batchSize)));
    const authenticatedBefore = new Date(now - policy.authenticatedDays * DAY_MS);
    const anonymousBefore = new Date(now - policy.anonymousDays * DAY_MS);
    const operationalBefore = new Date(now - policy.operationalDays * DAY_MS);

    // Read at most one bounded candidate page per class, merge by age, then
    // re-check every cutoff in the delete predicate to avoid racing a touch.
    const [anonymousCandidates, authenticatedCandidates] = await Promise.all([
      this.prisma.interviewSession.findMany({
        where: { ownerId: { startsWith: "anon:" }, touchedAt: { lt: anonymousBefore } },
        select: { id: true, touchedAt: true },
        orderBy: { touchedAt: "asc" },
        take: batchSize
      }),
      this.prisma.interviewSession.findMany({
        where: {
          ownerId: { not: { startsWith: "anon:" } },
          touchedAt: { lt: authenticatedBefore }
        },
        select: { id: true, touchedAt: true },
        orderBy: { touchedAt: "asc" },
        take: batchSize
      })
    ]);
    const selected = [
      ...anonymousCandidates.map((row) => ({ ...row, ownerClass: "anonymous" as const })),
      ...authenticatedCandidates.map((row) => ({ ...row, ownerClass: "authenticated" as const }))
    ]
      .sort((left, right) => left.touchedAt.getTime() - right.touchedAt.getTime())
      .slice(0, batchSize);
    const anonymousIds = selected
      .filter((row) => row.ownerClass === "anonymous")
      .map((row) => row.id);
    const authenticatedIds = selected
      .filter((row) => row.ownerClass === "authenticated")
      .map((row) => row.id);

    const deleted = await this.prisma.$transaction(async (transaction) => {
      const terminalAnswerRequests = await transaction.interviewAnswerRequest.deleteMany({
        where: {
          status: { in: TERMINAL_ANSWER_REQUEST_STATUSES },
          updatedAt: { lt: operationalBefore }
        }
      });
      const terminalEvaluationJobs = await transaction.interviewEvaluationJob.deleteMany({
        where: {
          status: { in: TERMINAL_EVALUATION_JOB_STATUSES },
          updatedAt: { lt: operationalBefore }
        }
      });
      const anonymousSessions = anonymousIds.length
        ? await transaction.interviewSession.deleteMany({
            where: {
              id: { in: anonymousIds },
              ownerId: { startsWith: "anon:" },
              touchedAt: { lt: anonymousBefore }
            }
          })
        : { count: 0 };
      const authenticatedSessions = authenticatedIds.length
        ? await transaction.interviewSession.deleteMany({
            where: {
              id: { in: authenticatedIds },
              ownerId: { not: { startsWith: "anon:" } },
              touchedAt: { lt: authenticatedBefore }
            }
          })
        : { count: 0 };
      return {
        authenticatedSessions: authenticatedSessions.count,
        anonymousSessions: anonymousSessions.count,
        terminalAnswerRequests: terminalAnswerRequests.count,
        terminalEvaluationJobs: terminalEvaluationJobs.count
      };
    });

    return {
      cutoff: {
        authenticatedBefore: authenticatedBefore.toISOString(),
        anonymousBefore: anonymousBefore.toISOString(),
        operationalBefore: operationalBefore.toISOString()
      },
      deleted,
      batchLimit: batchSize,
      batchSaturated: selected.length === batchSize
    };
  }

  async readOperations(since: number, sampleLimit: number): Promise<InterviewOperationsReadModel> {
    const [sessions, groupedJobs, oldestOutstanding] = await Promise.all([
      this.prisma.interviewSession.findMany({
        where: { createdAt: { gte: new Date(since) } },
        orderBy: { createdAt: "desc" },
        take: sampleLimit,
        select: { state: true, createdAt: true, touchedAt: true }
      }),
      this.prisma.interviewEvaluationJob.groupBy({
        by: ["status"],
        // Queue health is global across the retained operational window. A
        // dead letter must not disappear merely because the UI is showing a
        // shorter session window.
        where: { status: { in: ["PENDING", "PROCESSING", "DEAD_LETTER"] } },
        _count: { _all: true },
        _avg: { attempts: true }
      }),
      this.prisma.interviewEvaluationJob.findFirst({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true }
      })
    ]);

    return {
      sessions: sessions.map((session) => ({
        state: session.state,
        createdAt: session.createdAt.getTime(),
        touchedAt: session.touchedAt.getTime()
      })),
      evaluationQueue: {
        byStatus: Object.fromEntries(groupedJobs.map((row) => [row.status, row._count._all])),
        averageAttemptsByStatus: Object.fromEntries(
          groupedJobs.map((row) => [row.status, round(row._avg.attempts ?? 0, 2)])
        ),
        oldestOutstandingCreatedAt: oldestOutstanding?.createdAt.getTime() ?? null
      }
    };
  }
}

export function buildInterviewOperationsDashboard(
  readModel: InterviewOperationsReadModel,
  window: { since: number; hours: number; sampleLimit: number },
  now = Date.now(),
  retentionPolicy: InterviewRetentionPolicy = DEFAULT_RETENTION_POLICY
): InterviewOperationsDashboard {
  const byPhase: Record<string, number> = {};
  const byRound: Record<string, number> = {};
  const decisionLatencies: number[] = [];
  const evaluationLatencies: number[] = [];
  let decisionsObserved = 0;
  let fallbackCount = 0;
  let forcedCount = 0;
  let evaluationsObserved = 0;
  let recoveredCount = 0;
  let unavailableCount = 0;

  for (const record of readModel.sessions) {
    const state = safeState(record.state);
    if (!state) {
      increment(byPhase, "legacy-or-invalid");
      increment(byRound, "unknown");
      continue;
    }
    increment(byPhase, state.phase || "unknown");
    increment(byRound, state.setup?.templateId || state.setup?.roundType || "unknown");

    for (const turn of Array.isArray(state.turns) ? state.turns : []) {
      if (turn.speaker !== "agent" || !turn.runtime) continue;
      decisionsObserved += 1;
      if (turn.runtime.usedFallback) fallbackCount += 1;
      if (turn.forcedBy) forcedCount += 1;
      pushDuration(decisionLatencies, turn.runtime.durationMs);
    }
    for (const evaluation of Object.values(state.questionEvaluations ?? {})) {
      if (!evaluation || typeof evaluation !== "object") continue;
      evaluationsObserved += 1;
      if (evaluation.source === "evaluation-unavailable") unavailableCount += 1;
      if (evaluation.runtime?.recovered) recoveredCount += 1;
      pushDuration(evaluationLatencies, evaluation.runtime?.durationMs);
    }
  }

  const total = readModel.sessions.length;
  const oldestOutstandingAgeMinutes = readModel.evaluationQueue.oldestOutstandingCreatedAt
    ? Math.max(0, Math.round((now - readModel.evaluationQueue.oldestOutstandingCreatedAt) / 60_000))
    : null;
  const fallbackRate = ratio(fallbackCount, decisionsObserved);
  const decisionLatency = latencySummary(decisionLatencies);
  const evaluationLatency = latencySummary(evaluationLatencies);
  const sampleTruncated = total === window.sampleLimit;
  const alerts: InterviewOperationsDashboard["alerts"] = [];

  if ((decisionLatency.p95 ?? 0) > 4_000) {
    alerts.push({
      severity: "critical",
      code: "DECISION_P95_BREACH",
      message: `Decision p95 is ${decisionLatency.p95} ms; the live-turn budget is 4000 ms.`
    });
  }
  if (fallbackRate > 0.1 && decisionsObserved >= 10) {
    alerts.push({
      severity: "warning",
      code: "FALLBACK_RATE_HIGH",
      message: `${Math.round(fallbackRate * 100)}% of observed decisions used fallback.`
    });
  }
  if ((readModel.evaluationQueue.byStatus.DEAD_LETTER ?? 0) > 0) {
    alerts.push({
      severity: "critical",
      code: "EVALUATION_DEAD_LETTER",
      message: `${readModel.evaluationQueue.byStatus.DEAD_LETTER} evaluation jobs are dead-lettered in the retained queue.`
    });
  }
  if (oldestOutstandingAgeMinutes !== null && oldestOutstandingAgeMinutes > 15) {
    alerts.push({
      severity: "warning",
      code: "EVALUATION_QUEUE_AGE",
      message: `The oldest pending evaluation is ${oldestOutstandingAgeMinutes} minutes old.`
    });
  }
  if (sampleTruncated) {
    alerts.push({
      severity: "warning",
      code: "METRICS_SAMPLE_TRUNCATED",
      message: `The dashboard reached its ${window.sampleLimit}-session safety limit.`
    });
  }

  return {
    generatedAt: new Date(now).toISOString(),
    retention: { ...retentionPolicy },
    window: {
      since: new Date(window.since).toISOString(),
      hours: window.hours,
      sampleLimit: window.sampleLimit,
      sampleTruncated
    },
    sessions: {
      total,
      byPhase,
      byRound,
      completedRate: ratio(byPhase.done ?? 0, total)
    },
    decisions: {
      observed: decisionsObserved,
      fallbackCount,
      fallbackRate,
      forcedCount,
      latencyMs: decisionLatency
    },
    evaluations: {
      observed: evaluationsObserved,
      recoveredCount,
      unavailableCount,
      latencyMs: evaluationLatency,
      queue: { ...readModel.evaluationQueue, oldestOutstandingAgeMinutes }
    },
    alerts
  };
}

function safeState(value: unknown): Partial<InterviewState> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Partial<InterviewState>;
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function pushDuration(target: number[], value: unknown): void {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) target.push(value);
}

function latencySummary(values: number[]): {
  p50: number | null;
  p95: number | null;
  max: number | null;
} {
  if (values.length === 0) return { p50: null, p95: null, max: null };
  const sorted = [...values].sort((left, right) => left - right);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? null
  };
}

function percentile(sorted: number[], percentileValue: number): number {
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return Math.round(sorted[index] ?? 0);
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? round(numerator / denominator, 4) : 0;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
