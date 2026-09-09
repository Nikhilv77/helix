import {
  architectureDesignAssessmentReportSchema,
  architectureDesignSafeTranscriptSchema,
  publicArchitectureDesignAssessmentSnapshot
} from "@/features/practice/architecture-design/domain/assessment-contracts";
import {
  ArchitectureAssessmentStatus,
  ArchitectureBlockStatus,
  ArchitectureQuestionStatus,
  ArchitectureScenarioProgressStatus,
  Prisma
} from "@prisma/client";
import {
  architectureDesignAttemptFeedbackSchema,
  architectureDesignAttemptInputSchema,
  architectureDesignAttemptWorkSchema,
  architectureDesignAuthorizedAnswerSchema,
  architectureDesignDraftWorkSchema,
  architectureDesignLearnInputSchema,
  architectureDesignRevealHintInputSchema,
  architectureDesignSaveDraftInputSchema,
  type ArchitectureDesignAttemptWork,
  type ArchitectureDesignDraftWork
} from "@/features/practice/architecture-design/domain/practice-contracts";
import {
  architectureDesignQuestionSchema,
  publicArchitectureDesignQuestionSchema,
  revealArchitectureDesignHint
} from "@/features/practice/architecture-design/domain/question-contracts";
import { architectureDesignScenarioSelectionSchema } from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { architectureDesignScenarioSchema } from "@/features/practice/architecture-design/domain/scenario-contracts";
import { publicArchitectureDesignConfirmedFocus } from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import {
  assertStoryPracticeAttemptReplay,
  assertStoryPracticeHintOrder,
  assertStoryPracticeWorkMatchesQuestion,
  STORY_PRACTICE_TRANSACTION_OPTIONS as transactionOptions,
  storyPracticeFingerprint
} from "@/features/practice/shared/server/practice-orchestrator";
import type { ArchitectureDesignAttemptEvaluator } from "./attempt-evaluator";

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
      evaluatorVersion: true,
      evaluatorFingerprint: true,
      answerSnapshot: true,
      evaluationSnapshot: true,
      verificationStatus: true,
      score: true,
      createdAt: true
    }
  }
} satisfies Prisma.ArchitectureBlockQuestionSelect;

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
  scenarioSnapshot: true,
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
} satisfies Prisma.ArchitectureBlockSelect;

const attemptReplaySelect = {
  id: true,
  blockQuestionId: true,
  requestId: true,
  workFingerprint: true,
  evaluatorVersion: true,
  evaluatorFingerprint: true,
  answerSnapshot: true,
  evaluationSnapshot: true,
  verificationStatus: true,
  score: true,
  createdAt: true
} satisfies Prisma.ArchitectureQuestionAttemptSelect;

type QuestionRead = Prisma.ArchitectureBlockQuestionGetPayload<{
  select: typeof questionReadSelect;
}>;
type BlockRead = Prisma.ArchitectureBlockGetPayload<{ select: typeof blockReadSelect }>;

