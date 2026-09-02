import type { PrismaService } from "../database/prisma.service";

export const MIN_HELPER_ELIGIBILITY_SCORE = Number.EPSILON;

export interface EligibilityRequest {
  id: string;
  questionSlug: string;
  language: string;
}

interface ScoreRow {
  id?: string;
  score: number;
}

/**
 * Reads the shared database eligibility policy.
 *
 * The SQL function is also called inside the claim UPDATE, where it closes the
 * stale-page race. This adapter is for helpful preflight errors and batched
 * inbox filtering; it is never the final authority for a claim.
 */
export class HelperEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async score(helperId: string, questionSlug: string, language: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<ScoreRow[]>(
      `SELECT GREATEST(
         "helpHelperEligibilityScore"($1, $2, $3),
         CASE WHEN "helpHelperSolvedQuestion"($1, $2) THEN 1.0 ELSE 0.0 END
       ) AS score`,
      helperId,
      questionSlug,
      language
    );

    return normalizedScore(rows[0]?.score);
  }

  async scoresForRequests(
    helperId: string,
    requests: readonly EligibilityRequest[]
  ): Promise<Map<string, number>> {
    if (requests.length === 0) return new Map();

    const rows = await this.prisma.$queryRawUnsafe<ScoreRow[]>(
      `
        SELECT candidate.id,
               GREATEST(
                 "helpHelperEligibilityScore"($1, candidate.slug, candidate.language),
                 CASE
                   WHEN "helpHelperSolvedQuestion"($1, candidate.slug) THEN 1.0
                   ELSE 0.0
                 END
               ) AS score
        FROM jsonb_to_recordset($2::jsonb)
          AS candidate(id TEXT, slug TEXT, language TEXT)
      `,
      helperId,
      JSON.stringify(
        requests.map((request) => ({
          id: request.id,
          slug: request.questionSlug,
          language: request.language
        }))
      )
    );

    return new Map(
      rows
        .map((row) => [row.id, normalizedScore(row.score)] as const)
        .filter((entry): entry is readonly [string, number] => Boolean(entry[0]))
    );
  }
}

function normalizedScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
