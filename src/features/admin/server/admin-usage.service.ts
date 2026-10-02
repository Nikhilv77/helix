import { Prisma } from "@prisma/client";

import type { PrismaService } from "@/server/database/prisma.service";

import { estimateCost } from "../domain/provider-pricing";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A finished room whose checkpoint has not graded after this long is stuck. */
const STUCK_AFTER_MS = 10 * 60_000;

type UsageRow = {
  kind: string;
  provider: string;
  model: string;
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  units: number;
  durationMs: number;
};

export interface AdminCostModel extends UsageRow {
  cost: number;
}

export interface AdminCostOverview {
  days: number;
  recordedSince: string | null;
  totalCost: number;
  previousCost: number;
  activeUsers: number;
  textCalls: number;
  tokens: { input: number; output: number };
  dailyCost: Array<{ date: string; value: number }>;
  byKind: Array<{ label: string; value: number }>;
  models: AdminCostModel[];
  operations: Array<{
    operation: string;
    calls: number;
    failures: number;
    inputTokens: number;
    outputTokens: number;
    p95Ms: number | null;
    cost: number;
  }>;
  topUsers: Array<{ ownerId: string; cost: number; speechCharacters: number; codeRuns: number }>;
}

export interface AdminStuckCheckpoint {
  sessionId: string;
  ownerId: string;
  track: string;
  status: string;
  finishedAt: string;
}

export interface AdminReliability {
  days: number;
  recordedSince: string | null;
  providers: Array<{
    kind: string;
    provider: string;
    calls: number;
    failures: number;
    p50Ms: number | null;
    p95Ms: number | null;
  }>;
  failingOperations: Array<{ operation: string; provider: string; failures: number; calls: number; topError: string | null }>;
  stuckCheckpoints: AdminStuckCheckpoint[];
  gradingQueue: { waiting: number; oldestMinutes: number | null; deadLetter: number };
  reportsMissing: number;
  roasts: { failed: number; stuck: number; total: number };
}