export class ArchitectureDesignPracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: Pick<ArchitectureDesignAttemptEvaluator, "evaluate">,
    private readonly now: () => Date = () => new Date()
  ) {}

  async current(ownerId: string) {
    const block = await this.prisma.architectureBlock.findFirst({
      where: { ownerId, isCurrent: true },
      select: blockReadSelect
    });
    return block ? publicBlock(block) : null;
  }

  async question(ownerId: string, questionId: string) {
    return publicQuestion(await this.findQuestion(ownerId, questionId));
  }

  async historyBlock(ownerId: string, blockId: string) {
    const block = await this.prisma.architectureBlock.findFirst({
      where: { id: blockId, ownerId },
      select: blockReadSelect
    });
    if (!block) throw blockNotFound();
    return publicBlock(block);
  }

  async saveDraft(ownerId: string, rawInput: unknown) {
    const input = architectureDesignSaveDraftInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const question = await mutableQuestion(tx, ownerId, input.questionId);
      assertWorkMatchesQuestion(question.privateSnapshot, input.draft);
      await tx.architectureQuestionState.upsert({
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
    const input = architectureDesignRevealHintInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      await mutableQuestion(tx, ownerId, input.questionId);
      const state = await tx.architectureQuestionState.findUnique({
        where: { blockQuestionId_ownerId: { blockQuestionId: input.questionId, ownerId } },
        select: { revealedHintCount: true }
      });
      const current = state?.revealedHintCount ?? 0;
      assertStoryPracticeHintOrder(
        current,
        input.hintNumber,
        () =>
          new ConflictErrorException(
            "ARCHITECTURE_DESIGN_HINT_OUT_OF_ORDER",
            "Reveal Architecture & Design hints in order."
          )
      );
      if (input.hintNumber > current) {
        await tx.architectureQuestionState.upsert({
          where: { blockQuestionId_ownerId: { blockQuestionId: input.questionId, ownerId } },
          create: {
            blockQuestionId: input.questionId,
            ownerId,
            revealedHintCount: input.hintNumber
          },
          update: { revealedHintCount: input.hintNumber }
        });
      }
    }, transactionOptions);
    return this.question(ownerId, input.questionId);
  }

  async submitAttempt(ownerId: string, rawInput: unknown) {
    const input = architectureDesignAttemptInputSchema.parse(rawInput);
    const workFingerprint = storyPracticeFingerprint(input.work);
    const replay = await this.prisma.architectureQuestionAttempt.findUnique({
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
    const frozen = architectureDesignQuestionSchema.parse(question.privateSnapshot);
    assertWorkMatchesQuestion(frozen, input.work);
    let evaluation: Awaited<ReturnType<ArchitectureDesignAttemptEvaluator["evaluate"]>>;
    try {
      evaluation = await this.evaluator.evaluate(frozen, input.work);
    } catch (error) {
      throw new ServiceUnavailableErrorException(
        "ARCHITECTURE_DESIGN_EVALUATOR_UNAVAILABLE",
        "The design evaluator is temporarily unavailable. Your draft is safe; try again.",
        { retryable: true, cause: error instanceof Error ? error.name : "unknown" }
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const existing = await tx.architectureQuestionAttempt.findUnique({
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
          "ARCHITECTURE_DESIGN_QUESTION_CHANGED",
          "This question no longer matches the attempted content."
        );
      }
      const attempt = await tx.architectureQuestionAttempt.create({
        data: {
          ownerId,
          blockQuestionId: input.questionId,
          requestId: input.requestId,
          contentFingerprint: current.contentFingerprint,
          workFingerprint,
          evaluatorVersion: evaluation.evaluatorVersion,
          evaluatorFingerprint: evaluation.evaluatorFingerprint,
          answerSnapshot: toJson(input.work),
          evaluationSnapshot: toJson(evaluation.feedback),
          verificationStatus: evaluation.verificationStatus,
          score: evaluation.feedback.score
        },
        select: attemptReplaySelect
      });
      if (evaluation.complete) {
        await lock(tx, current.blockId);
        await tx.architectureBlockQuestion.update({
          where: { id_ownerId: { id: input.questionId, ownerId } },
          data: { status: ArchitectureQuestionStatus.COMPLETED, completedAt: this.now() }
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
    const input = architectureDesignLearnInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lock(tx, input.questionId);
      const question = await tx.architectureBlockQuestion.findFirst({
        where: { id: input.questionId, ownerId, block: { isCurrent: true } },
        select: { id: true, blockId: true, status: true }
      });
      if (!question) throw questionNotFound();
      if (question.status === ArchitectureQuestionStatus.LEARNED) return;
      if (question.status === ArchitectureQuestionStatus.COMPLETED) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_QUESTION_TERMINAL",
          "A completed question cannot be changed to Learned."
        );
      }
      await lock(tx, question.blockId);
      const learnedAt = this.now();
      await tx.architectureBlockQuestion.update({
        where: { id_ownerId: { id: input.questionId, ownerId } },
        data: { status: ArchitectureQuestionStatus.LEARNED, learnedAt }
      });
      await makeAssessmentReadyIfTerminal(tx, ownerId, question.blockId, () => learnedAt);
    }, transactionOptions);
    return this.question(ownerId, input.questionId);
  }

  private async findQuestion(ownerId: string, questionId: string): Promise<QuestionRead> {
    const question = await this.prisma.architectureBlockQuestion.findFirst({
      where: { id: questionId, ownerId, block: { isCurrent: true } },
      select: questionReadSelect
    });
    if (!question) throw questionNotFound();
    return question;
  }

  private async findMutableQuestion(ownerId: string, questionId: string) {
    const question = await this.prisma.architectureBlockQuestion.findFirst({
      where: {
        id: questionId,
        ownerId,
        status: ArchitectureQuestionStatus.ACTIVE,
        block: { isCurrent: true, status: ArchitectureBlockStatus.PRACTISING }
      },
      select: { id: true, blockId: true, contentFingerprint: true, privateSnapshot: true }
    });
    if (!question) throw questionNotMutable();
    return question;
  }
}

function publicBlock(block: BlockRead) {
  const selection = architectureDesignScenarioSelectionSchema.parse(block.selectionSnapshot);
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
    scenario: architectureDesignScenarioSchema.parse(block.scenarioSnapshot),
    selection: {
      policyVersion: selection.policyVersion,
      difficulty: selection.selectedScenario.difficulty,
      emphasizedDimensionKeys: selection.selectedScenario.emphasizedDimensionKeys,
      reason: selection.reason
    },
    focus: publicArchitectureDesignConfirmedFocus(block.focusRevision.focusSnapshot),
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
            ? publicArchitectureDesignAssessmentSnapshot(block.assessment.assessmentSnapshot)
            : null,
          report: block.assessment.report
            ? architectureDesignAssessmentReportSchema.parse(block.assessment.report.reportSnapshot)
            : null,
          transcript: block.assessment.report
            ? architectureDesignSafeTranscriptSchema.parse(
                block.assessment.report.transcriptSnapshot
              )
            : null
        }
      : null
  };
}

