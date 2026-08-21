import { formatShortDate, roundShortLabel } from "@/lib/shared/labels";
import {
  evidenceLevel,
  type ReportCompetencyRow,
  type ReportGap,
  type ReportMatrix,
  type ReportRoundRow,
  type ReportRoundTypeRow,
  type ReportTrendPoint,
  type ReportsOverview
} from "@/lib/reports/reports";
import type { InterviewReport, RoundType } from "@/lib/shared/types";

/** Competencies wide enough to read across, before the matrix gets unwieldy. */
const MATRIX_ROWS = 10;
const MATRIX_ROUNDS = 10;
const RECURRING_GAPS = 4;
/** Readiness follows recent form, not your whole history. */
const READINESS_WINDOW = 5;

/**
 * Folds a list of single-round reports into the cross-round view.
 *
 * Pure on purpose: the interesting logic here is the aggregation, and it is
 * worth testing without a database. `reports` may arrive in any order.
 */
export function createReportsOverview(
  reports: InterviewReport[],
  now = Date.now()
): ReportsOverview {
  // Chronological throughout, so "first" and "latest" mean what they say.
  const ordered = [...reports].sort((left, right) => left.startedAt - right.startedAt);
  // An abandoned round has no evidence, only a zero. Including it would read as
  // a crash in your scores rather than a session you closed.
  const scored = ordered.filter((report) => report.answerCount > 0);

  const rounds = ordered.map(toRoundRow).reverse();
  const trend = scored.map((report, index): ReportTrendPoint => ({
    sessionId: report.sessionId,
    index: index + 1,
    label: formatShortDate(report.startedAt),
    score: report.summary.evidenceScore,
    roundType: report.setup.roundType,
    startedAt: report.startedAt,
    href: `/sessions/${report.sessionId}`
  }));

  const competencies = buildCompetencies(scored);
  const scores = scored.map((report) => report.summary.evidenceScore);
  const latestScore = scores.at(-1) ?? null;
  const firstScore = scores[0] ?? null;
  const recent = scores.slice(-READINESS_WINDOW);

  const bestRound = scored.reduce<InterviewReport | null>(
    (best, report) =>
      !best || report.summary.evidenceScore > best.summary.evidenceScore ? report : best,
    null
  );
  const latestRound = scored.at(-1) ?? null;

  return {
    generatedAt: now,
    totalRounds: ordered.length,
    completedRounds: ordered.filter((report) => report.status === "completed").length,
    inProgressRounds: ordered.filter((report) => report.status === "in_progress").length,
    scoredRounds: scored.length,
    questionsAnswered: sum(ordered, (report) => report.questionsCovered),
    questionsAsked: sum(ordered, (report) => report.questionCount),
    totalMinutes: Math.round(sum(ordered, (report) => report.durationMs) / 60_000),
    readinessScore: recent.length ? Math.round(mean(recent)) : null,
    latestScore,
    firstScore,
    bestScore: scores.length ? Math.max(...scores) : null,
    scoreDelta:
      latestScore !== null && firstScore !== null && scores.length > 1
        ? latestScore - firstScore
        : null,
    trend,
    competencies,
    matrix: buildMatrix(scored, competencies),
    roundTypes: buildRoundTypes(scored),
    pressure: buildPressure(scored),
    recurringGaps: buildRecurringGaps(competencies, scored),
    rounds,
    latest: latestRound ? toRoundRow(latestRound) : null,
    best: bestRound ? toRoundRow(bestRound) : null
  };
}

function toRoundRow(report: InterviewReport): ReportRoundRow {
  const evidenced = report.competencies.filter((item) => item.answered).length;

  return {
    sessionId: report.sessionId,
    status: report.status,
    role: report.setup.role,
    level: report.setup.level,
    roundType: report.setup.roundType,
    intensity: report.setup.intensity,
    context: report.setup.context,
    templateTitle: report.setup.templateTitle ?? null,
    startedAt: report.startedAt,
    durationMs: report.durationMs,
    questionCount: report.questionCount,
    questionsCovered: report.questionsCovered,
    answerCount: report.answerCount,
    evidenceScore: report.answerCount > 0 ? report.summary.evidenceScore : null,
    strongest: report.summary.strongest,
    recommendedFocus: report.summary.recommendedFocus,
    nextStep: report.summary.nextStep,
    competencyCount: report.competencies.length,
    evidencedCount: evidenced,
    probes: report.interaction.probes,
    challenges: report.interaction.challenges,
    interruptions: report.interaction.interruptions,
    codeSubmitted: report.codeExercise ? report.codeExercise.submitted : null,
    href:
      report.status === "in_progress"
        ? `/interview/voice?session=${report.sessionId}`
        : `/sessions/${report.sessionId}`
  };
}

interface CompetencyAccumulator {
  label: string;
  scores: number[];
  rounds: number;
  answered: number;
  unanswered: number;
  gap: string | null;
  nextStep: string | null;
}

/**
 * One row per competency across every scored round. A round that asks about
 * the same competency twice contributes its mean, not two votes.
 */