/** Spend and failure views over the recorded provider usage, plus repair queues. */
export class AdminUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async cost(days: number, now = new Date()): Promise<AdminCostOverview> {
    const since = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
    const previousSince = new Date(since.getTime() - days * DAY_MS);
    const [first, models, previous, daily, operations, users, active] = await Promise.all([
      this.prisma.$queryRaw<Array<{ at: Date | null }>>`SELECT min("createdAt") AS at FROM "ProviderUsageEvent"`,
      this.prisma.$queryRaw<UsageRow[]>`
        SELECT kind, provider, model, count(*)::int AS calls,
               count(*) FILTER (WHERE outcome = 'failure')::int AS failures,
               coalesce(sum("inputTokens"), 0)::float AS "inputTokens",
               coalesce(sum("outputTokens"), 0)::float AS "outputTokens",
               coalesce(sum(units), 0)::float AS units,
               coalesce(sum("durationMs"), 0)::float AS "durationMs"
        FROM "ProviderUsageEvent" WHERE "createdAt" >= ${since}
        GROUP BY kind, provider, model`,
      this.prisma.$queryRaw<UsageRow[]>`
        SELECT kind, provider, model, count(*)::int AS calls, 0 AS failures,
               coalesce(sum("inputTokens"), 0)::float AS "inputTokens",
               coalesce(sum("outputTokens"), 0)::float AS "outputTokens",
               coalesce(sum(units), 0)::float AS units,
               coalesce(sum("durationMs"), 0)::float AS "durationMs"
        FROM "ProviderUsageEvent" WHERE "createdAt" >= ${previousSince} AND "createdAt" < ${since}
        GROUP BY kind, provider, model`,
      this.prisma.$queryRaw<Array<UsageRow & { day: Date }>>`
        SELECT "createdAt"::date AS day, kind, provider, model, count(*)::int AS calls, 0 AS failures,
               coalesce(sum("inputTokens"), 0)::float AS "inputTokens",
               coalesce(sum("outputTokens"), 0)::float AS "outputTokens",
               coalesce(sum(units), 0)::float AS units,
               coalesce(sum("durationMs"), 0)::float AS "durationMs"
        FROM "ProviderUsageEvent" WHERE "createdAt" >= ${since}
        GROUP BY 1, kind, provider, model`,
      this.prisma.$queryRaw<Array<UsageRow & { operation: string; p95Ms: number | null }>>`
        SELECT operation, kind, provider, model, count(*)::int AS calls,
               count(*) FILTER (WHERE outcome = 'failure')::int AS failures,
               coalesce(sum("inputTokens"), 0)::float AS "inputTokens",
               coalesce(sum("outputTokens"), 0)::float AS "outputTokens",
               coalesce(sum(units), 0)::float AS units,
               coalesce(sum("durationMs"), 0)::float AS "durationMs",
               percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS "p95Ms"
        FROM "ProviderUsageEvent" WHERE "createdAt" >= ${since} AND kind = 'text'
        GROUP BY operation, kind, provider, model`,
      this.prisma.$queryRaw<Array<UsageRow & { ownerId: string }>>`
        SELECT "ownerId", kind, provider, model, count(*)::int AS calls, 0 AS failures,
               0::float AS "inputTokens", 0::float AS "outputTokens",
               coalesce(sum(units), 0)::float AS units,
               coalesce(sum("durationMs"), 0)::float AS "durationMs"
        FROM "ProviderUsageEvent" WHERE "createdAt" >= ${since} AND "ownerId" IS NOT NULL
        GROUP BY "ownerId", kind, provider, model`,
      this.prisma.$queryRaw<Array<{ value: number }>>`
        SELECT count(DISTINCT "ownerId")::int AS value FROM "CandidateActivityDaily"
        WHERE day >= ${since}::date AND ("practiceAttempts" + "interviewsStarted" + "roastsCompleted" + "trailmateResolved") > 0`
    ]);