function publicQuestion(question: QuestionRead) {
  const frozen = architectureDesignQuestionSchema.parse(question.privateSnapshot);
  const snapshot = publicArchitectureDesignQuestionSchema.parse(question.publicSnapshot);
  const attempted = question.attempts.length > 0;
  const answerAuthorized = attempted || question.status === ArchitectureQuestionStatus.LEARNED;
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
      transferConnection: answerAuthorized ? frozen.transferConnection : undefined
    },
    draft: parseDraft(question.state?.draft),
    revealedHints: Array.from({ length: hintCount }, (_, index) =>
      revealArchitectureDesignHint(frozen, (index + 1) as 1 | 2 | 3)
    ),
    authorizedAnswer: answerAuthorized
      ? architectureDesignAuthorizedAnswerSchema.parse(frozen.referenceAnswer)
      : null,
    latestAttempt: question.attempts[0] ? publicAttempt(question.attempts[0]) : null,
    completedAt: question.completedAt?.toISOString() ?? null,
    learnedAt: question.learnedAt?.toISOString() ?? null,
    updatedAt: question.updatedAt.toISOString()
  };
}

export type ArchitectureDesignPublicBlock = ReturnType<typeof publicBlock>;
export type ArchitectureDesignPublicQuestion = ReturnType<typeof publicQuestion>;

function publicAttempt(attempt: {
  id: string;
  requestId: string;
  evaluatorVersion: string;
  evaluatorFingerprint: string;
  answerSnapshot: Prisma.JsonValue;
  evaluationSnapshot: Prisma.JsonValue;
  verificationStatus: string;
  score: number | null;
  createdAt: Date;
}) {
  return {
    id: attempt.id,
    requestId: attempt.requestId,
    evaluatorVersion: attempt.evaluatorVersion,
    evaluatorFingerprint: attempt.evaluatorFingerprint,
    work: architectureDesignAttemptWorkSchema.parse(attempt.answerSnapshot),
    feedback: architectureDesignAttemptFeedbackSchema.parse(attempt.evaluationSnapshot),
    verificationStatus: attempt.verificationStatus,
    score: attempt.score,
    createdAt: attempt.createdAt.toISOString()
  };
}