function buildCompetencies(scored: InterviewReport[]): ReportCompetencyRow[] {
  const accumulators = new Map<string, CompetencyAccumulator>();

  for (const report of scored) {
    for (const [key, group] of groupRoundCompetencies(report)) {
      const accumulator = accumulators.get(key) ?? {
        label: group.label,
        scores: [],
        rounds: 0,
        answered: 0,
        unanswered: 0,
        gap: null,
        nextStep: null
      };

      accumulator.rounds += 1;
      accumulator.answered += group.answered;
      accumulator.unanswered += group.asked - group.answered;
      if (group.scores.length) accumulator.scores.push(Math.round(mean(group.scores)));
      // Reports arrive oldest first, so the last write is the newest advice.
      if (group.gap) accumulator.gap = group.gap;
      if (group.nextStep) accumulator.nextStep = group.nextStep;

      accumulators.set(key, accumulator);
    }
  }

  return [...accumulators.values()]
    .map((accumulator): ReportCompetencyRow => {
      const average = accumulator.scores.length ? Math.round(mean(accumulator.scores)) : 0;
      const latest = accumulator.scores.at(-1) ?? 0;
      const first = accumulator.scores[0] ?? 0;

      return {
        label: accumulator.label,
        averageScore: average,
        latestScore: latest,
        firstScore: first,
        delta: accumulator.scores.length > 1 ? latest - first : 0,
        rounds: accumulator.rounds,
        answered: accumulator.answered,
        unanswered: accumulator.unanswered,
        level: accumulator.answered === 0 ? "missing" : evidenceLevel(average),
        gap: accumulator.gap,
        nextStep: accumulator.nextStep
      };
    })
    .sort(
      (left, right) =>
        right.rounds - left.rounds ||
        left.averageScore - right.averageScore ||
        left.label.localeCompare(right.label)
    );
}

interface RoundCompetencyGroup {
  label: string;
  scores: number[];
  asked: number;
  answered: number;
  gap: string | null;
  nextStep: string | null;
}

function groupRoundCompetencies(report: InterviewReport): Map<string, RoundCompetencyGroup> {
  const groups = new Map<string, RoundCompetencyGroup>();

  for (const item of report.competencies) {
    const key = normaliseCompetency(item.label);
    const group = groups.get(key) ?? {
      label: item.label,
      scores: [],
      asked: 0,
      answered: 0,
      gap: null,
      nextStep: null
    };

    group.asked += 1;
    if (item.answered) {
      group.answered += 1;
      group.scores.push(item.evidenceScore);
      group.gap = item.gap;
      group.nextStep = item.nextStep;
    }

    groups.set(key, group);
  }

  return groups;
}

/** Competencies down the side, rounds across the top, newest column last. */
function buildMatrix(scored: InterviewReport[], competencies: ReportCompetencyRow[]): ReportMatrix {
  const matrixRounds = scored.slice(-MATRIX_ROUNDS);
  const grouped = matrixRounds.map(groupRoundCompetencies);
  const rows = competencies.slice(0, MATRIX_ROWS).map((competency) => {
    const key = normaliseCompetency(competency.label);
    return {
      label: competency.label,
      cells: grouped.map((groups) => {
        const group = groups.get(key);
        if (!group) return { score: null, answered: false };
        return {
          score: group.scores.length ? Math.round(mean(group.scores)) : null,
          answered: group.answered > 0
        };
      })
    };
  });

  return {
    rounds: matrixRounds.map((report) => ({
      sessionId: report.sessionId,
      label: formatShortDate(report.startedAt),
      roundType: report.setup.roundType,
      href: `/sessions/${report.sessionId}`
    })),
    rows
  };
}

function buildRoundTypes(scored: InterviewReport[]): ReportRoundTypeRow[] {
  const groups = new Map<RoundType, number[]>();

  for (const report of scored) {
    const scores = groups.get(report.setup.roundType) ?? [];
    scores.push(report.summary.evidenceScore);
    groups.set(report.setup.roundType, scores);
  }

  return [...groups.entries()]
    .map(([roundType, scores]) => ({
      roundType,
      label: roundShortLabel(roundType),
      rounds: scores.length,
      averageScore: Math.round(mean(scores))
    }))
    .sort((left, right) => right.rounds - left.rounds || right.averageScore - left.averageScore);
}

function buildPressure(scored: InterviewReport[]): ReportsOverview["pressure"] {
  const probes = sum(scored, (report) => report.interaction.probes);
  const challenges = sum(scored, (report) => report.interaction.challenges);
  const clarifications = sum(scored, (report) => report.interaction.clarifications);
  const interruptions = sum(scored, (report) => report.interaction.interruptions);
  const followUps = probes + challenges + clarifications;

  return {
    probes,
    challenges,
    clarifications,
    interruptions,
    perRound: scored.length ? Math.round((followUps / scored.length) * 10) / 10 : 0
  };
}

/**
 * The competencies that keep scoring low. Ordered weakest first, and only
 * from competencies you actually answered — never answering something is a
 * coverage problem, not a recurring gap.
 */
function buildRecurringGaps(
  competencies: ReportCompetencyRow[],
  scored: InterviewReport[]
): ReportGap[] {
  const latest = scored.at(-1);

  return competencies
    .filter((competency) => competency.answered > 0 && competency.averageScore < 75)
    .sort((left, right) => left.averageScore - right.averageScore || right.rounds - left.rounds)
    .slice(0, RECURRING_GAPS)
    .map((competency) => ({
      label: competency.label,
      occurrences: competency.rounds,
      averageScore: competency.averageScore,
      nextStep:
        competency.nextStep ??
        "Retry this question and give one concrete example from your own work.",
      practiceHref: practiceHref(competency.label, latest)
    }));
}

function practiceHref(focus: string, latest: InterviewReport | undefined): string {
  const params = new URLSearchParams({ focus });
  if (latest) {
    params.set("role", latest.setup.role);
    params.set("level", latest.setup.level);
  }
  return `/interview?${params.toString()}`;
}

function normaliseCompetency(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
