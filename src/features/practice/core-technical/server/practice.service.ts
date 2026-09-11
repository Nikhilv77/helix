import {
  CoreTechnicalAssessmentStatus,
  CoreTechnicalBlockStatus,
  CoreTechnicalQuestionStatus,
  CoreTechnicalStoryProgressStatus,
  Prisma
} from "@prisma/client";
import {
  coreTechnicalAttemptFeedbackSchema,
  coreTechnicalAttemptInputSchema,
  coreTechnicalAttemptWorkSchema,
  coreTechnicalAuthorizedAnswerSchema,
  coreTechnicalDraftWorkSchema,
  coreTechnicalLearnInputSchema,
  coreTechnicalPublicRunResultSchema,
  coreTechnicalRevealHintInputSchema,
  coreTechnicalRunInputSchema,
  coreTechnicalSaveDraftInputSchema,
  type CoreTechnicalAttemptWork,
  type CoreTechnicalDraftWork
} from "@/features/practice/core-technical/domain/practice-contracts";
import {
  coreTechnicalAssessmentReportSchema,
  coreTechnicalSafeTranscriptSchema,
  publicCoreTechnicalAssessmentSnapshot
} from "@/features/practice/core-technical/domain/assessment-contracts";
import {
  coreTechnicalLearningGuideFor,
  generatedQuestionCandidateSchema,
  publicCoreTechnicalQuestionSchema,
  revealCoreTechnicalHint
} from "@/features/practice/core-technical/domain/question-contracts";
import {
  coreTechnicalStorySelectionSchema,
  publicCoreTechnicalConfirmedFocus
} from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { selectedStorySchema } from "@/features/practice/core-technical/domain/story-contracts";
import {
  coreTechnicalPracticeQuestionPrompt,
  coreTechnicalPracticePathPresentation,
  coreTechnicalPracticePathReason
} from "@/features/practice/core-technical/domain/practice-path-presentation";
import { BadRequestErrorException } from "@/server/common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import { codeFingerprint } from "@/features/interviews/server/code-fingerprint";
import {
  assertStoryPracticeAttemptReplay,
  assertStoryPracticeHintOrder,
  assertStoryPracticeRunBinding,
  assertStoryPracticeRunReplay,
  assertStoryPracticeWorkMatchesQuestion,
  STORY_PRACTICE_TRANSACTION_OPTIONS as transactionOptions,
  storyPracticeFingerprint as fingerprint
} from "@/features/practice/shared/server/practice-orchestrator";
import type { CoreTechnicalAttemptEvaluator } from "./attempt-evaluator";
import type { CoreTechnicalRunResult } from "./runner-contracts";
import type { CoreTechnicalRunnerService } from "./runner.service";
import { buildCoreTechnicalAssessmentSnapshot } from "./assessment-blueprint";

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
    select: {
      id: true,
      requestId: true,
      workFingerprint: true,
      answerSnapshot: true,
      evaluationSnapshot: true,
      verificationStatus: true,
      score: true,
      createdAt: true
    }
  },
  codeRuns: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      requestId: true,
      codeFingerprint: true,
      code: true,
      passed: true,
      resultSnapshot: true,
      createdAt: true
    }
  }
} satisfies Prisma.CoreTechnicalBlockQuestionSelect;

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
  storySnapshot: true,
  focusRevision: { select: { focusSnapshot: true } },
  questions: { orderBy: { order: "asc" as const }, select: questionReadSelect },
  assessment: {
    select: {
      id: true,
      status: true,
      readyAt: true,
      startedAt: true,
      completedAt: true,
      assessmentSnapshot: true,
      report: { select: { reportSnapshot: true, transcriptSnapshot: true } }
    }
  }
} satisfies Prisma.CoreTechnicalBlockSelect;

type QuestionRead = Prisma.CoreTechnicalBlockQuestionGetPayload<{
  select: typeof questionReadSelect;
}>;
type BlockRead = Prisma.CoreTechnicalBlockGetPayload<{ select: typeof blockReadSelect }>;

