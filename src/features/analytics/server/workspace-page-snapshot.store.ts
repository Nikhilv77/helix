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

// interviews 2: history includes Architecture assessments.
// reports 2: interview rounds plus Node.js assessment reports, each counted once.
// resume-roast 4: in-progress generation, rubric scorecards, and the profile
// target the in-page resume upload needs.
// trailmate 3: overview carries the online-mates count and leaderboard size.
// interviews 7: System Design no longer resumes an Architecture Practice checkpoint.
export const WORKSPACE_PAGE_SCHEMA_VERSION: Record<WorkspacePage, number> = {
  interviews: 8,
  "resume-roast": 4,
  trailmate: 3,
  reports: 4
};
const SCHEMA_VERSION = WORKSPACE_PAGE_SCHEMA_VERSION;
/**
 * Pages that may show the previous payload while a rebuild runs. Resume Roast
 * opts out: its sources change only when the user acts on that page (a new
 * roast, a new resume), and a reload must show that change, not undo it.
 */
const SERVE_STALE_WHILE_REBUILDING: Record<WorkspacePage, boolean> = {
  interviews: true,
  "resume-roast": false,
  trailmate: true,
  reports: true
};
const logger = new Logger("WorkspacePageSnapshot");
const FRESH_WAIT_TIMED_OUT: unique symbol = Symbol("fresh-wait-timed-out");
const FRESH_WAIT_FAILED: unique symbol = Symbol("fresh-wait-failed");

/** One owner-scoped read for warm workspace pages; source-table triggers mark rows dirty. */
export class WorkspacePageSnapshotStore {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly expiryRefreshInFlight = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  readOrBuild<T>(
    ownerId: string,
    page: WorkspacePage,
    build: () => Promise<BuiltWorkspacePage<T>>,
    options: ReadOptions = {}
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
    options: ReadOptions = {}
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
      SERVE_STALE_WHILE_REBUILDING[page] &&
      snapshot?.payload !== null &&
      snapshot?.payload !== undefined &&
      snapshot.schemaVersion === SCHEMA_VERSION[page] &&
      (snapshot.dirtyVersion !== snapshot.builtVersion ||
        (snapshot.expiresAt !== null &&
          snapshot.expiresAt !== undefined &&
          snapshot.expiresAt.getTime() <= Date.now()))
    ) {
      if (options.waitForFreshMs) {
        return this.freshWithin(
          ownerId,
          page,
          build,
          snapshot.payload as T,
          options.waitForFreshMs
        );
      }
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

  /**
   * Races the rebuild against a budget: a rebuild that finishes in time is
   * served, otherwise the previous payload is, and the rebuild carries on
   * after the response.
   */
  private async freshWithin<T>(
    ownerId: string,
    page: WorkspacePage,
    build: () => Promise<BuiltWorkspacePage<T>>,
    previous: T,
    budgetMs: number
  ): Promise<T> {
    const settled: Promise<T | typeof FRESH_WAIT_FAILED> = this.readOrBuild(
      ownerId,
      page,
      build,
      { requireFresh: true }
    ).catch(
      (error: unknown) => {
        logger.error({
          event: "workspace_page_background_refresh_failed",
          ownerId,
          page,
          reason: error instanceof Error ? error.message : String(error)
        });
        return FRESH_WAIT_FAILED;
      }
    );
    try {
      after(() => settled);
    } catch {
      // Outside a request there is nothing to keep alive.
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<typeof FRESH_WAIT_TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(FRESH_WAIT_TIMED_OUT), budgetMs);
    });
    const result: T | typeof FRESH_WAIT_FAILED | typeof FRESH_WAIT_TIMED_OUT = await Promise.race([
      settled,
      timedOut
    ]);
    clearTimeout(timer);
    if (result === FRESH_WAIT_TIMED_OUT) {
      logger.warn({ event: "workspace_page_fresh_wait_exceeded", page, budgetMs });
      return previous;
    }
    return result === FRESH_WAIT_FAILED ? previous : result;
  }
}

interface ReadOptions {
  requireFresh?: boolean;
  /**
   * When the saved payload is out of date, wait up to this long for the
   * rebuild before serving it anyway. For pages people open right after the
   * action that changed them.
   */
  waitForFreshMs?: number;
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