function parseDraft(
  value: Prisma.JsonValue | null | undefined
): ArchitectureDesignDraftWork | null {
  return value === null || value === undefined
    ? null
    : architectureDesignDraftWorkSchema.parse(value);
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
        "ARCHITECTURE_DESIGN_ATTEMPT_REQUEST_CONFLICT",
        "This attempt request ID was already used for different work."
      )
  );
}

function assertWorkMatchesQuestion(
  rawQuestion: unknown,
  work: ArchitectureDesignDraftWork | ArchitectureDesignAttemptWork | null
) {
  if (work === null) return;
  const question = architectureDesignQuestionSchema.parse(rawQuestion);
  assertStoryPracticeWorkMatchesQuestion(
    question,
    work,
    {
      format: () =>
        new ConflictErrorException(
          "ARCHITECTURE_DESIGN_WORK_FORMAT",
          question.format === "mcq"
            ? "This question requires one selected choice."
            : "This question requires a written design response."
        ),
      choice: () =>
        new ConflictErrorException(
          "ARCHITECTURE_DESIGN_CHOICE_INVALID",
          "That answer choice does not exist."
        )
    },
    new Set()
  );
}

async function mutableQuestion(tx: Prisma.TransactionClient, ownerId: string, questionId: string) {
  const question = await tx.architectureBlockQuestion.findFirst({
    where: {
      id: questionId,
      ownerId,
      status: ArchitectureQuestionStatus.ACTIVE,
      block: { isCurrent: true, status: ArchitectureBlockStatus.PRACTISING }
    },
    select: { id: true, blockId: true, contentFingerprint: true, privateSnapshot: true }
  });
  if (!question) throw questionNotMutable();
  return question;
}

async function makeAssessmentReadyIfTerminal(
  tx: Prisma.TransactionClient,
  ownerId: string,
  blockId: string,
  now: () => Date
) {
  const activeCount = await tx.architectureBlockQuestion.count({
    where: { ownerId, blockId, status: ArchitectureQuestionStatus.ACTIVE }
  });
  if (activeCount > 0) return;
  const readyAt = now();
  const block = await tx.architectureBlock.findUnique({
    where: { id_ownerId: { id: blockId, ownerId } },
    select: { scenarioVersion: { select: { scenarioKey: true } } }
  });
  if (!block) throw questionNotFound();
  await tx.architectureBlock.update({
    where: { id_ownerId: { id: blockId, ownerId } },
    data: { status: ArchitectureBlockStatus.ASSESSMENT_READY, assessmentReadyAt: readyAt }
  });
  await tx.architectureAssessment.update({
    where: { blockId_ownerId: { blockId, ownerId } },
    data: { status: ArchitectureAssessmentStatus.READY, readyAt }
  });
  await tx.architectureScenarioProgress.update({
    where: {
      ownerId_scenarioKey: { ownerId, scenarioKey: block.scenarioVersion.scenarioKey }
    },
    data: { status: ArchitectureScenarioProgressStatus.ASSESSMENT_READY }
  });
}

function questionNotFound() {
  return new NotFoundErrorException(
    "ARCHITECTURE_DESIGN_QUESTION_NOT_FOUND",
    "Architecture & Design question not found."
  );
}

function blockNotFound() {
  return new NotFoundErrorException(
    "ARCHITECTURE_DESIGN_BLOCK_NOT_FOUND",
    "Architecture & Design block not found."
  );
}

function questionNotMutable() {
  return new ConflictErrorException(
    "ARCHITECTURE_DESIGN_QUESTION_READ_ONLY",
    "This Architecture & Design question is no longer active."
  );
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