export class CoreTechnicalPracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: Pick<CoreTechnicalRunnerService, "run">,
    private readonly evaluator: Pick<CoreTechnicalAttemptEvaluator, "evaluate">,
    private readonly now: () => Date = () => new Date()
  ) {}

  async current(ownerId: string) {
    const block = await this.prisma.coreTechnicalBlock.findFirst({
      where: { ownerId, isCurrent: true },
      select: blockReadSelect
    });
    return block ? publicBlock(block) : null;
  }

  async historyBlock(ownerId: string, blockId: string) {
    const block = await this.prisma.coreTechnicalBlock.findFirst({
      where: { id: blockId, ownerId },
      select: blockReadSelect
    });
    if (!block) {
      throw new NotFoundErrorException(
        "CORE_TECHNICAL_BLOCK_NOT_FOUND",
        "Core Technical practice path not found."
      );
    }
    return publicBlock(block);
  }

  async question(ownerId: string, questionId: string) {
    const question = await this.findQuestion(ownerId, questionId);
    return publicQuestion(question);
  }

  async saveDraft(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalSaveDraftInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const question = await mutableQuestion(tx, ownerId, input.questionId);
      assertWorkMatchesQuestion(question.privateSnapshot, input.draft);
      await tx.coreTechnicalQuestionState.upsert({
        where: { blockQuestionId_ownerId: { blockQuestionId: input.questionId, ownerId } },
        create: {
          blockQuestionId: input.questionId,
          ownerId,
          draft: input.draft === null ? Prisma.DbNull : toJson(input.draft)
        },
        update: { draft: input.draft === null ? Prisma.DbNull : toJson(input.draft) }
      });
    }, transactionOptions);
    return this.question(ownerId, input.questionId);
  }

  async revealHint(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalRevealHintInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const question = await mutableQuestion(tx, ownerId, input.questionId);
      const state = await tx.coreTechnicalQuestionState.findUnique({
        where: { blockQuestionId_ownerId: { blockQuestionId: input.questionId, ownerId } },
        select: { revealedHintCount: true }
      });
      const current = state?.revealedHintCount ?? 0;
      assertStoryPracticeHintOrder(
        current,
        input.hintNumber,
        () =>
          new ConflictErrorException(
            "CORE_TECHNICAL_HINT_OUT_OF_ORDER",
            "Reveal Core Technical hints in order."
          )
      );
      if (input.hintNumber > current) {
        await tx.coreTechnicalQuestionState.upsert({
          where: { blockQuestionId_ownerId: { blockQuestionId: input.questionId, ownerId } },
          create: {
            blockQuestionId: input.questionId,
            ownerId,
            revealedHintCount: input.hintNumber
          },
          update: { revealedHintCount: input.hintNumber }
        });
      }
      generatedQuestionCandidateSchema.parse(question.privateSnapshot);
    }, transactionOptions);
    return this.question(ownerId, input.questionId);
  }

  async runCode(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalRunInputSchema.parse(rawInput);
    const fingerprint = codeFingerprint(input.code);
    const replay = await this.prisma.coreTechnicalCodeRun.findUnique({
      where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
      select: {
        id: true,
        blockQuestionId: true,
        codeFingerprint: true,
        resultSnapshot: true,
        createdAt: true
      }
    });
    if (replay) return replayRun(replay, input.questionId, fingerprint);

    const question = await this.findMutableQuestion(ownerId, input.questionId);
    const frozen = generatedQuestionCandidateSchema.parse(question.privateSnapshot);
    assertWorkMatchesQuestion(frozen, { kind: "code", code: input.code });

    let result;
    try {
      result = await this.runner.run(frozen, input.code);
    } catch (error) {
      throw new ServiceUnavailableErrorException(
        "CORE_TECHNICAL_RUNNER_UNAVAILABLE",
        "The isolated code runner is temporarily unavailable. Your draft is safe; try again.",
        { retryable: true, cause: error instanceof Error ? error.name : "unknown" }
      );
    }
    const saved = await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      await mutableQuestion(tx, ownerId, input.questionId);
      const existing = await tx.coreTechnicalCodeRun.findUnique({
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: {
          id: true,
          blockQuestionId: true,
          codeFingerprint: true,
          resultSnapshot: true,
          createdAt: true
        }
      });
      if (existing) return replayRun(existing, input.questionId, fingerprint);
      const created = await tx.coreTechnicalCodeRun.create({
        data: {
          ownerId,
          blockQuestionId: input.questionId,
          requestId: input.requestId,
          contentFingerprint: question.contentFingerprint,
          codeFingerprint: fingerprint,
          code: input.code,
          runnerVersion: result.runnerVersion,
          passed: result.accepted,
          resultSnapshot: toJson(result)
        },
        select: { id: true, resultSnapshot: true, createdAt: true }
      });
      return {
        id: created.id,
        result: publicRunResult(created.resultSnapshot),
        createdAt: created.createdAt.toISOString()
      };
    }, transactionOptions);
    return saved;
  }

  async submitAttempt(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalAttemptInputSchema.parse(rawInput);
    const workFingerprint = fingerprint(input.work);
    const replay = await this.prisma.coreTechnicalQuestionAttempt.findUnique({
      where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
      select: attemptReplaySelect
    });
    if (replay) {
      assertAttemptReplay(replay, input.questionId, workFingerprint);
      return {
        attempt: publicAttempt(replay),
        question: await this.question(ownerId, input.questionId)
      };
    }

    const question = await this.findMutableQuestion(ownerId, input.questionId);
    const frozen = generatedQuestionCandidateSchema.parse(question.privateSnapshot);
    assertWorkMatchesQuestion(frozen, input.work);
    const run =
      input.work.kind === "code"
        ? await this.ownedRun(ownerId, input.questionId, question.contentFingerprint, input.work)
        : null;
    const evaluation = await this.evaluator.evaluate(frozen, input.work, run);
    const created = await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const existing = await tx.coreTechnicalQuestionAttempt.findUnique({
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: attemptReplaySelect
      });
      if (existing) {
        assertAttemptReplay(existing, input.questionId, workFingerprint);
        return existing;
      }
      const current = await mutableQuestion(tx, ownerId, input.questionId);
      if (current.contentFingerprint !== question.contentFingerprint) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_QUESTION_CHANGED",
          "This question no longer matches the attempted content."
        );
      }
      if (input.work.kind === "code") {
        await assertOwnedRun(tx, ownerId, input.questionId, current.contentFingerprint, input.work);
      }
      const attempt = await tx.coreTechnicalQuestionAttempt.create({
        data: {
          ownerId,
          blockQuestionId: input.questionId,
          requestId: input.requestId,
          contentFingerprint: current.contentFingerprint,
          workFingerprint,
          answerSnapshot: toJson(input.work),
          evaluationSnapshot: toJson(evaluation.feedback),
          verificationStatus: evaluation.verificationStatus,
          score: evaluation.feedback.score
        },
        select: attemptReplaySelect
      });
      if (evaluation.complete) {
        await lockBlock(tx, current.blockId);
        await tx.coreTechnicalBlockQuestion.update({
          where: { id_ownerId: { id: input.questionId, ownerId } },
          data: { status: CoreTechnicalQuestionStatus.COMPLETED, completedAt: this.now() }
        });
        await makeAssessmentReadyIfTerminal(tx, ownerId, current.blockId, this.now);
      }
      return attempt;
    }, transactionOptions);
    return {
      attempt: publicAttempt(created),
      question: await this.question(ownerId, input.questionId)
    };
  }

  async learn(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalLearnInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const question = await tx.coreTechnicalBlockQuestion.findFirst({
        where: {
          id: input.questionId,
          ownerId,
          block: { status: CoreTechnicalBlockStatus.PRACTISING }
        },
        select: { id: true, blockId: true, status: true }
      });
      if (!question) throw questionNotFound();
      if (question.status === CoreTechnicalQuestionStatus.LEARNED) return;
      if (question.status === CoreTechnicalQuestionStatus.COMPLETED) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_QUESTION_TERMINAL",
          "A completed question cannot be changed to Learned."
        );
      }
      await lockBlock(tx, question.blockId);
      const learnedAt = this.now();
      await tx.coreTechnicalBlockQuestion.update({
        where: { id_ownerId: { id: input.questionId, ownerId } },
        data: { status: CoreTechnicalQuestionStatus.LEARNED, learnedAt }
      });
      await makeAssessmentReadyIfTerminal(tx, ownerId, question.blockId, () => learnedAt);
    }, transactionOptions);
    return this.question(ownerId, input.questionId);
  }

  private async findQuestion(ownerId: string, questionId: string): Promise<QuestionRead> {
    const question = await this.prisma.coreTechnicalBlockQuestion.findFirst({
      where: { id: questionId, ownerId },
      select: questionReadSelect
    });
    if (!question) throw questionNotFound();
    return question;
  }

  private async findMutableQuestion(ownerId: string, questionId: string) {
    const question = await this.prisma.coreTechnicalBlockQuestion.findFirst({
      where: {
        id: questionId,
        ownerId,
        status: CoreTechnicalQuestionStatus.ACTIVE,
        block: { status: CoreTechnicalBlockStatus.PRACTISING }
      },
      select: { id: true, blockId: true, contentFingerprint: true, privateSnapshot: true }
    });
    if (!question) throw questionNotMutable();
    return question;
  }

  private async ownedRun(
    ownerId: string,
    questionId: string,
    contentFingerprint: string,
    work: Extract<CoreTechnicalAttemptWork, { kind: "code" }>
  ) {
    const run = await this.prisma.coreTechnicalCodeRun.findFirst({
      where: { id: work.runId, ownerId, blockQuestionId: questionId },
      select: { contentFingerprint: true, codeFingerprint: true, resultSnapshot: true }
    });
    validateRunBinding(run, contentFingerprint, work.code);
    return publicRunResult(run!.resultSnapshot);
  }
}

