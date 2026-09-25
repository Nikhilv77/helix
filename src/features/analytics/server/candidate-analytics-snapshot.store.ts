import { Prisma } from "@prisma/client";
import { after } from "next/server";
import type {
  CandidateAnalyticsSummary,
  buildCandidateAnalytics
} from "./candidate-analytics-loader";
import { candidateActivityDaily } from "./candidate-activity-daily";
import type { PrismaService } from "@/server/database/prisma.service";
import { Logger } from "@/server/common/logger";
import { withSummaryBuildSlot } from "./summary-build-budget";

type BuiltAnalytics = Awaited<ReturnType<typeof buildCandidateAnalytics>>;
type Builder = () => Promise<BuiltAnalytics>;
// 3: Overview and Progress include AI/ML cohorts for AI/ML candidates.
export const CANDIDATE_ANALYTICS_SCHEMA_VERSION = 3;
const SCHEMA_VERSION = CANDIDATE_ANALYTICS_SCHEMA_VERSION;
const todayUtc = () => new Date().toISOString().slice(0, 10);
const logger = new Logger("CandidateAnalyticsSnapshot");
function fresh(
  row: {
    schemaVersion: number;
    dirtyVersion: number;
    builtVersion: number;
    builtDay: string | null;
  } | null
): boolean {
  return Boolean(
    row &&
    row.schemaVersion === SCHEMA_VERSION &&
    row.dirtyVersion === row.builtVersion &&
    row.builtDay === todayUtc()
  );
}

export class CandidateAnalyticsSnapshotStore {
  private readonly inFlight = new Map<string, Promise<BuiltAnalytics>>();

  constructor(private readonly prisma: PrismaService) {}

  async recentInterviewStartTimes(ownerId: string, since: number): Promise<number[]> {
    const sessions = await this.prisma.interviewSession.findMany({
      where: { ownerId, startedAt: { gte: new Date(since) } },
      select: { startedAt: true }
    });
    return sessions.map((session) => session.startedAt.getTime());
  }

