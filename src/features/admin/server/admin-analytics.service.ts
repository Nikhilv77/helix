import { Prisma } from "@prisma/client";
import type { PrismaService } from "@/server/database/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Any of these columns above zero means the learner did something that day. */
const ACTIVE_DAY = Prisma.sql`("practiceAttempts" + "practiceSolved" + "interviewsStarted" + "interviewsCompleted" + "roastsCompleted" + "trailmateResolved") > 0`;

export type DailyPoint = { date: string; value: number };
export type Labelled = { label: string; value: number };

export interface AdminOverview {
  days: number;
  users: { total: number; onboarded: number; newInWindow: number; newInPreviousWindow: number };
  active: { today: number; week: number; month: number };
  weekOneRetention: { eligible: number; retained: number };
  dailyActive: DailyPoint[];
  dailySignups: DailyPoint[];
  totals: {
    practiceAttempts: number;
    practiceSolved: number;
    interviewsStarted: number;
    interviewsCompleted: number;
    roastsCompleted: number;
    trailmateResolved: number;
  };
  funnel: Labelled[];
}

export interface AdminUserRow {
  ownerId: string;
  targetRole: string | null;
  level: string | null;
  createdAt: string;
  onboarded: boolean;
  lastActive: string | null;
  attempts30: number;
  solvedTotal: number;
  interviews: number;
  roasts: number;
}

export interface AdminUsersPage {
  rows: AdminUserRow[];
  total: number;
  roles: Labelled[];
  levels: Labelled[];
  cohorts: Array<{ week: string; size: number; activeByWeek: number[] }>;
}

export interface AdminTrackStat {
  track: string;
  learners: number;
  solved: number;
  learned: number;
  checkpointsReady: number;
  checkpointsInProgress: number;
  checkpointsCompleted: number;
  averageScore: number | null;
}

export interface AdminPracticeOverview {
  days: number;
  learners: number;
  dailyAttempts: DailyPoint[];
  tracks: AdminTrackStat[];
  mostLearned: Array<{ track: string; title: string; learned: number; solved: number }>;
}

export interface AdminUserDetail {
  ownerId: string;
  profile: {
    targetRole: string | null;
    level: string | null;
    targetCompany: string | null;
    targetDate: string | null;
    createdAt: string;
    onboardingCompletedAt: string | null;
    preparationCompletedAt: string | null;
    teacherId: string | null;
    workspaceAccent: string;
  };
  totals: AdminOverview["totals"] & { activeDays: number; lastActive: string | null };
  dailyActivity: DailyPoint[];
  tracks: Array<{ track: string; solved: number; learned: number; total: number; checkpoints: number; averageScore: number | null }>;
  interviews: Array<{ id: string; round: string; phase: string; startedAt: string; completedAt: string | null }>;
  roasts: Array<{ id: string; role: string; level: string; status: string; createdAt: string }>;
}

