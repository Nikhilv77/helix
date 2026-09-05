import { DsaPracticeBlockStatus, Prisma } from "@prisma/client";
import {
  parseDsaBlockAssessmentSnapshot,
  type DsaBlockAssessmentSnapshot
} from "@/lib/dsa/block-assessment";
import {
  DSA_BLOCK_ASSESSMENT_REPORT_VERSION,
  DSA_BLOCK_ASSESSMENT_SCORING_VERSION,
  parseDsaBlockAssessmentReport,
  type DsaBlockAssessmentMetric,
  type DsaBlockAssessmentReport
} from "@/lib/dsa/block-assessment-report";
import type { InterviewState } from "@/server/interview/types";
import type { PrismaService } from "@/server/database/prisma.service";
import { fencedCodeFingerprint } from "@/server/interview/code-fingerprint";

const METRICS: DsaBlockAssessmentMetric[] = [
  "pattern-recognition",
  "correctness-edge-cases",
  "efficiency",
  "code-quality",
  "communication"
];

export class DsaBlockAssessmentFinalizationError extends Error {
  constructor(
    readonly code:
      | "ASSESSMENT_NOT_FOUND"
      | "SESSION_NOT_TERMINAL"
      | "SESSION_INCOMPLETE"
      | "SESSION_MISMATCH"
      | "SNAPSHOT_INVALID",
    message: string
  ) {
    super(message);
    this.name = "DsaBlockAssessmentFinalizationError";
  }
}

/** Finalizes only after the interview state is terminal; it is safe to retry. */
export class DsaBlockAssessmentFinalizationService {
  constructor(private readonly prisma: PrismaService) {}

  async finalizeOwned(
    ownerId: string,
    sessionId: string,
    now = Date.now()
  ): Promise<DsaBlockAssessmentReport> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        const assessment = await tx.dsaBlockAssessment.findFirst({
          where: { ownerId, interviewSessionId: sessionId },
          select: finalizationSelect
        });
        if (!assessment)
          throw new DsaBlockAssessmentFinalizationError(
            "ASSESSMENT_NOT_FOUND",
            "Assessment not found."
          );
        if (assessment.reportSnapshot)
          return parseDsaBlockAssessmentReport(assessment.reportSnapshot);
        if (!assessment.block.isCurrent) {
          throw new DsaBlockAssessmentFinalizationError(
            "SESSION_MISMATCH",
            "Assessment block is no longer current."
          );
        }
        const session = await tx.interviewSession.findFirst({
          where: { id: sessionId, ownerId },
          select: { state: true }
        });
        const state = session?.state as unknown as InterviewState | undefined;
        if (
          !state ||
          state.id !== sessionId ||
          state.setup.dsaBlockAssessment?.assessmentId !== assessment.id
        ) {
          throw new DsaBlockAssessmentFinalizationError(
            "SESSION_MISMATCH",
            "Session does not belong to this assessment."
          );
        }
        if (state.phase !== "done") {
          throw new DsaBlockAssessmentFinalizationError(
            "SESSION_NOT_TERMINAL",
            "Assessment session is not complete."
          );
        }
        if (!hasTerminalEvidenceForEveryQuestion(state)) {
          throw new DsaBlockAssessmentFinalizationError(
            "SESSION_INCOMPLETE",
            "Every assessment prompt must be answered or explicitly skipped."
          );
        }
        if (!assessment.assessmentSnapshot) {
          throw new DsaBlockAssessmentFinalizationError(
            "SNAPSHOT_INVALID",
            "Assessment snapshot is unavailable."
          );
        }
        const snapshot = parseDsaBlockAssessmentSnapshot(assessment.assessmentSnapshot);
        if (snapshot.blockId !== assessment.blockId) {
          throw new DsaBlockAssessmentFinalizationError(
            "SNAPSHOT_INVALID",
            "Assessment snapshot does not match its block."
          );
        }
        const report = scoreBlockAssessment({ snapshot, assessmentId: assessment.id, state, now });
        await tx.dsaBlockAssessment.update({
          where: { id: assessment.id },
          data: { reportSnapshot: json(report), completedAt: new Date(now) }
        });
        await tx.dsaPracticeBlock.update({
          where: { id: assessment.blockId },
          data: { status: DsaPracticeBlockStatus.ASSESSED, assessedAt: new Date(now) }
        });
        return report;
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  /** Used only after the interview route has already authorized an agent capability for this exact session. */
  async finalizeBySession(
    sessionId: string,
    now = Date.now()
  ): Promise<DsaBlockAssessmentReport | null> {
    const assessment = await this.prisma.dsaBlockAssessment.findFirst({
      where: { interviewSessionId: sessionId },
      select: { ownerId: true }
    });
    return assessment ? this.finalizeOwned(assessment.ownerId, sessionId, now) : null;
  }

