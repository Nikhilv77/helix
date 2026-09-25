import type { Prisma } from "@prisma/client";
import { after } from "next/server";
import type { PrismaService } from "@/server/database/prisma.service";
import { Logger } from "@/server/common/logger";

export type WorkspacePage = "interviews" | "resume-roast" | "trailmate" | "reports";

export interface BuiltWorkspacePage<T> {
  data: T;
  cacheable: boolean;
  expiresAt?: Date | null;
}

const SCHEMA_VERSION: Record<WorkspacePage, number> = {
  interviews: 1,
  "resume-roast": 2,
  trailmate: 1,
  reports: 1
};
const logger = new Logger("WorkspacePageSnapshot");

/** One owner-scoped read for warm workspace pages; source-table triggers mark rows dirty. */
export class WorkspacePageSnapshotStore {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly expiryRefreshInFlight = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  readOrBuild<T>(
    ownerId: string,
    page: WorkspacePage,
    build: () => Promise<BuiltWorkspacePage<T>>,
    options: { requireFresh?: boolean } = {}
  ): Promise<T> {
    const key = `${ownerId}:${page}:${options.requireFresh ? "fresh" : "read"}`;
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const pending = this.readOrBuildOnce(ownerId, page, build, options).finally(() => {
      if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
    });
    this.inFlight.set(key, pending);
    return pending;
  }

  private async readOrBuildOnce<T>(
    ownerId: string,
    page: WorkspacePage,
    build: () => Promise<BuiltWorkspacePage<T>>,
    options: { requireFresh?: boolean } = {}
  ): Promise<T> {
    // Prisma's generated client can change while `next dev` retains an older
    // process-wide client. Keep the page usable until that process restarts.
    if (!this.prisma.workspacePageSnapshot) return (await build()).data;

    const readStartedAt = Date.now();
    let snapshot = await this.prisma.workspacePageSnapshot.findUnique({
      where: { ownerId_page: { ownerId, page } }
    });
    if (Date.now() - readStartedAt >= 1_000) {
      logger.warn({
        event: "workspace_page_snapshot_read_slow",
        page,
        durationMs: Date.now() - readStartedAt
      });
    }

    // Page projections are eventually consistent. A source change or expiry
    // never makes navigation wait for history aggregation and publication.
    const key = `${ownerId}:${page}`;
    if (
      !options.requireFresh &&
      snapshot?.payload !== null &&
      snapshot?.payload !== undefined &&
      snapshot.schemaVersion === SCHEMA_VERSION[page] &&
      (snapshot.dirtyVersion !== snapshot.builtVersion ||
        (snapshot.expiresAt !== null &&
          snapshot.expiresAt !== undefined &&
          snapshot.expiresAt.getTime() <= Date.now()))
    ) {
      if (!this.expiryRefreshInFlight.has(key)) {
        this.expiryRefreshInFlight.add(key);
        after(async () => {
          try {
            await this.readOrBuild(ownerId, page, build, { requireFresh: true });
          } catch (error) {
            logger.error({
              event: "workspace_page_background_refresh_failed",
              ownerId,
              page,
              reason: error instanceof Error ? error.message : String(error)
            });
          } finally {
            this.expiryRefreshInFlight.delete(key);
          }
        });
      }
      return snapshot.payload as T;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (
        snapshot?.payload !== null &&
        snapshot?.payload !== undefined &&
        snapshot.schemaVersion === SCHEMA_VERSION[page] &&
        snapshot.dirtyVersion === snapshot.builtVersion &&
        (!snapshot.expiresAt || snapshot.expiresAt.getTime() > Date.now())
      ) {
        return snapshot.payload as T;
      }

      if (!snapshot) {
        try {
          snapshot = await this.prisma.workspacePageSnapshot.upsert({
            where: { ownerId_page: { ownerId, page } },
            create: { ownerId, page },
            update: {}
          });
        } catch (error) {
          // The first page visit can precede creation of CandidateProfile.
          // Let its builder return the normal onboarding redirect or empty
          // state instead of leaking the snapshot foreign-key error.
          if (hasPrismaCode(error, "P2003")) return (await build()).data;
          throw error;
        }
      }

      const buildStartedAt = Date.now();
      const { data, cacheable, expiresAt } = await build();
      if (Date.now() - buildStartedAt >= 1_000) {
        logger.warn({
          event: "workspace_page_rebuild_slow",
          page,
          attempt: attempt + 1,
          durationMs: Date.now() - buildStartedAt
        });
      }
      if (!cacheable) return data;
      const payload = JSON.parse(JSON.stringify(data)) as T;
      const publishStartedAt = Date.now();
      const updated = await this.prisma.workspacePageSnapshot.updateMany({
        where: { ownerId, page, dirtyVersion: snapshot.dirtyVersion },
        data: {
          payload: payload as Prisma.InputJsonValue,
          schemaVersion: SCHEMA_VERSION[page],
          builtVersion: snapshot.dirtyVersion,
          builtAt: new Date(),
          expiresAt: expiresAt ?? null
        }
      });
      if (Date.now() - publishStartedAt >= 1_000) {
        logger.warn({
          event: "workspace_page_snapshot_publish_slow",
          page,
          durationMs: Date.now() - publishStartedAt
        });
      }
      if (updated.count === 1) return payload;
      const latest = await this.prisma.workspacePageSnapshot.findUniqueOrThrow({
        where: { ownerId_page: { ownerId, page } }
      });
      logger.warn({
        event: "workspace_page_snapshot_changed_during_build",
        page,
        attempt: attempt + 1,
        startedVersion: snapshot.dirtyVersion,
        currentVersion: latest.dirtyVersion
      });
      snapshot = latest;
    }

    return (await build()).data;
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
