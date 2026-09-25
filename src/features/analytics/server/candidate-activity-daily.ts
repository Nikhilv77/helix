import { Prisma } from "@prisma/client";

interface DailyAggregate {
  day: Date;
  practiceAttempts: number;
  practiceSolved: number;
  interviewsStarted: number;
  interviewsCompleted: number;
  roastsCompleted: number;
  trailmateResolved: number;
}

/** Rebuildable daily facts; grouping happens in Postgres, not in the page. */
export async function candidateActivityDaily(
  prisma: Prisma.TransactionClient,
  ownerId: string
): Promise<Prisma.CandidateActivityDailyCreateManyInput[]> {
  const rows = await prisma.$queryRaw<DailyAggregate[]>(Prisma.sql`
    WITH events AS (
      SELECT "createdAt"::date AS day, COUNT(*)::int AS attempts, 0 AS solved,
             0 AS started, 0 AS completed, 0 AS roasts, 0 AS trailmate
      FROM "UserQuestionAttempt" WHERE "ownerId" = ${ownerId} GROUP BY 1
      UNION ALL
      SELECT "createdAt"::date, COUNT(*)::int, 0, 0, 0, 0, 0
      FROM "CoreTechnicalQuestionAttempt" WHERE "ownerId" = ${ownerId} GROUP BY 1
      UNION ALL
      SELECT "createdAt"::date, COUNT(*)::int, 0, 0, 0, 0, 0
      FROM "AppliedEngineeringQuestionAttempt" WHERE "ownerId" = ${ownerId} GROUP BY 1
      UNION ALL
      SELECT "createdAt"::date, COUNT(*)::int, 0, 0, 0, 0, 0
      FROM "ArchitectureQuestionAttempt" WHERE "ownerId" = ${ownerId} GROUP BY 1
      UNION ALL
      SELECT "createdAt"::date, COUNT(*)::int, 0, 0, 0, 0, 0
      FROM "AiMlPracticeAttempt" WHERE "ownerId" = ${ownerId} GROUP BY 1
      UNION ALL
      SELECT question."completedAt"::date, 0, COUNT(*)::int, 0, 0, 0, 0
      FROM "UserQuestionProgress" question
      JOIN "UserRoadmap" roadmap ON roadmap.id = question."roadmapId"
      WHERE roadmap."ownerId" = ${ownerId} AND roadmap.role = 'fullstack'
        AND question."completedAt" IS NOT NULL
      GROUP BY 1
      UNION ALL
      SELECT COALESCE("completedAt", "learnedAt")::date, 0, COUNT(*)::int, 0, 0, 0, 0
      FROM "CoreTechnicalBlockQuestion"
      WHERE "ownerId" = ${ownerId} AND COALESCE("completedAt", "learnedAt") IS NOT NULL GROUP BY 1
      UNION ALL
      SELECT COALESCE("completedAt", "learnedAt")::date, 0, COUNT(*)::int, 0, 0, 0, 0
      FROM "AppliedEngineeringBlockQuestion"
      WHERE "ownerId" = ${ownerId} AND COALESCE("completedAt", "learnedAt") IS NOT NULL GROUP BY 1
      UNION ALL
      SELECT COALESCE("completedAt", "learnedAt")::date, 0, COUNT(*)::int, 0, 0, 0, 0
      FROM "ArchitectureBlockQuestion"
      WHERE "ownerId" = ${ownerId} AND COALESCE("completedAt", "learnedAt") IS NOT NULL GROUP BY 1
      UNION ALL
      SELECT COALESCE("completedAt", "learnedAt")::date, 0, COUNT(*)::int, 0, 0, 0, 0
      FROM "AiMlPracticeQuestion"
      WHERE "ownerId" = ${ownerId} AND COALESCE("completedAt", "learnedAt") IS NOT NULL GROUP BY 1
      UNION ALL
      SELECT "startedAt"::date, 0, 0, COUNT(*)::int, 0, 0, 0
      FROM "InterviewSession" WHERE "ownerId" = ${ownerId} GROUP BY 1
      UNION ALL
      SELECT "completedAt"::date, 0, 0, 0, COUNT(*)::int, 0, 0
      FROM "InterviewSession" WHERE "ownerId" = ${ownerId} AND "completedAt" IS NOT NULL GROUP BY 1
      UNION ALL
      SELECT "updatedAt"::date, 0, 0, 0, 0, COUNT(*)::int, 0
      FROM "ResumeRoast" WHERE "ownerId" = ${ownerId} AND status = 'READY'::"ResumeRoastStatus" GROUP BY 1
      UNION ALL
      SELECT "resolvedAt"::date, 0, 0, 0, 0, 0, COUNT(*)::int
      FROM "HelpRequest"
      WHERE ("learnerId" = ${ownerId} OR "helperId" = ${ownerId}) AND "resolvedAt" IS NOT NULL
      GROUP BY 1
    )
    SELECT day,
           SUM(attempts)::int AS "practiceAttempts",
           SUM(solved)::int AS "practiceSolved",
           SUM(started)::int AS "interviewsStarted",
           SUM(completed)::int AS "interviewsCompleted",
           SUM(roasts)::int AS "roastsCompleted",
           SUM(trailmate)::int AS "trailmateResolved"
    FROM events GROUP BY day ORDER BY day
  `);
  return rows.map((row) => ({ ownerId, ...row }));
}