  /** Recovery for a failed deferred finalizer when the candidate next opens practice. */
  async recoverCurrent(
    ownerId: string,
    now = Date.now()
  ): Promise<DsaBlockAssessmentReport | null> {
    const pending = await this.prisma.dsaBlockAssessment.findFirst({
      where: {
        ownerId,
        block: { isCurrent: true, status: DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS },
        interviewSessionId: { not: null },
        reportSnapshot: { equals: Prisma.DbNull }
      },
      select: { interviewSessionId: true }
    });
    if (!pending?.interviewSessionId) return null;
    const session = await this.prisma.interviewSession.findFirst({
      where: { id: pending.interviewSessionId, ownerId },
      select: { state: true }
    });
    const state = session?.state as { phase?: unknown } | undefined;
    if (state?.phase !== "done") return null;
    return this.finalizeOwned(ownerId, pending.interviewSessionId, now);
  }
}

const finalizationSelect = {
  id: true,
  ownerId: true,
  blockId: true,
  assessmentSnapshot: true,
  reportSnapshot: true,
  block: { select: { isCurrent: true } }
} satisfies Prisma.DsaBlockAssessmentSelect;

export function scoreBlockAssessment(input: {
  snapshot: DsaBlockAssessmentSnapshot;
  assessmentId: string;
  state: InterviewState;
  now: number;
}): DsaBlockAssessmentReport {
  const review: DsaBlockAssessmentReport["evidence"]["review"] = [];
  const transfer: DsaBlockAssessmentReport["evidence"]["transfer"] = [];
  const byPattern: DsaBlockAssessmentReport["evidence"]["byPattern"] = {};
  const perMetric = Object.fromEntries(METRICS.map((metric) => [metric, [] as number[]])) as Record<
    DsaBlockAssessmentMetric,
    number[]
  >;
  const answeredIndexes = new Set([
    ...input.state.turns
      .filter((turn) => turn.speaker === "user" && !turn.skipped)
      .map((turn) => turn.questionIndex)
      .filter((index): index is number => index !== undefined),
    ...input.state.turns
      .map((turn) => turn.gradedQuestionIndex)
      .filter((index): index is number => index !== undefined)
  ]);
  const skippedIndexes = new Set(
    input.state.turns
      .filter((turn) => turn.speaker === "user" && turn.skipped)
      .map((turn) => turn.questionIndex)
      .filter((index): index is number => index !== undefined)
  );
  skippedIndexes.forEach((index) => answeredIndexes.delete(index));

  input.snapshot.reviewItems.forEach((item, index) => {
    const graded = input.state.turns.find(
      (turn) =>
        turn.speaker === "agent" &&
        turn.gradedQuestionIndex === index &&
        typeof turn.correct === "boolean"
    );
    const score = graded?.correct ? 100 : 0;
    const status: "grounded" | "unanswered" = graded ? "grounded" : "unanswered";
    const evidence = {
      questionIndex: index,
      kind: graded ? ("review-mcq" as const) : ("unanswered" as const),
      score,
      status,
      reference: `review:${item.id}`
    };
    review.push(evidence);
    perMetric[item.metric].push(score);
    (byPattern[item.sourceQuestionPattern] ??= []).push(evidence);
  });

  input.snapshot.transferQuestions.forEach((question, offset) => {
    const index = input.snapshot.reviewItems.length + offset;
    const planned = input.state.plan[index];
    const answerTurn = latestAnswerTurn(input.state, index);
    const skipped = answerTurn?.skipped === true;
    const answer = skipped ? null : (answerTurn?.text ?? null);
    const execution = input.state.codeExecutions?.[String(index)];
    const matchingRun =
      execution && answer && execution.codeHash
        ? execution.codeHash === codeHashFromAnswer(answer)
        : false;
    const correctness =
      matchingRun && execution
        ? execution.testCount > 0
          ? Math.round((execution.testsPassed / execution.testCount) * 100)
          : execution.accepted
            ? 100
            : 0
        : 0;
    const executionStatus = skipped
      ? ("skipped" as const)
      : !answer
        ? ("unanswered" as const)
        : matchingRun
          ? ("grounded" as const)
          : execution
            ? ("stale-execution" as const)
            : ("insufficient" as const);
    const codeEvidence = {
      questionIndex: index,
      kind: skipped
        ? ("skipped" as const)
        : answer
          ? ("transfer-code" as const)
          : ("unanswered" as const),
      score: correctness,
      status: executionStatus,
      reference: `transfer:${question.slug}:execution`
    };
    transfer.push(codeEvidence);
    perMetric["correctness-edge-cases"].push(correctness);
    (byPattern[question.primaryPattern] ??= []).push(codeEvidence);
    for (const metric of METRICS.filter((metric) => metric !== "correctness-edge-cases")) {
      const evaluationScore = rubricScore(input.state, index, metric);
      const evidence = {
        questionIndex: index,
        kind: skipped
          ? ("skipped" as const)
          : answer
            ? ("transfer-evaluation" as const)
            : ("unanswered" as const),
        score: evaluationScore,
        status: skipped
          ? ("skipped" as const)
          : answer && evaluationScore > 0
            ? ("grounded" as const)
            : answer
              ? ("insufficient" as const)
              : ("unanswered" as const),
        reference: `transfer:${question.slug}:${metric}`
      };
      transfer.push(evidence);
      perMetric[metric].push(evaluationScore);
      (byPattern[question.primaryPattern] ??= []).push(evidence);
    }
    // Explicit zeros ensure a skipped transfer cannot vanish from any metric.
    if (!planned) throw new Error("Frozen assessment session plan is incomplete.");
  });
  const metrics = Object.fromEntries(
    METRICS.map((metric) => [metric, average(perMetric[metric])])
  ) as DsaBlockAssessmentReport["metrics"];
  const rawOverall = Math.round(
    metrics["correctness-edge-cases"] * 0.3 +
      metrics["pattern-recognition"] * 0.2 +
      metrics.efficiency * 0.2 +
      metrics["code-quality"] * 0.15 +
      metrics.communication * 0.15
  );
  const overall = metrics["correctness-edge-cases"] < 50 ? Math.min(59, rawOverall) : rawOverall;
  const ordered = [...METRICS].sort((a, b) => metrics[a] - metrics[b] || a.localeCompare(b));
  const answered = answeredIndexes.size;
  const skipped = skippedIndexes.size;
  const total = input.state.plan.length;
  const weakPatterns = Object.entries(byPattern)
    .filter(([, evidence]) => average(evidence.map((item) => item.score)) < 50)
    .map(([pattern]) => pattern);
  const strongPatterns = Object.entries(byPattern)
    .filter(([, evidence]) => average(evidence.map((item) => item.score)) >= 75)
    .map(([pattern]) => pattern);
  return {
    reportVersion: DSA_BLOCK_ASSESSMENT_REPORT_VERSION,
    scoringVersion: DSA_BLOCK_ASSESSMENT_SCORING_VERSION,
    rubricVersion: input.snapshot.rubricVersion,
    blockId: input.snapshot.blockId,
    assessmentId: input.assessmentId,
    sessionId: input.state.id,
    completedAt: new Date(input.now).toISOString(),
    durationMs: Math.max(0, input.now - input.state.startedAt),
    completion: { answered, skipped, total, partial: skipped > 0 || answered < total },
    metrics,
    overall,
    evidence: { review, transfer, byPattern },
    strengths: METRICS.filter((metric) => metrics[metric] >= 75).map(
      (metric) => `${metric} is a demonstrated strength.`
    ),
    gaps: METRICS.filter((metric) => metrics[metric] < 60).map(
      (metric) => `${metric} needs more evidence and practice.`
    ),
    teacherSummary: `Completed ${answered} of ${total} assessment prompts${skipped ? ` and skipped ${skipped}` : ""} with an overall score of ${overall}.`,
    nextRecommendationSignals: {
      weakestMetric: ordered[0]!,
      strongestMetric: ordered.at(-1)!,
      weakPatterns,
      strongPatterns,
      evidencePrecedence: "assessment-complements-verified-practice"
    }
  };
}

function latestAnswerTurn(state: InterviewState, index: number) {
  return (
    state.turns.filter((turn) => turn.speaker === "user" && turn.questionIndex === index).at(-1) ??
    null
  );
}
function hasTerminalEvidenceForEveryQuestion(state: InterviewState): boolean {
  const terminalIndexes = new Set([
    ...state.turns
      .filter((turn) => turn.speaker === "user")
      .map((turn) => turn.questionIndex)
      .filter((index): index is number => index !== undefined),
    ...state.turns
      .map((turn) => turn.gradedQuestionIndex)
      .filter((index): index is number => index !== undefined)
  ]);
  return state.plan.every((_question, index) => terminalIndexes.has(index));
}
function codeHashFromAnswer(answer: string): string | null {
  return fencedCodeFingerprint(answer);
}
function rubricScore(
  state: InterviewState,
  index: number,
  metric: DsaBlockAssessmentMetric
): number {
  return (
    state.questionEvaluations?.[String(index)]?.rubricScores.find(
      (score) => score.rubricKey === metric
    )?.score ?? 0
  );
}
function average(values: number[]): number {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
async function lockOwner(tx: Prisma.TransactionClient, ownerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dsa-block-finalize:${ownerId}`}))`;
}