  async readSummary(
    ownerId: string,
    build: Builder,
    options: { requireFresh?: boolean } = {}
  ): Promise<CandidateAnalyticsSummary> {
    if (!this.prisma.candidateAnalyticsSnapshot) return (await build()).summary;

    const readStartedAt = Date.now();
    const row = await this.prisma.candidateAnalyticsSnapshot.findUnique({
      where: { ownerId },
      select: {
        payload: true,
        schemaVersion: true,
        dirtyVersion: true,
        builtVersion: true,
        builtDay: true
      }
    });
    if (Date.now() - readStartedAt >= 1_000) {
      logger.warn({
        event: "candidate.analytics_snapshot_read_slow",
        durationMs: Date.now() - readStartedAt
      });
    }
    if (row?.payload && fresh(row)) return row.payload as unknown as CandidateAnalyticsSummary;
    if (!options.requireFresh && row?.payload && row.schemaVersion === SCHEMA_VERSION) {
      // Summary pages may show the last valid projection while changed evidence
      // is rebuilt. The dirty version remains durable until publication wins.
      after(async () => {
        try {
          await this.publishOnce(ownerId, build);
        } catch (error) {
          logger.error({
            event: "candidate.analytics_background_refresh_failed",
            ownerId,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      });
      return row.payload as unknown as CandidateAnalyticsSummary;
    }
    return (await this.publishOnce(ownerId, build)).summary;
  }

  private publishOnce(ownerId: string, build: Builder): Promise<BuiltAnalytics> {
    const existing = this.inFlight.get(ownerId);
    if (existing) return existing;

    const queuedAt = Date.now();
    const pending = withSummaryBuildSlot(() => {
      const slotWaitMs = Date.now() - queuedAt;
      if (slotWaitMs >= 1_000) {
        logger.warn({ event: "candidate.analytics_build_slot_wait_slow", slotWaitMs });
      }
      return this.publish(ownerId, build);
    }).finally(() => {
      if (this.inFlight.get(ownerId) === pending) this.inFlight.delete(ownerId);
    });
    this.inFlight.set(ownerId, pending);
    return pending;
  }

  /** Rebuild the Home/Progress summary; daily facts are maintained off the read path. */
  private async publish(ownerId: string, build: Builder): Promise<BuiltAnalytics> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await this.prisma.candidateAnalyticsSnapshot.upsert({
        where: { ownerId },
        create: { ownerId },
        update: {},
        select: { dirtyVersion: true }
      });
      const expectedVersion = snapshot.dirtyVersion;
      const buildStartedAt = Date.now();
      const result = await build();
      if (Date.now() - buildStartedAt >= 1_000) {
        logger.warn({
          event: "candidate.analytics_rebuild_slow",
          durationMs: Date.now() - buildStartedAt,
          attempt: attempt + 1
        });
      }
      if (!result.cacheable) return result;
      const summary = JSON.parse(JSON.stringify(result.summary)) as CandidateAnalyticsSummary;
      let published: boolean;
      try {
        const publishStartedAt = Date.now();
        const updated = await this.prisma.candidateAnalyticsSnapshot.updateMany({
          where: { ownerId, dirtyVersion: expectedVersion },
          data: {
            payload: summary as unknown as Prisma.InputJsonValue,
            schemaVersion: SCHEMA_VERSION,
            builtVersion: expectedVersion,
            builtDay: todayUtc(),
            builtAt: new Date()
          }
        });
        if (Date.now() - publishStartedAt >= 1_000) {
          logger.warn({
            event: "candidate.analytics_snapshot_publish_slow",
            durationMs: Date.now() - publishStartedAt
          });
        }
        published = updated.count === 1;
      } catch (error) {
        logger.error({
          event: "candidate.analytics_publish_failed",
          ownerId,
          reason: error instanceof Error ? error.message : String(error)
        });
        return { ...result, summary, cacheable: false };
      }
      if (published) {
        await this.maintainDailyAfterPublish(ownerId);
        return { ...result, summary, cacheable: true };
      }
      const current = await this.prisma.candidateAnalyticsSnapshot.findUnique({
        where: { ownerId },
        select: {
          payload: true,
          schemaVersion: true,
          dirtyVersion: true,
          builtVersion: true,
          builtDay: true
        }
      });
      logger.warn({
        event: "candidate.analytics_snapshot_changed_during_build",
        attempt: attempt + 1,
        startedVersion: expectedVersion,
        currentVersion: current?.dirtyVersion ?? null
      });
      if (current?.payload && fresh(current)) {
        return {
          summary: current.payload as unknown as CandidateAnalyticsSummary,
          reports: null,
          cacheable: true
        };
      }
    }
    return build();
  }

  async invalidate(ownerId: string): Promise<void> {
    if (!this.prisma.candidateAnalyticsSnapshot) return;
    await this.prisma.candidateAnalyticsSnapshot.upsert({
      where: { ownerId },
      create: { ownerId },
      update: { dirtyVersion: { increment: 1 } }
    });
  }

  /** Future chart facts are maintained outside the page response path. */
  async refreshDaily(ownerId: string): Promise<void> {
    await withSummaryBuildSlot(() => this.writeDaily(ownerId));
  }

  private async writeDaily(ownerId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        // Two app instances can refresh the same owner after nearby writes.
        // Serialize replacement so the daily rows are always one complete set.
        // PostgreSQL returns void here; cast it so Prisma can deserialize the
        // result while keeping the transaction-scoped lock until commit.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(19372026, hashtext(${ownerId}))::text AS locked`;
        const activity = await candidateActivityDaily(tx, ownerId);
        await tx.candidateActivityDaily.deleteMany({ where: { ownerId } });
        if (activity.length) {
          await tx.candidateActivityDaily.createMany({ data: activity });
        }
      },
      { timeout: 20_000 }
    );
  }

  private async maintainDailyAfterPublish(ownerId: string): Promise<void> {
    try {
      // In a request, keep future chart maintenance off the response path.
      after(async () => {
        try {
          await this.refreshDaily(ownerId);
        } catch (error) {
          logger.error({
            event: "candidate.analytics_daily_refresh_failed",
            ownerId,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      });
    } catch {
      // Backfill scripts have no request lifecycle to attach `after` to.
      await this.writeDaily(ownerId);
    }
  }
}
