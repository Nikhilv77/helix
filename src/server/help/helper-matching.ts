import type { PrismaService } from "../database/prisma.service";

/**
 * One person with enough evidence to help on the problem.
 *
 * Exact-question proof is strongest, but not mandatory: somebody may have
 * solved it on another platform. `qualificationScore` comes from the shared
 * evidence policy and can instead be backed by same-pattern results,
 * demonstrated interview performance, or a credible verified profile.
 */
export interface HelperCandidate {
  ownerId: string;
  /** Most recent relevant evidence. Fresher memory ranks higher. */
  completedAt: Date;
  /** Completions on other questions sharing this one's primary pattern. */
  patternCompletions: number;
  /** Completions across the whole bank, as a rough proxy for experience. */
  totalCompletions: number;
  /** Strength of the evidence lane that qualified them, from 0 to 1. */
  qualificationScore: number;
  /** Exact-question score when Trailgrad has one; 0 for profile-based helpers. */
  exactQuestionScore: number;
  /** Best score in the learner's requested language, or 0 when none exists. */
  languageScore: number;
}

export interface RankedHelper extends HelperCandidate {
  /** 0..1. Exposed so a ranking can be explained rather than just trusted. */
  score: number;
}

/**
 * Weights for the five signals that exist. They sum to 1 so the score stays
 * readable as a fraction.
 *
 * Qualification and recency are the strongest signals. Language is only a
 * ranking affinity: DSA competence transfers across languages, while matching
 * syntax can still make an explanation easier to follow.
 */
const QUALIFICATION_WEIGHT = 0.4;
const LANGUAGE_WEIGHT = 0.15;
const RECENCY_WEIGHT = 0.25;
const PATTERN_WEIGHT = 0.12;
const BREADTH_WEIGHT = 0.08;

/** Days after which recency counts for half. Roughly a revision cycle. */
const RECENCY_HALF_LIFE_DAYS = 21;

/** Where each count stops adding to the score. */
const PATTERN_SATURATION = 8;
const BREADTH_SATURATION = 25;

const DAY_MS = 86_400_000;

/**
 * Pure ranking, kept separate from the query so the judgement can be tested
 * without a database.
 */
export function rankCandidates(
  candidates: HelperCandidate[],
  now: Date = new Date()
): RankedHelper[] {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, now) }))
    .sort((a, b) =>
      b.score === a.score ? b.completedAt.getTime() - a.completedAt.getTime() : b.score - a.score
    );
}

export function scoreCandidate(candidate: HelperCandidate, now: Date = new Date()): number {
  const days = Math.max(0, (now.getTime() - candidate.completedAt.getTime()) / DAY_MS);
  const recency = Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS);
  const pattern = Math.min(1, candidate.patternCompletions / PATTERN_SATURATION);
  const breadth = Math.min(1, candidate.totalCompletions / BREADTH_SATURATION);

  return (
    QUALIFICATION_WEIGHT * Math.max(0, Math.min(1, candidate.qualificationScore)) +
    LANGUAGE_WEIGHT * Math.max(0, Math.min(1, candidate.languageScore)) +
    RECENCY_WEIGHT * recency +
    PATTERN_WEIGHT * pattern +
    BREADTH_WEIGHT * breadth
  );
}

interface CandidateRow {
  ownerId: string;
  completedAt: Date;
  patternCompletions: number;
  totalCompletions: number;
  qualificationScore: number;
  exactQuestionScore: number;
  languageScore: number;
}

