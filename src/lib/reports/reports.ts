import type { InterviewHistoryStatus, Level, Role, RoundType } from "@/lib/shared/types";

/**
 * The read model behind /reports.
 *
 * A single report answers "how did that round go?". This one answers the
 * question you can only ask across rounds: is the evidence getting stronger,
 * and which competency keeps costing you? Every number is computed from
 * scored rounds — rounds where you actually answered something — so an
 * abandoned session cannot drag the trend down.
 */
export interface ReportsOverview {
  generatedAt: number;
  /** Every round, including abandoned ones. */
  totalRounds: number;
  completedRounds: number;
  inProgressRounds: number;
  /** Rounds with at least one answer; the basis for every score below. */
  scoredRounds: number;
  questionsAnswered: number;
  questionsAsked: number;
  totalMinutes: number;
  /** Mean of the five most recent scored rounds. Null before the first. */
  readinessScore: number | null;
  latestScore: number | null;
  firstScore: number | null;
  bestScore: number | null;
  /** latestScore − firstScore, once there are at least two scored rounds. */
  scoreDelta: number | null;
  trend: ReportTrendPoint[];
  competencies: ReportCompetencyRow[];
  matrix: ReportMatrix;
  roundTypes: ReportRoundTypeRow[];
  pressure: ReportPressure;
  recurringGaps: ReportGap[];
  rounds: ReportRoundRow[];
  latest: ReportRoundRow | null;
  best: ReportRoundRow | null;
}

export interface ReportTrendPoint {
  sessionId: string;
  /** 1-based position in chronological order. */
  index: number;
  label: string;
  score: number;
  roundType: RoundType;
  startedAt: number;
  href: string;
}

export type ReportEvidenceLevel = "strong" | "developing" | "missing";

export interface ReportCompetencyRow {
  label: string;
  averageScore: number;
  latestScore: number;
  firstScore: number;
  /** latestScore − firstScore across the rounds that evidenced it. */
  delta: number;
  /** Rounds that asked about this competency. */
  rounds: number;
  answered: number;
  unanswered: number;
  level: ReportEvidenceLevel;
  gap: string | null;
  nextStep: string | null;
}

export interface ReportMatrixRound {
  sessionId: string;
  label: string;
  roundType: RoundType;
  href: string;
}

export interface ReportMatrixCell {
  /** Null when the round never asked about this competency. */
  score: number | null;
  answered: boolean;
}

export interface ReportMatrix {
  rounds: ReportMatrixRound[];
  rows: Array<{ label: string; cells: ReportMatrixCell[] }>;
}

export interface ReportRoundTypeRow {
  roundType: RoundType;
  label: string;
  rounds: number;
  averageScore: number;
}

export interface ReportPressure {
  probes: number;
  challenges: number;
  clarifications: number;
  interruptions: number;
  /** Follow-ups per scored round, to one decimal. */
  perRound: number;
}

export interface ReportGap {
  label: string;
  occurrences: number;
  averageScore: number;
  nextStep: string;
  practiceHref: string;
}

export interface ReportRoundRow {
  sessionId: string;
  status: InterviewHistoryStatus;
  role: Role;
  level: Level;
  roundType: RoundType;
  intensity: string;
  context: string;
  templateTitle: string | null;
  startedAt: number;
  durationMs: number;
  questionCount: number;
  questionsCovered: number;
  answerCount: number;
  /** Null when the round was abandoned before any answer. */
  evidenceScore: number | null;
  strongest: string | null;
  recommendedFocus: string | null;
  nextStep: string;
  competencyCount: number;
  evidencedCount: number;
  probes: number;
  challenges: number;
  interruptions: number;
  codeSubmitted: boolean | null;
  /** The report, or the live room when the round is still open. */
  href: string;
}

export function evidenceLevel(score: number): ReportEvidenceLevel {
  if (score >= 75) return "strong";
  if (score >= 45) return "developing";
  return "missing";
}
