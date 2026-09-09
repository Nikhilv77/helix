/**
 * Read-only inventory for persisted compatibility records.
 *
 * This deliberately reports aggregate counts only: no owner IDs, profile
 * fields, question answers, or snapshot bodies cross the operational boundary.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_PREPARATION_STAGES = ["baseline_coding", "baseline_technical", "baseline_reasoning"];

async function main() {
  const [preparationStages, recommendationVersions, assessmentVersions, legacyDsaMetadata] =
    await Promise.all([
      prisma.$queryRaw`
        SELECT
          COALESCE("preparationOnboarding"->>'stage', '<null>') AS stage,
          COUNT(*)::int AS count
        FROM "CandidateProfile"
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE("recommendationSnapshot"->>'schemaVersion', '<missing>') AS version,
          COUNT(*)::int AS count
        FROM "DsaPracticeBlock"
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(
            "assessmentSnapshot"->>'schemaVersion',
            CASE
              WHEN "assessmentSnapshot" IS NULL THEN '<null>'
              ELSE '<missing>'
            END
          ) AS version,
          COUNT(*)::int AS count
        FROM "DsaBlockAssessment"
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS "sessionRows",
          COUNT(DISTINCT roadmap."ownerId")::int AS owners,
          COUNT(*) FILTER (WHERE block.id IS NULL)::int AS "rowsWithoutDurableBlock"
        FROM "UserSessionProgress" session
        JOIN "UserRoadmap" roadmap ON roadmap.id = session."roadmapId"
        LEFT JOIN "DsaPracticeBlock" block ON block."ownerId" = roadmap."ownerId"
        WHERE session."practiceSessionKey" = 'dsa'
          AND jsonb_typeof(session.metadata->'dsaRecommendationBlock') = 'object'
          AND jsonb_array_length(
            COALESCE(
              session.metadata->'dsaRecommendationBlock'->'questionSlugs',
              '[]'::jsonb
            )
          ) > 0
      `
    ]);

  const legacyPreparationRows = preparationStages
    .filter((row) => LEGACY_PREPARATION_STAGES.includes(row.stage))
    .reduce((total, row) => total + row.count, 0);

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        preparationOnboarding: {
          stages: preparationStages,
          legacyStageNames: LEGACY_PREPARATION_STAGES,
          legacyRows: legacyPreparationRows
        },
        dsa: {
          recommendationVersions,
          assessmentVersions,
          legacySessionMetadata: legacyDsaMetadata[0] ?? {
            sessionRows: 0,
            owners: 0,
            rowsWithoutDurableBlock: 0
          }
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("compatibility audit failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
