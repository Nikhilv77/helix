import { createHash } from "node:crypto";
import {
  AppliedEngineeringAssessmentStatus,
  AppliedEngineeringBlockStatus,
  AppliedEngineeringQuestionStatus,
  AppliedEngineeringIncidentProgressStatus,
  Prisma
} from "@prisma/client";
import {
  appliedEngineeringAssessmentReportSchema,
  appliedEngineeringSafeTranscriptSchema,
  publicAppliedEngineeringAssessmentSnapshot
} from "@/lib/practice/applied-engineering/assessment-contracts";
import {
  publicAppliedEngineeringConfirmedFocus,
  appliedEngineeringIncidentSelectionSchema
} from "@/lib/practice/applied-engineering/focus-ranking-contracts";
import {
  appliedEngineeringAttemptFeedbackSchema,
  appliedEngineeringAttemptInputSchema,
  appliedEngineeringAttemptWorkSchema,
  appliedEngineeringAuthorizedAnswerSchema,
  appliedEngineeringDraftWorkSchema,
  appliedEngineeringLearnInputSchema,
  appliedEngineeringPublicRunResultSchema,
  appliedEngineeringRevealHintInputSchema,
  appliedEngineeringRunInputSchema,
  appliedEngineeringSaveDraftInputSchema,
  type AppliedEngineeringAttemptWork,
  type AppliedEngineeringDraftWork
} from "@/lib/practice/applied-engineering/practice-contracts";
import {
  appliedEngineeringQuestionSchema,
  publicAppliedEngineeringQuestionSchema,
  revealAppliedEngineeringHint
} from "@/lib/practice/applied-engineering/question-contracts";
import { selectedAppliedEngineeringIncidentSchema } from "@/lib/practice/applied-engineering/incident-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import { codeFingerprint } from "@/server/interview/code-fingerprint";
import { buildAppliedEngineeringAssessmentSnapshot } from "./assessment-blueprint";
import type { AppliedEngineeringAttemptEvaluator } from "./attempt-evaluator";
import type { AppliedEngineeringRunnerService, AppliedEngineeringRunResult } from "./runner.service";

const questionReadSelect = {
  id: true,
  blockId: true,
  ownerId: true,
  order: true,
  questionKey: true,
  contentVersion: true,
  contentFingerprint: true,
  status: true,
  publicSnapshot: true,
  privateSnapshot: true,
  completedAt: true,
  learnedAt: true,
  updatedAt: true,
  block: { select: { id: true, isCurrent: true, status: true } },
  state: { select: { draft: true, revealedHintCount: true, updatedAt: true } },
  attempts: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, requestId: true, workFingerprint: true, answerSnapshot: true, evaluationSnapshot: true, verificationStatus: true, score: true, createdAt: true }
  },
  codeRuns: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, requestId: true, codeFingerprint: true, code: true, passed: true, resultSnapshot: true, createdAt: true }
  }
} satisfies Prisma.AppliedEngineeringBlockQuestionSelect;

const blockReadSelect = {
  id: true,
  ordinal: true,
  isCurrent: true,
  status: true,
  contentFingerprint: true,
  preparedAt: true,
  assessmentReadyAt: true,
  assessedAt: true,
  selectionSnapshot: true,
  incidentSnapshot: true,
  focusRevision: { select: { focusSnapshot: true } },
  questions: { orderBy: { order: "asc" as const }, select: questionReadSelect },
  assessment: {
    select: {
      id: true,
      status: true,
      assessmentSnapshot: true,
      readyAt: true,
      startedAt: true,
      completedAt: true,
      report: { select: { reportSnapshot: true, transcriptSnapshot: true } }
    }
  }
} satisfies Prisma.AppliedEngineeringBlockSelect;

type QuestionRead = Prisma.AppliedEngineeringBlockQuestionGetPayload<{ select: typeof questionReadSelect }>;
type BlockRead = Prisma.AppliedEngineeringBlockGetPayload<{ select: typeof blockReadSelect }>;

