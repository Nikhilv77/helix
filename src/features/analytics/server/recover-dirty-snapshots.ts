import { Prisma } from "@prisma/client";
import { getPrismaService } from "@/server/database/prisma.service";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { buildCandidateAnalytics } from "./candidate-analytics-loader";
import { CANDIDATE_ANALYTICS_SCHEMA_VERSION } from "./candidate-analytics-snapshot.store";
import { PRACTICE_HOME_SCHEMA_VERSION } from "@/features/practice/shared/server/practice-home-snapshot.store";
import { loadPracticeHomeView } from "@/features/practice/shared/server/practice-home-loader";
import { refreshWorkspacePage } from "./refresh-workspace-pages";
import type { WorkspacePage } from "./workspace-page-snapshot.store";

type DirtyPage = { ownerId: string; kind: "analytics" | "practice" | "workspace"; page: string };
const logger = new Logger("SnapshotRecovery");
const workspacePages = new Set<WorkspacePage>([
  "interviews",
  "resume-roast",
  "trailmate",
  "reports"
]);

/** Durable dirty counters let the daily maintenance pass recover missed after() work. */
export async function recoverDirtySnapshots(
  limit = 4,
  options: { includeMissing?: boolean; includeDayRollover?: boolean } = {}
): Promise<{ attempted: number; failed: number }> {
  const includeMissing = options.includeMissing ?? true;
  const includeDayRollover = options.includeDayRollover ?? true;
  const jobs = await getPrismaService().$queryRaw<DirtyPage[]>(Prisma.sql`
    WITH eligible AS (
      SELECT "ownerId" FROM "CandidateProfile"
      WHERE "onboardingCompletedAt" IS NOT NULL
        AND "preparationOnboarding"->>'completedAt' IS NOT NULL
    ), dirty AS (
      SELECT snapshot."ownerId", 'analytics'::text AS kind, ''::text AS page, snapshot."builtAt"
      FROM "CandidateAnalyticsSnapshot" snapshot JOIN eligible USING ("ownerId")
      WHERE snapshot."payload" IS NULL OR snapshot."schemaVersion" <> ${CANDIDATE_ANALYTICS_SCHEMA_VERSION}
        OR snapshot."dirtyVersion" <> snapshot."builtVersion"
        OR (${includeDayRollover} AND snapshot."builtDay" IS DISTINCT FROM to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
      UNION ALL
      SELECT snapshot."ownerId", 'practice'::text, ''::text, snapshot."builtAt"
      FROM "PracticeHomeSnapshot" snapshot JOIN eligible USING ("ownerId")
      WHERE snapshot."payload" IS NULL OR snapshot."schemaVersion" <> ${PRACTICE_HOME_SCHEMA_VERSION}
        OR snapshot."dirtyVersion" <> snapshot."builtVersion"
        OR (${includeDayRollover} AND snapshot."builtDay" IS DISTINCT FROM to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
      UNION ALL
      SELECT snapshot."ownerId", 'workspace'::text, snapshot."page", snapshot."builtAt"
      FROM "WorkspacePageSnapshot" snapshot JOIN eligible USING ("ownerId")
      WHERE snapshot."page" IN ('interviews', 'resume-roast', 'trailmate', 'reports')
        AND (snapshot."payload" IS NULL
          OR snapshot."schemaVersion" <> CASE WHEN snapshot."page" = 'resume-roast' THEN 2 ELSE 1 END
          OR snapshot."dirtyVersion" <> snapshot."builtVersion")
    ), missing AS (
      SELECT eligible."ownerId", 'analytics'::text AS kind, ''::text AS page,
        NULL::timestamp AS "builtAt"
      FROM eligible WHERE ${includeMissing} AND NOT EXISTS (
        SELECT 1 FROM "CandidateAnalyticsSnapshot" snapshot
        WHERE snapshot."ownerId" = eligible."ownerId"
      )
      UNION ALL
      SELECT eligible."ownerId", 'practice'::text, ''::text, NULL::timestamp
      FROM eligible WHERE ${includeMissing} AND NOT EXISTS (
        SELECT 1 FROM "PracticeHomeSnapshot" snapshot
        WHERE snapshot."ownerId" = eligible."ownerId"
      )
      UNION ALL
      SELECT eligible."ownerId", 'workspace'::text, pages.page, NULL::timestamp
      FROM eligible CROSS JOIN (
        VALUES ('interviews'), ('resume-roast'), ('trailmate'), ('reports')
      ) AS pages(page)
      WHERE ${includeMissing} AND NOT EXISTS (
        SELECT 1 FROM "WorkspacePageSnapshot" snapshot
        WHERE snapshot."ownerId" = eligible."ownerId" AND snapshot."page" = pages.page
      )
    )
    SELECT "ownerId", kind, page FROM (
      SELECT * FROM dirty UNION ALL SELECT * FROM missing
    ) pending
    ORDER BY "builtAt" NULLS FIRST, "ownerId", kind, page
    LIMIT ${Math.max(1, Math.min(limit, 8))}
  `);

  let failed = 0;
  for (const job of jobs) {
    try {
      if (job.kind === "analytics") {
        await getAppContainer().candidateAnalyticsSnapshotStore.readSummary(
          job.ownerId,
          () => buildCandidateAnalytics(job.ownerId),
          { requireFresh: true }
        );
      } else if (job.kind === "practice") {
        const app = getAppContainer();
        const profile = await app.profileService.get(job.ownerId);
        await app.practiceHomeSnapshotStore.readOrBuild(
          job.ownerId,
          () => loadPracticeHomeView(job.ownerId, profile),
          { requireFresh: true }
        );
      } else if (workspacePages.has(job.page as WorkspacePage)) {
        await refreshWorkspacePage(job.ownerId, job.page as WorkspacePage);
      }
      if (!(await projectionPublished(job))) {
        throw new Error("Projection remained dirty or was not published");
      }
    } catch (error) {
      failed += 1;
      logger.error({
        event: "snapshot_recovery_failed",
        ownerId: job.ownerId,
        kind: job.kind,
        page: job.page,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { attempted: jobs.length, failed };
}

async function projectionPublished(job: DirtyPage): Promise<boolean> {
  const prisma = getPrismaService();
  if (job.kind === "analytics") {
    const row = await prisma.candidateAnalyticsSnapshot.findUnique({
      where: { ownerId: job.ownerId },
      select: {
        payload: true,
        schemaVersion: true,
        builtDay: true,
        dirtyVersion: true,
        builtVersion: true
      }
    });
    return Boolean(
      row?.payload &&
      row.schemaVersion === CANDIDATE_ANALYTICS_SCHEMA_VERSION &&
      row.builtDay === todayUtc() &&
      row.dirtyVersion === row.builtVersion
    );
  }
  if (job.kind === "practice") {
    const row = await prisma.practiceHomeSnapshot.findUnique({
      where: { ownerId: job.ownerId },
      select: {
        payload: true,
        schemaVersion: true,
        builtDay: true,
        dirtyVersion: true,
        builtVersion: true
      }
    });
    return Boolean(
      row?.payload &&
      row.schemaVersion === PRACTICE_HOME_SCHEMA_VERSION &&
      row.builtDay === todayUtc() &&
      row.dirtyVersion === row.builtVersion
    );
  }
  const row = await prisma.workspacePageSnapshot.findUnique({
    where: { ownerId_page: { ownerId: job.ownerId, page: job.page } },
    select: { payload: true, schemaVersion: true, dirtyVersion: true, builtVersion: true }
  });
  return Boolean(
    row?.payload &&
    row.schemaVersion === (job.page === "resume-roast" ? 2 : 1) &&
    row.dirtyVersion === row.builtVersion
  );
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