/**
 * Read-only aggregates for the admin dashboard. Every page's queries run in
 * parallel and aggregate in SQL, so a page costs one round trip of waves and
 * stays flat as the user base grows.
 */
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(days: number, now = new Date()): Promise<AdminOverview> {
    const since = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
    const previousSince = new Date(since.getTime() - days * DAY_MS);
    const [users, active, retention, dailyActive, dailySignups, totals, funnel] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: number; onboarded: number; fresh: number; previous: number }>>`
        SELECT count(*)::int AS total,
               count("onboardingCompletedAt")::int AS onboarded,
               count(*) FILTER (WHERE "createdAt" >= ${since})::int AS fresh,
               count(*) FILTER (WHERE "createdAt" >= ${previousSince} AND "createdAt" < ${since})::int AS previous
        FROM "CandidateProfile"`,
      this.prisma.$queryRaw<Array<{ today: number; week: number; month: number }>>`
        SELECT count(DISTINCT "ownerId") FILTER (WHERE day >= ${startOfDay(now)}::date)::int AS today,
               count(DISTINCT "ownerId") FILTER (WHERE day >= ${daysAgo(now, 6)}::date)::int AS week,
               count(DISTINCT "ownerId") FILTER (WHERE day >= ${daysAgo(now, 29)}::date)::int AS month
        FROM "CandidateActivityDaily" WHERE ${ACTIVE_DAY} AND day >= ${daysAgo(now, 29)}::date`,
      this.prisma.$queryRaw<Array<{ eligible: number; retained: number }>>`
        WITH cohort AS (
          SELECT "ownerId", "createdAt"::date AS joined FROM "CandidateProfile"
          WHERE "createdAt" >= ${since} AND "createdAt" < ${new Date(now.getTime() - 7 * DAY_MS)}
        )
        SELECT count(*)::int AS eligible,
               count(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM "CandidateActivityDaily" a
                 WHERE a."ownerId" = c."ownerId" AND a.day > c.joined AND a.day <= c.joined + 7 AND ${ACTIVE_DAY}
               ))::int AS retained
        FROM cohort c`,
      this.prisma.$queryRaw<Array<{ day: Date; value: number }>>`
        SELECT day, count(DISTINCT "ownerId")::int AS value FROM "CandidateActivityDaily"
        WHERE day >= ${since}::date AND ${ACTIVE_DAY} GROUP BY day`,
      this.prisma.$queryRaw<Array<{ day: Date; value: number }>>`
        SELECT "createdAt"::date AS day, count(*)::int AS value FROM "CandidateProfile"
        WHERE "createdAt" >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<Array<AdminOverview["totals"]>>`
        SELECT coalesce(sum("practiceAttempts"), 0)::int AS "practiceAttempts",
               coalesce(sum("practiceSolved"), 0)::int AS "practiceSolved",
               coalesce(sum("interviewsStarted"), 0)::int AS "interviewsStarted",
               coalesce(sum("interviewsCompleted"), 0)::int AS "interviewsCompleted",
               coalesce(sum("roastsCompleted"), 0)::int AS "roastsCompleted",
               coalesce(sum("trailmateResolved"), 0)::int AS "trailmateResolved"
        FROM "CandidateActivityDaily" WHERE day >= ${since}::date`,
      this.prisma.$queryRaw<Array<{ signed: number; onboarded: number; prepared: number; practised: number; interviewed: number; completed: number }>>`
        SELECT count(*)::int AS signed,
               count("onboardingCompletedAt")::int AS onboarded,
               count("preparationOnboardingCompletedAt")::int AS prepared,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "CandidateActivityDaily" a WHERE a."ownerId" = p."ownerId" AND a."practiceAttempts" > 0))::int AS practised,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "InterviewSession" s WHERE s."ownerId" = p."ownerId"))::int AS interviewed,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "InterviewSession" s WHERE s."ownerId" = p."ownerId" AND s."completedAt" IS NOT NULL))::int AS completed
        FROM "CandidateProfile" p`
    ]);
    const counts = users[0]!;
    const f = funnel[0]!;
    return {
      days,
      users: {
        total: counts.total,
        onboarded: counts.onboarded,
        newInWindow: counts.fresh,
        newInPreviousWindow: counts.previous
      },
      active: active[0] ?? { today: 0, week: 0, month: 0 },
      weekOneRetention: retention[0] ?? { eligible: 0, retained: 0 },
      dailyActive: fillDays(since, days, dailyActive),
      dailySignups: fillDays(since, days, dailySignups),
      totals: totals[0]!,
      funnel: [
        { label: "Signed up", value: f.signed },
        { label: "Finished onboarding", value: f.onboarded },
        { label: "Finished preparation setup", value: f.prepared },
        { label: "Practised a question", value: f.practised },
        { label: "Started an interview", value: f.interviewed },
        { label: "Completed an interview", value: f.completed }
      ]
    };
  }

  async users(input: { page: number; pageSize: number; ownerIds?: string[] | null }): Promise<AdminUsersPage> {
    const offset = Math.max(0, input.page - 1) * input.pageSize;
    const filter =
      input.ownerIds === undefined || input.ownerIds === null
        ? Prisma.sql`TRUE`
        : input.ownerIds.length
          ? Prisma.sql`p."ownerId" IN (${Prisma.join(input.ownerIds)})`
          : Prisma.sql`FALSE`;
    const monthAgo = daysAgo(new Date(), 29);
    const [rows, total, roles, levels, cohorts] = await Promise.all([
      this.prisma.$queryRaw<Array<Omit<AdminUserRow, "createdAt" | "lastActive"> & { createdAt: Date; lastActive: Date | null }>>`
        SELECT p."ownerId", p."targetRole", p.level, p."createdAt",
               (p."onboardingCompletedAt" IS NOT NULL) AS onboarded,
               act."lastActive", coalesce(act.attempts30, 0)::int AS "attempts30",
               coalesce(act.solved, 0)::int AS "solvedTotal",
               (SELECT count(*) FROM "InterviewSession" s WHERE s."ownerId" = p."ownerId")::int AS interviews,
               (SELECT count(*) FROM "ResumeRoast" r WHERE r."ownerId" = p."ownerId" AND r.status = 'READY')::int AS roasts
        FROM "CandidateProfile" p
        LEFT JOIN LATERAL (
          SELECT max(day) FILTER (WHERE ${ACTIVE_DAY}) AS "lastActive",
                 sum("practiceAttempts") FILTER (WHERE day >= ${monthAgo}::date) AS attempts30,
                 sum("practiceSolved") AS solved
          FROM "CandidateActivityDaily" a WHERE a."ownerId" = p."ownerId"
        ) act ON TRUE
        WHERE ${filter}
        ORDER BY act."lastActive" DESC NULLS LAST, p."createdAt" DESC
        LIMIT ${input.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<Array<{ total: number }>>`SELECT count(*)::int AS total FROM "CandidateProfile" p WHERE ${filter}`,
      this.prisma.$queryRaw<Labelled[]>`
        SELECT coalesce("targetRole", 'Not set') AS label, count(*)::int AS value
        FROM "CandidateProfile" GROUP BY 1 ORDER BY value DESC`,
      this.prisma.$queryRaw<Labelled[]>`
        SELECT coalesce(level, 'Not set') AS label, count(*)::int AS value
        FROM "CandidateProfile" GROUP BY 1 ORDER BY value DESC`,
      this.prisma.$queryRaw<Array<{ week: Date; size: number; wk: number | null; active: number }>>`
        WITH cohort AS (
          SELECT "ownerId", date_trunc('week', "createdAt")::date AS week, "createdAt"::date AS joined
          FROM "CandidateProfile" WHERE "createdAt" >= date_trunc('week', now()) - interval '7 weeks'
        ),
        activity AS (
          SELECT DISTINCT a."ownerId", ((a.day - c.joined) / 7)::int AS wk
          FROM "CandidateActivityDaily" a JOIN cohort c ON c."ownerId" = a."ownerId"
          WHERE a.day >= c.joined AND ${ACTIVE_DAY}
        )
        SELECT c.week, (SELECT count(*) FROM cohort x WHERE x.week = c.week)::int AS size,
               act.wk, count(DISTINCT act."ownerId")::int AS active
        FROM cohort c LEFT JOIN activity act ON act."ownerId" = c."ownerId"
        GROUP BY c.week, act.wk ORDER BY c.week`
    ]);
    const byWeek = new Map<string, { size: number; activeByWeek: number[] }>();
    for (const row of cohorts) {
      const key = isoDay(row.week);
      const entry = byWeek.get(key) ?? { size: row.size, activeByWeek: Array<number>(8).fill(0) };
      if (row.wk !== null && row.wk >= 0 && row.wk < 8) entry.activeByWeek[row.wk] = row.active;
      byWeek.set(key, entry);
    }
    return {
      rows: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        lastActive: row.lastActive ? isoDay(row.lastActive) : null
      })),
      total: total[0]?.total ?? 0,
      roles,
      levels,
      cohorts: [...byWeek.entries()].map(([week, value]) => ({ week, ...value }))
    };
  }

  async practice(days: number, now = new Date()): Promise<AdminPracticeOverview> {
    const since = startOfDay(new Date(now.getTime() - (days - 1) * DAY_MS));
    const node = (label: string, questions: string, assessments: string, reports: string) =>
      this.trackStat(label, questions, assessments, reports, since);
    const [learners, daily, coreTechnical, applied, architecture, story, dsa, mostLearned] = await Promise.all([
      this.prisma.$queryRaw<Array<{ value: number }>>`
        SELECT count(DISTINCT "ownerId")::int AS value FROM "CandidateActivityDaily"
        WHERE day >= ${since}::date AND "practiceAttempts" > 0`,
      this.prisma.$queryRaw<Array<{ day: Date; value: number }>>`
        SELECT day, sum("practiceAttempts")::int AS value FROM "CandidateActivityDaily"
        WHERE day >= ${since}::date GROUP BY day`,
      node("Core Technical · Node.js", "CoreTechnicalBlockQuestion", "CoreTechnicalAssessment", "CoreTechnicalAssessmentReport"),
      node("Applied Engineering · Node.js", "AppliedEngineeringBlockQuestion", "AppliedEngineeringAssessment", "AppliedEngineeringAssessmentReport"),
      node("Architecture & Design", "ArchitectureBlockQuestion", "ArchitectureAssessment", "ArchitectureAssessmentReport"),
      this.prisma.$queryRaw<Array<AdminTrackStat & { discipline: string; trackKey: string }>>`
        WITH q AS (
          SELECT s.discipline, s.track::text AS "trackKey", q."ownerId", q.status, q."completedAt", q."learnedAt"
          FROM "AiMlPracticeQuestion" q JOIN "AiMlPracticeSession" s ON s.id = q."sessionId"
        ),
        a AS (
          SELECT discipline, track::text AS "trackKey", status, "completedAt", (report->>'overallScore')::float AS score
          FROM "StoryTrackAssessment"
        )
        SELECT k.discipline, k."trackKey",
               (SELECT count(DISTINCT "ownerId") FROM q WHERE q.discipline = k.discipline AND q."trackKey" = k."trackKey"
                  AND (q."completedAt" >= ${since} OR q."learnedAt" >= ${since}))::int AS learners,
               (SELECT count(*) FROM q WHERE q.discipline = k.discipline AND q."trackKey" = k."trackKey" AND q."completedAt" >= ${since})::int AS solved,
               (SELECT count(*) FROM q WHERE q.discipline = k.discipline AND q."trackKey" = k."trackKey" AND q."learnedAt" >= ${since})::int AS learned,
               0 AS "checkpointsReady",
               (SELECT count(*) FROM a WHERE a.discipline = k.discipline AND a."trackKey" = k."trackKey" AND a.status IN ('IN_PROGRESS', 'FINALIZING'))::int AS "checkpointsInProgress",
               (SELECT count(*) FROM a WHERE a.discipline = k.discipline AND a."trackKey" = k."trackKey" AND a.status = 'COMPLETED' AND a."completedAt" >= ${since})::int AS "checkpointsCompleted",
               (SELECT round(avg(score)::numeric, 0)::float FROM a WHERE a.discipline = k.discipline AND a."trackKey" = k."trackKey" AND a.status = 'COMPLETED' AND a."completedAt" >= ${since}) AS "averageScore"
        FROM (SELECT DISTINCT discipline, "trackKey" FROM q) k
        ORDER BY k.discipline, k."trackKey"`,
      this.prisma.$queryRaw<Array<AdminTrackStat>>`
        SELECT 'DSA' AS track,
               (SELECT count(DISTINCT r."ownerId") FROM "UserQuestionProgress" u JOIN "UserRoadmap" r ON r.id = u."roadmapId"
                  WHERE u."dsaQuestionSlug" IS NOT NULL AND u."completedAt" >= ${since})::int AS learners,
               (SELECT count(*) FROM "UserQuestionProgress" u WHERE u."dsaQuestionSlug" IS NOT NULL AND u."completedAt" >= ${since})::int AS solved,
               0 AS learned,
               (SELECT count(*) FROM "DsaPracticeBlock" WHERE status = 'ASSESSMENT_READY')::int AS "checkpointsReady",
               (SELECT count(*) FROM "DsaPracticeBlock" WHERE status = 'ASSESSMENT_IN_PROGRESS')::int AS "checkpointsInProgress",
               (SELECT count(*) FROM "DsaBlockAssessment" WHERE "completedAt" >= ${since})::int AS "checkpointsCompleted",
               (SELECT round(avg(("reportSnapshot"->>'overall')::float)::numeric, 0)::float FROM "DsaBlockAssessment"
                  WHERE "completedAt" >= ${since} AND "reportSnapshot" IS NOT NULL) AS "averageScore"`,
      this.prisma.$queryRaw<Array<{ track: string; title: string; learned: number; solved: number }>>`
        SELECT s.discipline || ' · ' || s.track::text AS track,
               coalesce(q."publicSnapshot"->>'title', q."publicSnapshot"->'question'->>'title', q."questionKey") AS title,
               count(*) FILTER (WHERE q.status = 'LEARNED')::int AS learned,
               count(*) FILTER (WHERE q.status = 'COMPLETED')::int AS solved
        FROM "AiMlPracticeQuestion" q JOIN "AiMlPracticeSession" s ON s.id = q."sessionId"
        GROUP BY 1, 2 HAVING count(*) FILTER (WHERE q.status = 'LEARNED') > 0
        ORDER BY learned DESC, solved ASC LIMIT 10`
    ]);
    return {
      days,
      learners: learners[0]?.value ?? 0,
      dailyAttempts: fillDays(since, days, daily),
      tracks: [
        { ...dsa[0]! },
        coreTechnical,
        applied,
        architecture,
        ...story.map(({ discipline, trackKey, ...rest }) => ({
          ...rest,
          track: `${humanize(discipline)} · ${humanize(trackKey)}`
        }))
      ],
      mostLearned: mostLearned.map((row) => ({ ...row, track: humanizeTrack(row.track) }))
    };
  }

  async user(ownerId: string, now = new Date()): Promise<AdminUserDetail | null> {
    const since = daysAgo(now, 59);
    const [profile, totals, daily, nodeTracks, storyTracks, interviews, roasts] = await Promise.all([
      this.prisma.candidateProfile.findUnique({
        where: { ownerId },
        select: {
          targetRole: true,
          level: true,
          targetCompany: true,
          targetDate: true,
          createdAt: true,
          onboardingCompletedAt: true,
          preparationOnboardingCompletedAt: true,
          teacherId: true,
          workspaceAccent: true
        }
      }),
      this.prisma.$queryRaw<Array<AdminUserDetail["totals"] & { lastActiveDay: Date | null }>>`
        SELECT coalesce(sum("practiceAttempts"), 0)::int AS "practiceAttempts",
               coalesce(sum("practiceSolved"), 0)::int AS "practiceSolved",
               coalesce(sum("interviewsStarted"), 0)::int AS "interviewsStarted",
               coalesce(sum("interviewsCompleted"), 0)::int AS "interviewsCompleted",
               coalesce(sum("roastsCompleted"), 0)::int AS "roastsCompleted",
               coalesce(sum("trailmateResolved"), 0)::int AS "trailmateResolved",
               count(*) FILTER (WHERE ${ACTIVE_DAY})::int AS "activeDays",
               max(day) FILTER (WHERE ${ACTIVE_DAY}) AS "lastActiveDay"
        FROM "CandidateActivityDaily" WHERE "ownerId" = ${ownerId}`,
      this.prisma.$queryRaw<Array<{ day: Date; value: number }>>`
        SELECT day, ("practiceAttempts" + "interviewsStarted" + "roastsCompleted" + "trailmateResolved")::int AS value
        FROM "CandidateActivityDaily" WHERE "ownerId" = ${ownerId} AND day >= ${since}::date`,
      this.prisma.$queryRaw<AdminUserDetail["tracks"]>`
        SELECT 'Core Technical · Node.js' AS track,
               count(*) FILTER (WHERE status = 'COMPLETED')::int AS solved, count(*) FILTER (WHERE status = 'LEARNED')::int AS learned, count(*)::int AS total,
               (SELECT count(*) FROM "CoreTechnicalAssessment" WHERE "ownerId" = ${ownerId} AND status = 'COMPLETED')::int AS checkpoints,
               (SELECT round(avg(("reportSnapshot"->>'overallScore')::float)::numeric, 0)::float FROM "CoreTechnicalAssessmentReport" WHERE "ownerId" = ${ownerId}) AS "averageScore"
        FROM "CoreTechnicalBlockQuestion" WHERE "ownerId" = ${ownerId}
        UNION ALL
        SELECT 'Applied Engineering · Node.js',
               count(*) FILTER (WHERE status = 'COMPLETED')::int, count(*) FILTER (WHERE status = 'LEARNED')::int, count(*)::int,
               (SELECT count(*) FROM "AppliedEngineeringAssessment" WHERE "ownerId" = ${ownerId} AND status = 'COMPLETED')::int,
               (SELECT round(avg(("reportSnapshot"->>'overallScore')::float)::numeric, 0)::float FROM "AppliedEngineeringAssessmentReport" WHERE "ownerId" = ${ownerId})
        FROM "AppliedEngineeringBlockQuestion" WHERE "ownerId" = ${ownerId}
        UNION ALL
        SELECT 'Architecture & Design',
               count(*) FILTER (WHERE status = 'COMPLETED')::int, count(*) FILTER (WHERE status = 'LEARNED')::int, count(*)::int,
               (SELECT count(*) FROM "ArchitectureAssessment" WHERE "ownerId" = ${ownerId} AND status = 'COMPLETED')::int,
               (SELECT round(avg(("reportSnapshot"->>'overallScore')::float)::numeric, 0)::float FROM "ArchitectureAssessmentReport" WHERE "ownerId" = ${ownerId})
        FROM "ArchitectureBlockQuestion" WHERE "ownerId" = ${ownerId}
        UNION ALL
        SELECT 'DSA',
               (SELECT count(*) FROM "UserQuestionProgress" u JOIN "UserRoadmap" r ON r.id = u."roadmapId"
                  WHERE r."ownerId" = ${ownerId} AND u."dsaQuestionSlug" IS NOT NULL AND u.status = 'COMPLETED')::int,
               0, 0,
               (SELECT count(*) FROM "DsaBlockAssessment" WHERE "ownerId" = ${ownerId} AND "completedAt" IS NOT NULL)::int,
               (SELECT round(avg(("reportSnapshot"->>'overall')::float)::numeric, 0)::float FROM "DsaBlockAssessment" WHERE "ownerId" = ${ownerId} AND "reportSnapshot" IS NOT NULL)`,
      this.prisma.$queryRaw<Array<AdminUserDetail["tracks"][number] & { discipline: string; trackKey: string }>>`
        SELECT s.discipline, s.track::text AS "trackKey", '' AS track,
               count(*) FILTER (WHERE q.status = 'COMPLETED')::int AS solved,
               count(*) FILTER (WHERE q.status = 'LEARNED')::int AS learned, count(*)::int AS total,
               (SELECT count(*) FROM "StoryTrackAssessment" a WHERE a."ownerId" = ${ownerId} AND a.discipline = s.discipline AND a.track = s.track AND a.status = 'COMPLETED')::int AS checkpoints,
               (SELECT round(avg((a.report->>'overallScore')::float)::numeric, 0)::float FROM "StoryTrackAssessment" a
                  WHERE a."ownerId" = ${ownerId} AND a.discipline = s.discipline AND a.track = s.track AND a.status = 'COMPLETED') AS "averageScore"
        FROM "AiMlPracticeQuestion" q JOIN "AiMlPracticeSession" s ON s.id = q."sessionId"
        WHERE q."ownerId" = ${ownerId} GROUP BY s.discipline, s.track`,
      this.prisma.$queryRaw<Array<{ id: string; round: string | null; phase: string | null; startedAt: Date; completedAt: Date | null }>>`
        SELECT id, coalesce(state->'setup'->>'templateId', state->'setup'->>'roundType') AS round,
               state->>'phase' AS phase, "startedAt", "completedAt"
        FROM "InterviewSession" WHERE "ownerId" = ${ownerId} ORDER BY "startedAt" DESC LIMIT 12`,
      this.prisma.resumeRoast.findMany({
        where: { ownerId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, role: true, level: true, status: true, createdAt: true }
      })
    ]);
    if (!profile) return null;
    const { lastActiveDay, ...totalRow } = totals[0]!;
    return {
      ownerId,
      profile: {
        targetRole: profile.targetRole,
        level: profile.level,
        targetCompany: profile.targetCompany,
        targetDate: profile.targetDate?.toISOString() ?? null,
        createdAt: profile.createdAt.toISOString(),
        onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
        preparationCompletedAt: profile.preparationOnboardingCompletedAt?.toISOString() ?? null,
        teacherId: profile.teacherId,
        workspaceAccent: profile.workspaceAccent
      },
      totals: { ...totalRow, lastActive: lastActiveDay ? isoDay(lastActiveDay) : null },
      dailyActivity: fillDays(since, 60, daily),
      tracks: [
        ...nodeTracks.filter((track) => track.total > 0 || track.solved > 0 || track.checkpoints > 0),
        ...storyTracks.map(({ discipline, trackKey, ...rest }) => ({
          ...rest,
          track: `${humanize(discipline)} · ${humanize(trackKey)}`
        }))
      ],
      interviews: interviews.map((row) => ({
        id: row.id,
        round: humanize(row.round ?? "unknown"),
        phase: humanize(row.phase ?? "unknown"),
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null
      })),
      roasts: roasts.map((roast) => ({ ...roast, createdAt: roast.createdAt.toISOString() }))
    };
  }

  /** One Node.js block track: question outcomes and checkpoints in the window. */
  private async trackStat(
    label: string,
    questions: string,
    assessments: string,
    reports: string,
    since: Date
  ): Promise<AdminTrackStat> {
    const q = Prisma.raw(`"${questions}"`);
    const a = Prisma.raw(`"${assessments}"`);
    const r = Prisma.raw(`"${reports}"`);
    const rows = await this.prisma.$queryRaw<Array<Omit<AdminTrackStat, "track">>>`
      SELECT
        (SELECT count(DISTINCT "ownerId") FROM ${q} WHERE "completedAt" >= ${since} OR "learnedAt" >= ${since})::int AS learners,
        (SELECT count(*) FROM ${q} WHERE "completedAt" >= ${since})::int AS solved,
        (SELECT count(*) FROM ${q} WHERE "learnedAt" >= ${since})::int AS learned,
        (SELECT count(*) FROM ${a} WHERE status = 'READY')::int AS "checkpointsReady",
        (SELECT count(*) FROM ${a} WHERE status IN ('IN_PROGRESS', 'FINALIZING'))::int AS "checkpointsInProgress",
        (SELECT count(*) FROM ${a} WHERE status = 'COMPLETED' AND "completedAt" >= ${since})::int AS "checkpointsCompleted",
        (SELECT round(avg(("reportSnapshot"->>'overallScore')::float)::numeric, 0)::float FROM ${r} WHERE "finalizedAt" >= ${since}) AS "averageScore"`;
    return { track: label, ...rows[0]! };
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysAgo(now: Date, days: number): Date {
  return startOfDay(new Date(now.getTime() - days * DAY_MS));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Every day in the window, zero where nothing happened, so charts never skip a day. */
function fillDays(since: Date, days: number, rows: Array<{ day: Date; value: number }>): DailyPoint[] {
  const byDay = new Map(rows.map((row) => [isoDay(row.day), Number(row.value)]));
  return Array.from({ length: days }, (_, index) => {
    const date = isoDay(new Date(since.getTime() + index * DAY_MS));
    return { date, value: byDay.get(date) ?? 0 };
  });
}

function humanize(value: string): string {
  const special: Record<string, string> = {
    "ai-ml": "AI/ML",
    "core-technical": "Core Technical",
    "applied-engineering": "Applied Engineering",
    "architecture-design": "Architecture & Design",
    CORE_TECHNICAL: "Core Technical",
    APPLIED_ENGINEERING: "Applied Engineering",
    ARCHITECTURE_DESIGN: "Architecture & Design"
  };
  if (special[value]) return special[value];
  const words = value.replace(/[_-]+/g, " ").toLowerCase().trim();
  return (words.charAt(0).toUpperCase() + words.slice(1))
    .replace(/\bdsa\b/gi, "DSA")
    .replace(/\bai ml\b/gi, "AI/ML");
}

function humanizeTrack(value: string): string {
  const [discipline = "", track = ""] = value.split(" · ");
  return `${humanize(discipline)} · ${humanize(track)}`;
}