export class AppliedEngineeringPracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: Pick<AppliedEngineeringRunnerService, "run">,
    private readonly evaluator: Pick<AppliedEngineeringAttemptEvaluator, "evaluate">,
    private readonly now: () => Date = () => new Date()
  ) {}

  async current(ownerId: string) {
    const block = await this.prisma.appliedEngineeringBlock.findFirst({ where: { ownerId, isCurrent: true }, select: blockReadSelect });
    return block ? publicBlock(block) : null;
  }

  async historyBlock(ownerId: string, blockId: string) {
    const block = await this.prisma.appliedEngineeringBlock.findFirst({ where: { id: blockId, ownerId }, select: blockReadSelect });
    if (!block) throw new NotFoundErrorException("APPLIED_ENGINEERING_BLOCK_NOT_FOUND", "Applied Engineering incident block not found.");
    return publicBlock(block);
  }

  async question(ownerId: string, questionId: string) {
    return publicQuestion(await this.findQuestion(ownerId, questionId));
  }

  async saveDraft(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringSaveDraftInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const question = await mutableQuestion(tx, ownerId, input.questionId);
      assertWorkMatchesQuestion(question.privateSnapshot, input.draft);
      await tx.appliedEngineeringQuestionState.upsert({
        where: { blockQuestionId_ownerId: { blockQuestionId: input.questionId, ownerId } },
        create: { blockQuestionId: input.questionId, ownerId, draft: input.draft === null ? Prisma.DbNull : toJson(input.draft) },
        update: { draft: input.draft === null ? Prisma.DbNull : toJson(input.draft) }
      });
    }, transactionOptions);
    return this.question(ownerId, input.questionId);
  }

  async revealHint(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringRevealHintInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const question = await mutableQuestion(tx, ownerId, input.questionId);
      const state = await tx.appliedEngineeringQuestionState.findUnique({ where: { blockQuestionId_ownerId: { blockQuestionId: input.questionId, ownerId } }, select: { revealedHintCount: true } });
      const current = state?.revealedHintCount ?? 0;
      if (input.hintNumber > current + 1) throw new ConflictErrorException("APPLIED_ENGINEERING_HINT_OUT_OF_ORDER", "Reveal Applied Engineering hints in order.");
      if (input.hintNumber > current) {
        await tx.appliedEngineeringQuestionState.upsert({
          where: { blockQuestionId_ownerId: { blockQuestionId: input.questionId, ownerId } },
          create: { blockQuestionId: input.questionId, ownerId, revealedHintCount: input.hintNumber },
          update: { revealedHintCount: input.hintNumber }
        });
      }
      appliedEngineeringQuestionSchema.parse(question.privateSnapshot);
    }, transactionOptions);
    return this.question(ownerId, input.questionId);
  }

  async runCode(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringRunInputSchema.parse(rawInput);
    const fingerprint = codeFingerprint(input.code);
    const replay = await this.prisma.appliedEngineeringCodeRun.findUnique({ where: { ownerId_requestId: { ownerId, requestId: input.requestId } }, select: { id: true, blockQuestionId: true, codeFingerprint: true, resultSnapshot: true, createdAt: true } });
    if (replay) return replayRun(replay, input.questionId, fingerprint);
    const question = await this.findMutableQuestion(ownerId, input.questionId);
    const frozen = appliedEngineeringQuestionSchema.parse(question.privateSnapshot);
    assertWorkMatchesQuestion(frozen, { kind: "code", code: input.code });
    let result: AppliedEngineeringRunResult;
    try {
      result = await this.runner.run(frozen, input.code);
    } catch (error) {
      throw new ServiceUnavailableErrorException("APPLIED_ENGINEERING_RUNNER_UNAVAILABLE", "The isolated Node.js runner is temporarily unavailable. Your draft is safe; try again.", { retryable: true, cause: error instanceof Error ? error.name : "unknown" });
    }
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      await mutableQuestion(tx, ownerId, input.questionId);
      const existing = await tx.appliedEngineeringCodeRun.findUnique({ where: { ownerId_requestId: { ownerId, requestId: input.requestId } }, select: { id: true, blockQuestionId: true, codeFingerprint: true, resultSnapshot: true, createdAt: true } });
      if (existing) return replayRun(existing, input.questionId, fingerprint);
      const created = await tx.appliedEngineeringCodeRun.create({ data: { ownerId, blockQuestionId: input.questionId, requestId: input.requestId, contentFingerprint: question.contentFingerprint, codeFingerprint: fingerprint, code: input.code, runnerVersion: result.runnerVersion, passed: result.accepted, resultSnapshot: toJson(result) }, select: { id: true, resultSnapshot: true, createdAt: true } });
      return { id: created.id, result: publicRunResult(created.resultSnapshot), createdAt: created.createdAt.toISOString() };
    }, transactionOptions);
  }

  async submitAttempt(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringAttemptInputSchema.parse(rawInput);
    const workFingerprint = fingerprint(input.work);
    const replay = await this.prisma.appliedEngineeringQuestionAttempt.findUnique({ where: { ownerId_requestId: { ownerId, requestId: input.requestId } }, select: attemptReplaySelect });
    if (replay) {
      assertAttemptReplay(replay, input.questionId, workFingerprint);
      return { attempt: publicAttempt(replay), question: await this.question(ownerId, input.questionId) };
    }
    const question = await this.findMutableQuestion(ownerId, input.questionId);
    const frozen = appliedEngineeringQuestionSchema.parse(question.privateSnapshot);
    assertWorkMatchesQuestion(frozen, input.work);
    const run = input.work.kind === "code" ? await this.ownedRun(ownerId, input.questionId, question.contentFingerprint, input.work) : null;
    const evaluation = await this.evaluator.evaluate(frozen, input.work, run);
    const created = await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const existing = await tx.appliedEngineeringQuestionAttempt.findUnique({ where: { ownerId_requestId: { ownerId, requestId: input.requestId } }, select: attemptReplaySelect });
      if (existing) { assertAttemptReplay(existing, input.questionId, workFingerprint); return existing; }
      const current = await mutableQuestion(tx, ownerId, input.questionId);
      if (current.contentFingerprint !== question.contentFingerprint) throw new ConflictErrorException("APPLIED_ENGINEERING_QUESTION_CHANGED", "This question no longer matches the attempted content.");
      if (input.work.kind === "code") await assertOwnedRun(tx, ownerId, input.questionId, current.contentFingerprint, input.work);
      const attempt = await tx.appliedEngineeringQuestionAttempt.create({ data: { ownerId, blockQuestionId: input.questionId, requestId: input.requestId, contentFingerprint: current.contentFingerprint, workFingerprint, answerSnapshot: toJson(input.work), evaluationSnapshot: toJson(evaluation.feedback), verificationStatus: evaluation.verificationStatus, score: evaluation.feedback.score }, select: attemptReplaySelect });
      if (evaluation.complete) {
        await lockBlock(tx, current.blockId);
        await tx.appliedEngineeringBlockQuestion.update({ where: { id_ownerId: { id: input.questionId, ownerId } }, data: { status: AppliedEngineeringQuestionStatus.COMPLETED, completedAt: this.now() } });
        await makeAssessmentReadyIfTerminal(tx, ownerId, current.blockId, this.now);
      }
      return attempt;
    }, transactionOptions);
    return { attempt: publicAttempt(created), question: await this.question(ownerId, input.questionId) };
  }

  async learn(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringLearnInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const question = await tx.appliedEngineeringBlockQuestion.findFirst({ where: { id: input.questionId, ownerId, block: { isCurrent: true } }, select: { id: true, blockId: true, status: true } });
      if (!question) throw questionNotFound();
      if (question.status === AppliedEngineeringQuestionStatus.LEARNED) return;
      if (question.status === AppliedEngineeringQuestionStatus.COMPLETED) throw new ConflictErrorException("APPLIED_ENGINEERING_QUESTION_TERMINAL", "A completed question cannot be changed to Learned.");
      await lockBlock(tx, question.blockId);
      const learnedAt = this.now();
      await tx.appliedEngineeringBlockQuestion.update({ where: { id_ownerId: { id: input.questionId, ownerId } }, data: { status: AppliedEngineeringQuestionStatus.LEARNED, learnedAt } });
      await makeAssessmentReadyIfTerminal(tx, ownerId, question.blockId, () => learnedAt);
    }, transactionOptions);
    return this.question(ownerId, input.questionId);
  }

  private async findQuestion(ownerId: string, questionId: string): Promise<QuestionRead> {
    const question = await this.prisma.appliedEngineeringBlockQuestion.findFirst({ where: { id: questionId, ownerId, block: { isCurrent: true } }, select: questionReadSelect });
    if (!question) throw questionNotFound();
    return question;
  }

  private async findMutableQuestion(ownerId: string, questionId: string) {
    const question = await this.prisma.appliedEngineeringBlockQuestion.findFirst({ where: { id: questionId, ownerId, status: AppliedEngineeringQuestionStatus.ACTIVE, block: { isCurrent: true, status: AppliedEngineeringBlockStatus.PRACTISING } }, select: { id: true, blockId: true, contentFingerprint: true, privateSnapshot: true } });
    if (!question) throw questionNotMutable();
    return question;
  }

  private async ownedRun(ownerId: string, questionId: string, contentFingerprint: string, work: Extract<AppliedEngineeringAttemptWork, { kind: "code" }>) {
    const run = await this.prisma.appliedEngineeringCodeRun.findFirst({ where: { id: work.runId, ownerId, blockQuestionId: questionId }, select: { contentFingerprint: true, codeFingerprint: true, resultSnapshot: true } });
    validateRunBinding(run, contentFingerprint, work.code);
    return publicRunResult(run!.resultSnapshot);
  }
}