const attemptReplaySelect = {
  id: true,
  blockQuestionId: true,
  requestId: true,
  workFingerprint: true,
  answerSnapshot: true,
  evaluationSnapshot: true,
  verificationStatus: true,
  score: true,
  createdAt: true
} satisfies Prisma.CoreTechnicalQuestionAttemptSelect;

function publicBlock(block: BlockRead) {
  const questions = block.questions.map(publicQuestion);
  const selection = coreTechnicalStorySelectionSchema.parse(block.selectionSnapshot);
  const storedStory = selectedStorySchema.parse(block.storySnapshot);
  const story = coreTechnicalPracticePathPresentation(storedStory);
  return {
    id: block.id,
    ordinal: block.ordinal,
    isCurrent: block.isCurrent,
    status: block.status,
    contentFingerprint: block.contentFingerprint,
    preparedAt: block.preparedAt.toISOString(),
    assessmentReadyAt: block.assessmentReadyAt?.toISOString() ?? null,
    assessedAt: block.assessedAt?.toISOString() ?? null,
    story,
    selection: {
      policyVersion: selection.policyVersion,
      difficulty: selection.selectedStory.difficulty,
      emphasizedConceptKeys: selection.selectedStory.emphasizedConceptKeys,
      reason: coreTechnicalPracticePathReason(selection.reason, storedStory.key, storedStory.title),
      generationProvenance: selection.generationProvenance ?? null
    },
    focus: publicCoreTechnicalConfirmedFocus(block.focusRevision.focusSnapshot),
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
            ? publicCoreTechnicalAssessmentSnapshot(block.assessment.assessmentSnapshot)
            : null,
          report: block.assessment.report
            ? coreTechnicalAssessmentReportSchema.parse(block.assessment.report.reportSnapshot)
            : null,
          transcript: block.assessment.report
            ? coreTechnicalSafeTranscriptSchema.parse(block.assessment.report.transcriptSnapshot)
            : null
        }
      : null
  };
}

