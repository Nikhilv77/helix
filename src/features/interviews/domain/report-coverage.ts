/**
 * How much of a round the candidate answered. A human interviewer does not
 * grade a round on its best answer alone: a question the candidate declined,
 * or never reached because they ended early, is missing evidence. Questions
 * the round itself skipped for time are not held against them.
 */
export interface ReportCoverage {
  /** Questions with an answer. */
  answered: number;
  /** Questions that count toward the score. */
  counted: number;
}

export function coverageAdjustedScore(
  score: number,
  coverage: ReportCoverage | null | undefined
): number {
  if (!coverage || coverage.counted <= 0 || coverage.answered >= coverage.counted) return score;
  return Math.round((score * coverage.answered) / coverage.counted);
}