    const priced = models.map((row) => ({ ...row, cost: estimateCost(row) }));
    const byKind = new Map<string, number>();
    for (const row of priced) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row.cost);

    const dailyByDate = new Map<string, number>();
    for (const row of daily) {
      const key = isoDay(row.day);
      dailyByDate.set(key, (dailyByDate.get(key) ?? 0) + estimateCost(row));
    }

    const operationMap = new Map<string, AdminCostOverview["operations"][number]>();
    for (const row of operations) {
      const entry = operationMap.get(row.operation) ?? {
        operation: row.operation,
        calls: 0,
        failures: 0,
        inputTokens: 0,
        outputTokens: 0,
        p95Ms: null,
        cost: 0
      };
      entry.calls += row.calls;
      entry.failures += row.failures;
      entry.inputTokens += row.inputTokens;
      entry.outputTokens += row.outputTokens;
      entry.p95Ms = Math.max(entry.p95Ms ?? 0, row.p95Ms ?? 0);
      entry.cost += estimateCost(row);
      operationMap.set(row.operation, entry);
    }

    const userMap = new Map<string, AdminCostOverview["topUsers"][number]>();
    for (const row of users) {
      const entry = userMap.get(row.ownerId) ?? { ownerId: row.ownerId, cost: 0, speechCharacters: 0, codeRuns: 0 };
      entry.cost += estimateCost(row);
      if (row.kind === "speech") entry.speechCharacters += row.units;
      if (row.kind === "code") entry.codeRuns += row.units;
      userMap.set(row.ownerId, entry);
    }

    const text = priced.filter((row) => row.kind === "text");
    return {
      days,
      recordedSince: first[0]?.at?.toISOString() ?? null,
      totalCost: priced.reduce((total, row) => total + row.cost, 0),
      previousCost: previous.reduce((total, row) => total + estimateCost(row), 0),
      activeUsers: active[0]?.value ?? 0,
      textCalls: text.reduce((total, row) => total + row.calls, 0),
      tokens: {
        input: text.reduce((total, row) => total + row.inputTokens, 0),
        output: text.reduce((total, row) => total + row.outputTokens, 0)
      },
      dailyCost: Array.from({ length: days }, (_, index) => {
        const date = isoDay(new Date(since.getTime() + index * DAY_MS));
        return { date, value: dailyByDate.get(date) ?? 0 };
      }),
      byKind: [
        { label: "AI text", value: byKind.get("text") ?? 0 },
        { label: "Voice", value: byKind.get("speech") ?? 0 },
        { label: "Code runs", value: byKind.get("code") ?? 0 }
      ],
      models: priced.sort((a, b) => b.cost - a.cost || b.calls - a.calls),
      operations: [...operationMap.values()].sort((a, b) => b.cost - a.cost || b.calls - a.calls).slice(0, 15),
      topUsers: [...userMap.values()].sort((a, b) => b.cost - a.cost).slice(0, 10)
    };
  }

  async reliability(days: number, now = new Date()): Promise<AdminReliability> {
    const since = new Date(now.getTime() - days * DAY_MS);
    const [first, providers, failing, stuckCheckpoints, queue, reportsMissing, roasts] = await Promise.all([
      this.prisma.$queryRaw<Array<{ at: Date | null }>>`SELECT min("createdAt") AS at FROM "ProviderUsageEvent"`,
      this.prisma.$queryRaw<AdminReliability["providers"]>`
        SELECT kind, provider, count(*)::int AS calls,
               count(*) FILTER (WHERE outcome = 'failure')::int AS failures,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs") FILTER (WHERE outcome = 'success')::float AS "p50Ms",
               percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") FILTER (WHERE outcome = 'success')::float AS "p95Ms"
        FROM "ProviderUsageEvent" WHERE "createdAt" >= ${since}
        GROUP BY kind, provider ORDER BY calls DESC`,
      this.prisma.$queryRaw<AdminReliability["failingOperations"]>`
        SELECT operation, provider, count(*) FILTER (WHERE outcome = 'failure')::int AS failures,
               count(*)::int AS calls,
               mode() WITHIN GROUP (ORDER BY "errorCode") FILTER (WHERE outcome = 'failure') AS "topError"
        FROM "ProviderUsageEvent" WHERE "createdAt" >= ${since}
        GROUP BY operation, provider HAVING count(*) FILTER (WHERE outcome = 'failure') > 0
        ORDER BY failures DESC LIMIT 12`,
      this.stuckCheckpoints(now),
      this.prisma.$queryRaw<Array<{ waiting: number; oldest: Date | null; deadLetter: number }>>`
        SELECT count(*) FILTER (WHERE status NOT IN ('COMPLETED', 'SUPERSEDED', 'DEAD_LETTER'))::int AS waiting,
               min("createdAt") FILTER (WHERE status NOT IN ('COMPLETED', 'SUPERSEDED', 'DEAD_LETTER')) AS oldest,
               count(*) FILTER (WHERE status = 'DEAD_LETTER' AND "createdAt" >= ${since})::int AS "deadLetter"
        FROM "InterviewEvaluationJob"`,
      this.prisma.$queryRaw<Array<{ value: number }>>`
        SELECT count(*)::int AS value FROM "InterviewSession"
        WHERE "completedAt" >= ${since} AND "completedAt" < ${new Date(now.getTime() - STUCK_AFTER_MS)}
          AND "reportSnapshot" IS NULL AND state->'setup'->'storyPracticeAssessment' IS NULL
          AND coalesce(state->'setup'->>'templateId', '') NOT LIKE '%assessment%'`,
      this.prisma.$queryRaw<Array<{ failed: number; stuck: number; total: number }>>`
        SELECT count(*) FILTER (WHERE status = 'FAILED')::int AS failed,
               count(*) FILTER (WHERE status = 'GENERATING' AND "updatedAt" < ${new Date(now.getTime() - STUCK_AFTER_MS)})::int AS stuck,
               count(*)::int AS total
        FROM "ResumeRoast" WHERE "createdAt" >= ${since}`
    ]);
    const oldest = queue[0]?.oldest ?? null;
    return {
      days,
      recordedSince: first[0]?.at?.toISOString() ?? null,
      providers,
      failingOperations: failing,
      stuckCheckpoints,
      gradingQueue: {
        waiting: queue[0]?.waiting ?? 0,
        oldestMinutes: oldest ? Math.round((now.getTime() - oldest.getTime()) / 60_000) : null,
        deadLetter: queue[0]?.deadLetter ?? 0
      },
      reportsMissing: reportsMissing[0]?.value ?? 0,
      roasts: roasts[0] ?? { failed: 0, stuck: 0, total: 0 }
    };
  }

  /**
   * Checkpoint rooms that ended more than ten minutes ago but never produced a
   * result. The room's session id is also the assessment id for the Node.js
   * and story tracks; DSA links the two explicitly.
   */
  async stuckCheckpoints(now = new Date()): Promise<AdminStuckCheckpoint[]> {
    const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);
    // The room that graded a checkpoint names it in its setup; older Node.js
    // rooms instead reuse the assessment id as the session id.
    const linked = Prisma.sql`(s.id::text = a.id::text OR s.state->'setup'->'storyPracticeAssessment'->>'assessmentId' = a.id::text)`;
    const rows = await this.prisma.$queryRaw<Array<{ sessionId: string; ownerId: string; track: string; status: string; finishedAt: Date }>>`
      SELECT s.id::text AS "sessionId", a."ownerId", 'Core Technical' AS track, a.status::text AS status, s."completedAt" AS "finishedAt"
      FROM "CoreTechnicalAssessment" a JOIN "InterviewSession" s ON ${linked} AND s."ownerId" = a."ownerId"
      WHERE a.status IN ('IN_PROGRESS', 'FINALIZING') AND s."completedAt" < ${cutoff}
      UNION ALL
      SELECT s.id::text, a."ownerId", 'Applied Engineering', a.status::text, s."completedAt"
      FROM "AppliedEngineeringAssessment" a JOIN "InterviewSession" s ON ${linked} AND s."ownerId" = a."ownerId"
      WHERE a.status IN ('IN_PROGRESS', 'FINALIZING') AND s."completedAt" < ${cutoff}
      UNION ALL
      SELECT s.id::text, a."ownerId", 'Architecture & Design', a.status::text, s."completedAt"
      FROM "ArchitectureAssessment" a JOIN "InterviewSession" s ON ${linked} AND s."ownerId" = a."ownerId"
      WHERE a.status IN ('IN_PROGRESS', 'FINALIZING') AND s."completedAt" < ${cutoff}
      UNION ALL
      SELECT s.id::text, a."ownerId", 'Story checkpoint', a.status::text, s."completedAt"
      FROM "StoryTrackAssessment" a JOIN "InterviewSession" s ON ${linked} AND s."ownerId" = a."ownerId"
      WHERE a.status IN ('IN_PROGRESS', 'FINALIZING') AND s."completedAt" < ${cutoff}
      UNION ALL
      SELECT s.id::text, a."ownerId", 'DSA', 'IN_PROGRESS', s."completedAt"
      FROM "DsaBlockAssessment" a JOIN "InterviewSession" s ON s.id::text = a."interviewSessionId"::text
      WHERE a."completedAt" IS NULL AND s."completedAt" < ${cutoff}
      ORDER BY "finishedAt" ASC
      LIMIT 50`;
    return rows.map((row) => ({ ...row, finishedAt: row.finishedAt.toISOString() }));
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