export type CoreTechnicalPublicBlock = ReturnType<typeof publicBlock>;
export type CoreTechnicalPublicQuestion = ReturnType<typeof publicQuestion>;

function publicQuestion(question: QuestionRead) {
  const frozen = generatedQuestionCandidateSchema.parse(question.privateSnapshot);
  const snapshot = publicCoreTechnicalQuestionSchema.parse(question.publicSnapshot);
  const attempted = question.attempts.length > 0;
  const answerAuthorized = attempted || question.status === CoreTechnicalQuestionStatus.LEARNED;
  const hintCount = Math.min(3, Math.max(0, question.state?.revealedHintCount ?? 0));
  return {
    id: question.id,
    blockId: question.blockId,
    order: question.order,
    questionKey: question.questionKey,
    contentVersion: question.contentVersion,
    contentFingerprint: question.contentFingerprint,
    status: question.status,
    question: {
      ...snapshot,
      prompt: coreTechnicalPracticeQuestionPrompt({
        questionKey: question.questionKey,
        prompt: snapshot.prompt
      }),
      interviewConnection: answerAuthorized ? frozen.interviewConnection : undefined
    },
    draft: parseDraft(question.state?.draft),
    revealedHints: Array.from({ length: hintCount }, (_, index) =>
      revealCoreTechnicalHint(frozen, (index + 1) as 1 | 2 | 3)
    ),
    authorizedAnswer: answerAuthorized
      ? coreTechnicalAuthorizedAnswerSchema.parse({
          concise: frozen.answer.concise,
          explanation: frozen.answer.explanation,
          learningGuide: coreTechnicalLearningGuideFor(frozen),
          referenceSolution: frozen.referenceSolution
        })
      : null,
    latestAttempt: question.attempts[0] ? publicAttempt(question.attempts[0]) : null,
    latestRun: question.codeRuns[0]
      ? {
          id: question.codeRuns[0].id,
          requestId: question.codeRuns[0].requestId,
          codeFingerprint: question.codeRuns[0].codeFingerprint,
          code: question.codeRuns[0].code,
          passed: question.codeRuns[0].passed,
          result: publicRunResult(question.codeRuns[0].resultSnapshot),
          createdAt: question.codeRuns[0].createdAt.toISOString()
        }
      : null,
    completedAt: question.completedAt?.toISOString() ?? null,
    learnedAt: question.learnedAt?.toISOString() ?? null,
    updatedAt: question.updatedAt.toISOString()
  };
}