function publicBlock(block: BlockRead) {
  const selection = appliedEngineeringIncidentSelectionSchema.parse(block.selectionSnapshot);
  const questions = block.questions.map(publicQuestion);
  return {
    id: block.id,
    ordinal: block.ordinal,
    isCurrent: block.isCurrent,
    status: block.status,
    contentFingerprint: block.contentFingerprint,
    preparedAt: block.preparedAt.toISOString(),
    assessmentReadyAt: block.assessmentReadyAt?.toISOString() ?? null,
    assessedAt: block.assessedAt?.toISOString() ?? null,
    incident: selectedAppliedEngineeringIncidentSchema.parse(block.incidentSnapshot),
    selection: {
      policyVersion: selection.policyVersion,
      difficulty: selection.selectedIncident.difficulty,
      emphasizedSignalKeys: selection.selectedIncident.emphasizedSignalKeys,
      reason: selection.reason
    },
    focus: publicAppliedEngineeringConfirmedFocus(block.focusRevision.focusSnapshot),
    questions,
    remainingQuestionCount: questions.filter((question) => question.status === "ACTIVE").length,
    assessment: block.assessment
      ? {
          id: block.assessment.id,
          status: block.assessment.status,
          readyAt: block.assessment.readyAt?.toISOString() ?? null,
          startedAt: block.assessment.startedAt?.toISOString() ?? null,
          completedAt: block.assessment.completedAt?.toISOString() ?? null,
          assessment: block.assessment.assessmentSnapshot
            ? publicAppliedEngineeringAssessmentSnapshot(block.assessment.assessmentSnapshot)
            : null,
          report: block.assessment.report
            ? appliedEngineeringAssessmentReportSchema.parse(
                block.assessment.report.reportSnapshot
              )
            : null,
          transcript: block.assessment.report
            ? appliedEngineeringSafeTranscriptSchema.parse(
                block.assessment.report.transcriptSnapshot
              )
            : null
        }
      : null
  };
}

