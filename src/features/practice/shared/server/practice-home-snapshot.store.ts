import type { ComponentProps, ReactElement } from "react";
import type { Prisma } from "@prisma/client";
import { after } from "next/server";
import { Logger } from "@/server/common/logger";
import { withSummaryBuildSlot } from "@/features/analytics/server/summary-build-budget";
import type { PracticeSessionsView } from "@/features/practice/shared/ui/practice-sessions-view";
import type { PrismaService } from "@/server/database/prisma.service";

type PracticeHomeProps = ComponentProps<typeof PracticeSessionsView>;
type BuiltPracticeHome = {
  view: ReactElement<PracticeHomeProps>;
  cacheable: boolean;
};
// 2: story entries cover frontend and data alongside AI/ML.
export const PRACTICE_HOME_SCHEMA_VERSION = 2;
const SNAPSHOT_SCHEMA_VERSION = PRACTICE_HOME_SCHEMA_VERSION;
const logger = new Logger("PracticeHomeSnapshot");

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export class PracticeHomeSnapshotStore {
  private readonly inFlight = new Map<string, Promise<PracticeHomeProps>>();
  private readonly dayRefreshInFlight = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async readOrBuild(
    ownerId: string,
    build: () => Promise<BuiltPracticeHome>,
    options: { requireFresh?: boolean } = {}
  ): Promise<PracticeHomeProps> {
    const key = `${ownerId}:${options.requireFresh ? "fresh" : "read"}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const pending = this.readOrBuildOnce(ownerId, build, options.requireFresh ?? false).finally(
      () => {
        if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
      }
    );
    this.inFlight.set(key, pending);
    return pending;
  }

  private async readOrBuildOnce(
    ownerId: string,
    build: () => Promise<BuiltPracticeHome>,
    requireFresh: boolean
  ): Promise<PracticeHomeProps> {
    // `next dev` can retain a Prisma client generated before this model was
    // added. Render the page uncached until the dev process is restarted.
    if (!this.prisma.practiceHomeSnapshot) return (await build()).view.props;

    const readStartedAt = Date.now();
    let snapshot = await this.prisma.practiceHomeSnapshot.findUnique({ where: { ownerId } });
    if (Date.now() - readStartedAt >= 1_000) {
      logger.warn({
        event: "practice.home_snapshot_read_slow",
        durationMs: Date.now() - readStartedAt
      });
    }

    if (
      !requireFresh &&
      snapshot?.payload &&
      snapshot.schemaVersion === SNAPSHOT_SCHEMA_VERSION &&
      (snapshot.dirtyVersion !== snapshot.builtVersion || snapshot.builtDay !== todayUtc())
    ) {
      if (!this.dayRefreshInFlight.has(ownerId)) {
        this.dayRefreshInFlight.add(ownerId);
        after(async () => {
          try {
            await this.readOrBuild(ownerId, build, { requireFresh: true });
          } catch (error) {
            logger.error({
              event: "practice.home_background_refresh_failed",
              ownerId,
              reason: error instanceof Error ? error.message : String(error)
            });
          } finally {
            this.dayRefreshInFlight.delete(ownerId);
          }
        });
      }
      return snapshot.payload as unknown as PracticeHomeProps;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (
        snapshot?.payload &&
        snapshot.schemaVersion === SNAPSHOT_SCHEMA_VERSION &&
        snapshot.dirtyVersion === snapshot.builtVersion &&
        snapshot.builtDay === todayUtc()
      ) {
        return snapshot.payload as unknown as PracticeHomeProps;
      }

      const buildStartedAt = Date.now();
      let sourceBuildMs = 0;
      const { view, cacheable } = await withSummaryBuildSlot(async () => {
        const sourceStartedAt = Date.now();
        try {
          return await build();
        } finally {
          sourceBuildMs = Date.now() - sourceStartedAt;
        }
      });
      const durationMs = Date.now() - buildStartedAt;
      if (durationMs >= 1_000) {
        logger.warn({
          event: "practice.home_rebuild_slow",
          durationMs,
          slotWaitMs: Math.max(0, durationMs - sourceBuildMs),
          sourceBuildMs,
          attempt: attempt + 1
        });
      }
      const props = JSON.parse(JSON.stringify(view.props)) as PracticeHomeProps;
      // Failed source reads must not turn a temporary outage into durable UI.
      if (!cacheable) return props;

      if (!snapshot) {
        snapshot = await this.prisma.practiceHomeSnapshot.upsert({
          where: { ownerId },
          create: { ownerId },
          update: {}
        });
      }

      const publishStartedAt = Date.now();
      const updated = await this.prisma.practiceHomeSnapshot.updateMany({
        where: { ownerId, dirtyVersion: snapshot.dirtyVersion },
        data: {
          payload: props as unknown as Prisma.InputJsonValue,
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          builtVersion: snapshot.dirtyVersion,
          builtDay: todayUtc(),
          builtAt: new Date()
        }
      });
      if (Date.now() - publishStartedAt >= 1_000) {
        logger.warn({
          event: "practice.home_snapshot_publish_slow",
          durationMs: Date.now() - publishStartedAt
        });
      }
      if (updated.count === 1) return props;
      const latest = await this.prisma.practiceHomeSnapshot.findUniqueOrThrow({
        where: { ownerId }
      });
      logger.warn({
        event: "practice.home_snapshot_changed_during_build",
        attempt: attempt + 1,
        startedVersion: snapshot.dirtyVersion,
        currentVersion: latest.dirtyVersion
      });
      snapshot = latest;
    }

    // A busy writer can keep changing the version. Render a fresh result and
    // let the next request publish a stable version instead of serving old UI.
    return (await build()).view.props;
  }
}