function parseDraft(value: Prisma.JsonValue | null | undefined): CoreTechnicalDraftWork | null {
  if (value === null || value === undefined) return null;
  return coreTechnicalDraftWorkSchema.parse(value);
}

function publicAttempt(attempt: {
  id: string;
  requestId: string;
  answerSnapshot: Prisma.JsonValue;
  evaluationSnapshot: Prisma.JsonValue;
  verificationStatus: string;
  score: number | null;
  createdAt: Date;
}) {
  return {
    id: attempt.id,
    requestId: attempt.requestId,
    work: coreTechnicalAttemptWorkSchema.parse(attempt.answerSnapshot),
    feedback: coreTechnicalAttemptFeedbackSchema.parse(attempt.evaluationSnapshot),
    verificationStatus: attempt.verificationStatus,
    score: attempt.score,
    createdAt: attempt.createdAt.toISOString()
  };
}

function publicRunResult(value: Prisma.JsonValue): CoreTechnicalRunResult {
  return coreTechnicalPublicRunResultSchema.parse(value) as CoreTechnicalRunResult;
}

function replayRun(
  run: {
    id: string;
    blockQuestionId: string;
    codeFingerprint: string;
    resultSnapshot: Prisma.JsonValue;
    createdAt: Date;
  },
  questionId: string,
  fingerprintValue: string
) {
  assertStoryPracticeRunReplay(
    run,
    { questionId, codeFingerprint: fingerprintValue },
    () =>
      new ConflictErrorException(
        "CORE_TECHNICAL_RUN_REQUEST_CONFLICT",
        "This code-run request ID was already used for different work."
      )
  );
  return {
    id: run.id,
    result: publicRunResult(run.resultSnapshot),
    createdAt: run.createdAt.toISOString()
  };
}

function assertAttemptReplay(
  attempt: { blockQuestionId: string; workFingerprint: string },
  questionId: string,
  workFingerprint: string
) {
  assertStoryPracticeAttemptReplay(
    attempt,
    { questionId, workFingerprint },
    () =>
      new ConflictErrorException(
        "CORE_TECHNICAL_ATTEMPT_REQUEST_CONFLICT",
        "This attempt request ID was already used for different work."
      )
  );
}

function assertWorkMatchesQuestion(
  rawQuestion: unknown,
  work: CoreTechnicalDraftWork | CoreTechnicalAttemptWork | null
) {
  if (work === null) return;
  const question = generatedQuestionCandidateSchema.parse(rawQuestion);
  assertStoryPracticeWorkMatchesQuestion(question, work, {
    format: () =>
      new BadRequestErrorException(
        "CORE_TECHNICAL_WORK_FORMAT",
        question.format === "mcq"
          ? "This question requires one selected choice."
          : question.format === "debug-repair" || question.format === "micro-implementation"
            ? "This question requires JavaScript code."
            : "This question requires a written response."
      ),
    choice: () =>
      new BadRequestErrorException(
        "CORE_TECHNICAL_CHOICE_INVALID",
        "That answer choice does not exist."
      )
  });
}