export type AppliedEngineeringPublicBlock = ReturnType<typeof publicBlock>;
export type AppliedEngineeringPublicQuestion = ReturnType<typeof publicQuestion>;

function publicQuestion(question: QuestionRead) {
  const frozen = appliedEngineeringQuestionSchema.parse(question.privateSnapshot);
  const snapshot = publicAppliedEngineeringQuestionSchema.parse(question.publicSnapshot);
  const attempted = question.attempts.length > 0;
  const answerAuthorized = attempted || question.status === AppliedEngineeringQuestionStatus.LEARNED;
  const hintCount = Math.min(3, Math.max(0, question.state?.revealedHintCount ?? 0));
  return { id: question.id, blockId: question.blockId, order: question.order, questionKey: question.questionKey, contentVersion: question.contentVersion, contentFingerprint: question.contentFingerprint, status: question.status, question: { ...snapshot, interviewConnection: answerAuthorized ? frozen.interviewConnection : undefined }, draft: parseDraft(question.state?.draft), revealedHints: Array.from({ length: hintCount }, (_, index) => revealAppliedEngineeringHint(frozen, (index + 1) as 1 | 2 | 3)), authorizedAnswer: answerAuthorized ? appliedEngineeringAuthorizedAnswerSchema.parse({ concise: frozen.answer.concise, explanation: frozen.answer.explanation, referenceSolution: frozen.referenceSolution }) : null, latestAttempt: question.attempts[0] ? publicAttempt(question.attempts[0]) : null, latestRun: question.codeRuns[0] ? { id: question.codeRuns[0].id, requestId: question.codeRuns[0].requestId, codeFingerprint: question.codeRuns[0].codeFingerprint, code: question.codeRuns[0].code, passed: question.codeRuns[0].passed, result: publicRunResult(question.codeRuns[0].resultSnapshot), createdAt: question.codeRuns[0].createdAt.toISOString() } : null, completedAt: question.completedAt?.toISOString() ?? null, learnedAt: question.learnedAt?.toISOString() ?? null, updatedAt: question.updatedAt.toISOString() };
}