export class HelperMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * People who could help with `questionSlug`, best first.
   *
   * Exact solvers normally rank first, but the candidate pool begins with
   * profiles rather than exact attempts. That is the important flexibility:
   * strong external/profile evidence gets a chance instead of disappearing
   * before ranking starts.
   */
  async findHelpers(
    questionSlug: string,
    learnerId: string,
    language: string
  ): Promise<RankedHelper[]> {
    const rows = await this.prisma.$queryRawUnsafe<CandidateRow[]>(
      `
      WITH target AS (
        SELECT "primaryPattern" FROM "DsaQuestion" WHERE "slug" = $1
      )
      SELECT profile."ownerId",
             COALESCE(signals."lastEvidenceAt", profile."resumeVerifiedAt", profile."updatedAt")
               AS "completedAt",
             signals."patternCompletions",
             signals."totalCompletions",
             eligibility.score AS "qualificationScore",
             signals."exactQuestionScore",
             signals."languageScore"
      FROM "CandidateProfile" profile
      CROSS JOIN target
      CROSS JOIN LATERAL (
        SELECT "helpHelperEligibilityScore"(
          profile."ownerId",
          $1,
          $3
        ) AS score
      ) AS eligibility
      CROSS JOIN LATERAL (
        SELECT
          COUNT(DISTINCT completed."dsaQuestionSlug") FILTER (
            WHERE completed_question."primaryPattern" = target."primaryPattern"
          )::int AS "patternCompletions",
          COUNT(DISTINCT completed."dsaQuestionSlug")::int AS "totalCompletions",
          COALESCE((
            SELECT MAX(exact."score")::float
            FROM "UserQuestionAttempt" exact
            WHERE exact."ownerId" = profile."ownerId"
              AND exact."dsaQuestionSlug" = $1
              AND exact."status" IN ('SUBMITTED', 'COMPLETED')
          ), 0) AS "exactQuestionScore",
          COALESCE((
            SELECT MAX(language_attempt."score")::float
            FROM "UserQuestionAttempt" language_attempt
            JOIN "DsaQuestion" language_question
              ON language_question."slug" = language_attempt."dsaQuestionSlug"
            WHERE language_attempt."ownerId" = profile."ownerId"
              AND language_attempt."status" = 'SUBMITTED'
              AND language_attempt."language" = $3
              AND (
                language_attempt."dsaQuestionSlug" = $1
                OR language_question."primaryPattern" = target."primaryPattern"
              )
          ), 0) AS "languageScore",
          MAX(completed."updatedAt") FILTER (
            WHERE completed_question."primaryPattern" = target."primaryPattern"
               OR completed."dsaQuestionSlug" = $1
          ) AS "lastEvidenceAt"
        FROM "UserQuestionAttempt" completed
        LEFT JOIN "DsaQuestion" completed_question
          ON completed_question."slug" = completed."dsaQuestionSlug"
        WHERE completed."ownerId" = profile."ownerId"
          AND completed."status" = 'COMPLETED'
      ) AS signals
      WHERE profile."ownerId" <> $2
        AND profile."helpNotificationsEnabled" = true
        AND (
          eligibility.score > 0
          OR "helpHelperSolvedQuestion"(profile."ownerId", $1)
        )
        AND NOT EXISTS (
        SELECT 1 FROM "HelpRequest" r
        WHERE r."learnerId" = profile."ownerId"
          AND (r."status" = 'CLAIMED'
            OR (r."status" = 'OPEN' AND r."expiresAt" > CURRENT_TIMESTAMP))
      )
      AND NOT EXISTS (
        SELECT 1 FROM "HelpRequest" helping
        WHERE helping."helperId" = profile."ownerId" AND helping."status" = 'CLAIMED'
      )
      -- Either direction. A block only filtering the blocker's view would leave
      -- the blocked person still able to claim their requests.
      AND NOT EXISTS (
        SELECT 1 FROM "HelpBlock" b
        WHERE (b."ownerId" = $2 AND b."blockedId" = profile."ownerId")
           OR (b."ownerId" = profile."ownerId" AND b."blockedId" = $2)
      )
      `,
      questionSlug,
      learnerId,
      language
    );

    return rankCandidates(rows);
  }

  /**
   * How many people could answer a request for this question, without ranking
   * them. Cheap enough to call before opening a request, so the UI can promise
   * "we'll notify someone" only when there is somebody to notify.
   */
  async countHelpers(questionSlug: string, learnerId: string, language: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `
      SELECT COUNT(*)::int AS count
      FROM "CandidateProfile" profile
      WHERE profile."ownerId" <> $2
        AND profile."helpNotificationsEnabled" = true
        AND (
          "helpHelperEligibilityScore"(profile."ownerId", $1, $3) > 0
          OR "helpHelperSolvedQuestion"(profile."ownerId", $1)
        )
        AND NOT EXISTS (
          SELECT 1 FROM "HelpRequest" r
          WHERE r."learnerId" = profile."ownerId"
            AND (r."status" = 'CLAIMED'
              OR (r."status" = 'OPEN' AND r."expiresAt" > CURRENT_TIMESTAMP))
        )
        AND NOT EXISTS (
          SELECT 1 FROM "HelpRequest" helping
          WHERE helping."helperId" = profile."ownerId" AND helping."status" = 'CLAIMED'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "HelpBlock" b
          WHERE (b."ownerId" = $2 AND b."blockedId" = profile."ownerId")
             OR (b."ownerId" = profile."ownerId" AND b."blockedId" = $2)
        )
      `,
      questionSlug,
      learnerId,
      language
    );

    return rows[0]?.count ?? 0;
  }
}