async function mutableQuestion(tx: Prisma.TransactionClient, ownerId: string, questionId: string) {
  const question = await tx.coreTechnicalBlockQuestion.findFirst({
    where: {
      id: questionId,
      ownerId,
      status: CoreTechnicalQuestionStatus.ACTIVE,
      block: { status: CoreTechnicalBlockStatus.PRACTISING }
    },
    select: { id: true, blockId: true, contentFingerprint: true, privateSnapshot: true }
  });
  if (!question) throw questionNotMutable();
  return question;
}

async function assertOwnedRun(
  tx: Prisma.TransactionClient,
  ownerId: string,
  questionId: string,
  contentFingerprint: string,
  work: Extract<CoreTechnicalAttemptWork, { kind: "code" }>
) {
  const run = await tx.coreTechnicalCodeRun.findFirst({
    where: { id: work.runId, ownerId, blockQuestionId: questionId },
    select: { contentFingerprint: true, codeFingerprint: true, resultSnapshot: true }
  });
  validateRunBinding(run, contentFingerprint, work.code);
}

function validateRunBinding(
  run: {
    contentFingerprint: string;
    codeFingerprint: string;
    resultSnapshot: Prisma.JsonValue;
  } | null,
  contentFingerprint: string,
  code: string
) {
  assertStoryPracticeRunBinding(
    run,
    { contentFingerprint, codeFingerprint: codeFingerprint(code) },
    () =>
      new ConflictErrorException(
        "CORE_TECHNICAL_RUN_MISMATCH",
        "Run this exact code for this question before submitting it."
      )
  );
}

async function makeAssessmentReadyIfTerminal(
  tx: Prisma.TransactionClient,
  ownerId: string,
  blockId: string,
  now: () => Date
) {
  const activeCount = await tx.coreTechnicalBlockQuestion.count({
    where: { ownerId, blockId, status: CoreTechnicalQuestionStatus.ACTIVE }
  });
  if (activeCount > 0) return;
  const readyAt = now();
  const frozen = await tx.coreTechnicalBlock.findUnique({
    where: { id_ownerId: { id: blockId, ownerId } },
    select: {
      isCurrent: true,
      contentFingerprint: true,
      storySnapshot: true,
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
  if (!frozen) throw questionNotFound();
  // Loose library practice saves question progress without creating a second
  // assessment-bearing path. If this block is promoted later, activation will
  // unlock its assessment when every saved question is already terminal.
  if (!frozen.isCurrent) return;
  const assessmentSnapshot = buildCoreTechnicalAssessmentSnapshot({
    blockContentFingerprint: frozen.contentFingerprint,
    storySnapshot: frozen.storySnapshot,
    questions: frozen.questions,
    preparedAt: readyAt
  });
  const block = await tx.coreTechnicalBlock.update({
    where: { id_ownerId: { id: blockId, ownerId } },
    data: {
      status: CoreTechnicalBlockStatus.ASSESSMENT_READY,
      assessmentReadyAt: readyAt
    },
    select: { storyVersion: { select: { storyKey: true } } }
  });
  await Promise.all([
    tx.coreTechnicalAssessment.update({
      where: { blockId_ownerId: { blockId, ownerId } },
      data: {
        status: CoreTechnicalAssessmentStatus.READY,
        readyAt,
        assessmentSnapshot: toJson(assessmentSnapshot)
      }
    }),
    tx.coreTechnicalStoryProgress.update({
      where: { ownerId_storyKey: { ownerId, storyKey: block.storyVersion.storyKey } },
      data: { status: CoreTechnicalStoryProgressStatus.ASSESSMENT_READY }
    })
  ]);
}

function questionNotFound() {
  return new NotFoundErrorException(
    "CORE_TECHNICAL_QUESTION_NOT_FOUND",
    "Core Technical question not found."
  );
}

function questionNotMutable() {
  return new ConflictErrorException(
    "CORE_TECHNICAL_QUESTION_READ_ONLY",
    "This Core Technical question is no longer active."
  );
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lock(tx: Prisma.TransactionClient, questionId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`core-technical-question:${questionId}`}))`;
}

async function lockBlock(tx: Prisma.TransactionClient, blockId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`core-technical-block-lifecycle:${blockId}`}))`;
}