const attemptReplaySelect = { id: true, blockQuestionId: true, requestId: true, workFingerprint: true, answerSnapshot: true, evaluationSnapshot: true, verificationStatus: true, score: true, createdAt: true } satisfies Prisma.AppliedEngineeringQuestionAttemptSelect;

function parseDraft(value: Prisma.JsonValue | null | undefined): AppliedEngineeringDraftWork | null { return value === null || value === undefined ? null : appliedEngineeringDraftWorkSchema.parse(value); }
function publicAttempt(attempt: { id: string; requestId: string; answerSnapshot: Prisma.JsonValue; evaluationSnapshot: Prisma.JsonValue; verificationStatus: string; score: number | null; createdAt: Date }) { return { id: attempt.id, requestId: attempt.requestId, work: appliedEngineeringAttemptWorkSchema.parse(attempt.answerSnapshot), feedback: appliedEngineeringAttemptFeedbackSchema.parse(attempt.evaluationSnapshot), verificationStatus: attempt.verificationStatus, score: attempt.score, createdAt: attempt.createdAt.toISOString() }; }
function publicRunResult(value: Prisma.JsonValue): AppliedEngineeringRunResult { return appliedEngineeringPublicRunResultSchema.parse(value) as AppliedEngineeringRunResult; }
function replayRun(run: { id: string; blockQuestionId: string; codeFingerprint: string; resultSnapshot: Prisma.JsonValue; createdAt: Date }, questionId: string, fingerprintValue: string) { if (run.blockQuestionId !== questionId || run.codeFingerprint !== fingerprintValue) throw new ConflictErrorException("APPLIED_ENGINEERING_RUN_REQUEST_CONFLICT", "This code-run request ID was already used for different work."); return { id: run.id, result: publicRunResult(run.resultSnapshot), createdAt: run.createdAt.toISOString() }; }
function assertAttemptReplay(attempt: { blockQuestionId: string; workFingerprint: string }, questionId: string, workFingerprint: string) { if (attempt.blockQuestionId !== questionId || attempt.workFingerprint !== workFingerprint) throw new ConflictErrorException("APPLIED_ENGINEERING_ATTEMPT_REQUEST_CONFLICT", "This attempt request ID was already used for different work."); }
function assertWorkMatchesQuestion(rawQuestion: unknown, work: AppliedEngineeringDraftWork | AppliedEngineeringAttemptWork | null) { if (work === null) return; const question = appliedEngineeringQuestionSchema.parse(rawQuestion); const executable = question.format === "debug-repair" || question.format === "micro-implementation"; if (question.format === "mcq" && work.kind !== "choice") throw new ConflictErrorException("APPLIED_ENGINEERING_WORK_FORMAT", "This question requires one selected choice."); if (executable && work.kind !== "code") throw new ConflictErrorException("APPLIED_ENGINEERING_WORK_FORMAT", "This question requires JavaScript code."); if (question.format !== "mcq" && !executable && work.kind !== "text") throw new ConflictErrorException("APPLIED_ENGINEERING_WORK_FORMAT", "This question requires a written response."); if (work.kind === "choice" && question.choices && work.selectedChoiceIndex >= question.choices.length) throw new ConflictErrorException("APPLIED_ENGINEERING_CHOICE_INVALID", "That answer choice does not exist."); }
async function mutableQuestion(tx: Prisma.TransactionClient, ownerId: string, questionId: string) { const question = await tx.appliedEngineeringBlockQuestion.findFirst({ where: { id: questionId, ownerId, status: AppliedEngineeringQuestionStatus.ACTIVE, block: { isCurrent: true, status: AppliedEngineeringBlockStatus.PRACTISING } }, select: { id: true, blockId: true, contentFingerprint: true, privateSnapshot: true } }); if (!question) throw questionNotMutable(); return question; }
async function assertOwnedRun(tx: Prisma.TransactionClient, ownerId: string, questionId: string, contentFingerprint: string, work: Extract<AppliedEngineeringAttemptWork, { kind: "code" }>) { const run = await tx.appliedEngineeringCodeRun.findFirst({ where: { id: work.runId, ownerId, blockQuestionId: questionId }, select: { contentFingerprint: true, codeFingerprint: true, resultSnapshot: true } }); validateRunBinding(run, contentFingerprint, work.code); }
function validateRunBinding(run: { contentFingerprint: string; codeFingerprint: string; resultSnapshot: Prisma.JsonValue } | null, contentFingerprint: string, code: string) { if (!run || run.contentFingerprint !== contentFingerprint || run.codeFingerprint !== codeFingerprint(code)) throw new ConflictErrorException("APPLIED_ENGINEERING_RUN_MISMATCH", "Run this exact code for this question before submitting it."); }
async function makeAssessmentReadyIfTerminal(
  tx: Prisma.TransactionClient,
  ownerId: string,
  blockId: string,
  now: () => Date
) {
  const activeCount = await tx.appliedEngineeringBlockQuestion.count({
    where: { ownerId, blockId, status: AppliedEngineeringQuestionStatus.ACTIVE }
  });
  if (activeCount > 0) return;
  const readyAt = now();
  const block = await tx.appliedEngineeringBlock.findUnique({
    where: { id_ownerId: { id: blockId, ownerId } },
    select: {
      contentFingerprint: true,
      selectionSnapshot: true,
      incidentVersion: { select: { incidentKey: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          status: true,
          contentFingerprint: true,
          privateSnapshot: true,
          attempts: {
            orderBy: { createdAt: "desc" },
            select: { score: true, verificationStatus: true }
          }
        }
      }
    }
  });
  if (!block) throw questionNotFound();
  const assessmentSnapshot = buildAppliedEngineeringAssessmentSnapshot({
    blockContentFingerprint: block.contentFingerprint,
    selectionSnapshot: block.selectionSnapshot,
    questions: block.questions,
    preparedAt: readyAt
  });
  await tx.appliedEngineeringBlock.update({
    where: { id_ownerId: { id: blockId, ownerId } },
    data: { status: AppliedEngineeringBlockStatus.ASSESSMENT_READY, assessmentReadyAt: readyAt }
  });
  await tx.appliedEngineeringAssessment.update({
    where: { blockId_ownerId: { blockId, ownerId } },
    data: {
      status: AppliedEngineeringAssessmentStatus.READY,
      readyAt,
      assessmentSnapshot: toJson(assessmentSnapshot)
    }
  });
  await tx.appliedEngineeringIncidentProgress.update({
    where: {
      ownerId_incidentKey: { ownerId, incidentKey: block.incidentVersion.incidentKey }
    },
    data: { status: AppliedEngineeringIncidentProgressStatus.ASSESSMENT_READY }
  });
}
async function lockBlock(tx: Prisma.TransactionClient, blockId: string): Promise<void> { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${blockId}))`; }
function questionNotFound() { return new NotFoundErrorException("APPLIED_ENGINEERING_QUESTION_NOT_FOUND", "Applied Engineering question not found."); }
function questionNotMutable() { return new ConflictErrorException("APPLIED_ENGINEERING_QUESTION_READ_ONLY", "This Applied Engineering question is no longer active."); }
function fingerprint(value: unknown): string { return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`; }
function stableStringify(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; if (typeof value === "object" && value !== null) return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(",")}}`; return JSON.stringify(value); }
function toJson(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
async function lock(tx: Prisma.TransactionClient, key: string): Promise<void> { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`; }
const transactionOptions = { maxWait: 20_000, timeout: 120_000 } as const;
