import { lockAiMlPracticeOwner } from "./cohort-lock";
import {
  AiMlPracticeQuestionStatus,
  AiMlPracticeSessionStatus,
  AiMlPracticeTrack as DatabaseTrack,
  Prisma
} from "@prisma/client";
import { z } from "zod";
import {
  aiMlPracticeSession,
  type AiMlPracticePublicQuestion,
  type AiMlPracticePublicSession,
  type PersistedAiMlPracticeTrack
} from "@/features/practice/ai-ml/domain/ai-ml-practice";
import { aiMlPracticeQuestionCount } from "@/features/practice/ai-ml/domain/ai-ml-story-catalog";
import { storyPracticeFingerprint } from "@/features/practice/shared/server/practice-orchestrator";
import { BadRequestErrorException } from "@/server/common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";

const SCHEMA_VERSION = 1;
const CONTENT_VERSION = 2;

const publicQuestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2)
});

const privateQuestionSchema = z.object({
  correctOptionId: z.string().min(1),
  explanation: z.string().min(1)
});

export const aiMlPracticeAnswerSchema = z
  .object({
    requestId: z.string().uuid(),
    track: z.enum(["core-technical", "applied-engineering"]),
    questionId: z.string().uuid(),
    optionId: z.string().min(1).max(120)
  })
  .strict();

export type AiMlPracticeAnswerInput = z.infer<typeof aiMlPracticeAnswerSchema>;

type SessionRecord = Prisma.AiMlPracticeSessionGetPayload<{
  include: { questions: { include: { attempt: true } } };
}>;

export type AiMlPracticeSummary = {
  track: PersistedAiMlPracticeTrack;
  totalQuestions: number;
  completedQuestions: number;
  progressPercent: number;
};

/** Server-owned AI/ML cohorts with frozen content and idempotent attempts. */
export class AiMlPracticeService {
  constructor(private readonly prisma: PrismaService) {}

  async session(
    ownerId: string,
    track: PersistedAiMlPracticeTrack
  ): Promise<AiMlPracticePublicSession> {
    const existing = await this.load(ownerId, track);
    if (existing) return publicSession(existing);

    const authored = aiMlPracticeSession(track);
    const contentFingerprint = storyPracticeFingerprint(authored);
    try {
      const created = await this.prisma.aiMlPracticeSession.create({
        data: {
          ownerId,
          track: databaseTrack(track),
          schemaVersion: SCHEMA_VERSION,
          contentVersion: CONTENT_VERSION,
          contentFingerprint,
          titleSnapshot: authored.title,
          descriptionSnapshot: authored.description,
          questions: {
            create: authored.questions.map((question, index) => {
              const publicSnapshot = {
                id: question.id,
                title: question.title,
                prompt: question.prompt,
                options: question.options
              };
              const privateSnapshot = {
                correctOptionId: question.correctOptionId,
                explanation: question.explanation
              };
              return {
                questionKey: question.id,
                order: index + 1,
                contentVersion: CONTENT_VERSION,
                contentFingerprint: storyPracticeFingerprint({ publicSnapshot, privateSnapshot }),
                publicSnapshot: json(publicSnapshot),
                privateSnapshot: json(privateSnapshot)
              } satisfies Prisma.AiMlPracticeQuestionUncheckedCreateWithoutSessionInput;
            })
          }
        },
        include: { questions: { include: { attempt: true }, orderBy: { order: "asc" } } }
      });
      return publicSession(created);
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const winner = await this.load(ownerId, track);
      if (!winner) throw error;
      return publicSession(winner);
    }
  }

  async answer(ownerId: string, rawInput: AiMlPracticeAnswerInput) {
    const input = aiMlPracticeAnswerSchema.parse(rawInput);
    await this.session(ownerId, input.track);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await lockAiMlPracticeOwner(transaction, ownerId);
        const question = await transaction.aiMlPracticeQuestion.findFirst({
          where: {
            id: input.questionId,
            ownerId,
            session: { track: databaseTrack(input.track) }
          },
          include: { attempt: true }
        });
        if (!question) {
          throw new NotFoundErrorException(
            "AI_ML_PRACTICE_QUESTION_NOT_FOUND",
            "That AI/ML practice question could not be found."
          );
        }
        if (question.attempt) {
          if (question.attempt.selectedOptionId !== input.optionId) {
            throw new ConflictErrorException(
              "AI_ML_PRACTICE_ALREADY_ANSWERED",
              "This AI/ML practice question already has a saved answer."
            );
          }
          return;
        }

        if (question.status !== AiMlPracticeQuestionStatus.ACTIVE) {
          throw new ConflictErrorException(
            "AI_ML_PRACTICE_QUESTION_CLOSED",
            "This question has already been completed or learned."
          );
        }

        // This endpoint remains for the original MCQ client. Rich AI/ML
        // questions must go through the story attempt endpoint and its rubric.
        const snapshot = question.publicSnapshot as { format?: string };
        if (snapshot.format && snapshot.format !== "mcq") {
          throw new BadRequestErrorException(
            "AI_ML_STORY_ANSWER_REQUIRED",
            "This question requires an evidence-based written answer."
          );
        }
        const publicQuestion = publicQuestionSchema.parse(question.publicSnapshot);
        const privateQuestion = privateQuestionSchema.parse(question.privateSnapshot);
        if (!publicQuestion.options.some(({ id }) => id === input.optionId)) {
          throw new BadRequestErrorException(
            "AI_ML_PRACTICE_OPTION_INVALID",
            "That answer option does not belong to this question."
          );
        }
        const correct = input.optionId === privateQuestion.correctOptionId;
        const completedAt = new Date();

        await transaction.aiMlPracticeAttempt.create({
          data: {
            ownerId,
            questionId: question.id,
            requestId: input.requestId,
            contentFingerprint: question.contentFingerprint,
            selectedOptionId: input.optionId,
            correct,
            answerSnapshot: json({ selectedOptionId: input.optionId }),
            evaluationSnapshot: json({
              evaluatorVersion: "ai-ml-deterministic-mcq-v1",
              correct,
              correctOptionId: privateQuestion.correctOptionId,
              explanation: privateQuestion.explanation
            })
          }
        });
        await transaction.aiMlPracticeQuestion.update({
          where: { id: question.id },
          data: { status: AiMlPracticeQuestionStatus.COMPLETED, completedAt }
        });
        const remaining = await transaction.aiMlPracticeQuestion.count({
          where: { sessionId: question.sessionId, status: AiMlPracticeQuestionStatus.ACTIVE }
        });
        if (remaining === 0) {
          await transaction.aiMlPracticeSession.update({
            where: { id: question.sessionId },
            data: { status: AiMlPracticeSessionStatus.COMPLETED, completedAt }
          });
        }
      });
    } catch (error) {
      // A repeated request or concurrent double-click resolves to the one
      // committed immutable attempt instead of creating duplicate evidence.
      if (!isUniqueConflict(error)) throw error;
      const [requestReplay, questionAttempt] = await Promise.all([
        this.prisma.aiMlPracticeAttempt.findUnique({
          where: { ownerId_requestId: { ownerId, requestId: input.requestId } }
        }),
        this.prisma.aiMlPracticeAttempt.findUnique({ where: { questionId: input.questionId } })
      ]);
      const committed = requestReplay ?? questionAttempt;
      if (
        !committed ||
        committed.ownerId !== ownerId ||
        committed.questionId !== input.questionId ||
        committed.selectedOptionId !== input.optionId
      ) {
        throw new ConflictErrorException(
          "AI_ML_PRACTICE_ATTEMPT_CONFLICT",
          "That answer request conflicts with an existing saved attempt."
        );
      }
    }

    return this.session(ownerId, input.track);
  }

  async summaries(ownerId: string): Promise<AiMlPracticeSummary[]> {
    const sessions = await this.prisma.aiMlPracticeSession.findMany({
      where: { ownerId },
      include: { questions: { select: { status: true } } }
    });
    return sessions.map((session) => {
      const track = applicationTrack(session.track);
      const totalQuestions = Math.max(session.questions.length, aiMlPracticeQuestionCount(track));
      const completedQuestions = session.questions.filter(
        ({ status }) => status !== AiMlPracticeQuestionStatus.ACTIVE
      ).length;
      return {
        track,
        totalQuestions,
        completedQuestions,
        progressPercent: totalQuestions
          ? Math.round((completedQuestions / totalQuestions) * 100)
          : 0
      };
    });
  }

  private load(ownerId: string, track: PersistedAiMlPracticeTrack) {
    return this.prisma.aiMlPracticeSession.findUnique({
      where: { ownerId_track: { ownerId, track: databaseTrack(track) } },
      include: { questions: { include: { attempt: true }, orderBy: { order: "asc" } } }
    });
  }
}

function publicSession(session: SessionRecord): AiMlPracticePublicSession {
  // This compatibility projection serves the original eight-question cohort.
  // The richer story paths share the same session but have different frozen
  // snapshot shapes; their public view is owned by AiMlStoryPracticeService.
  const questions: AiMlPracticePublicQuestion[] = session.questions
    .filter((question) => question.order <= 8)
    .map((question) => {
      const publicSnapshot = publicQuestionSchema.parse(question.publicSnapshot);
      const privateSnapshot = question.attempt
        ? privateQuestionSchema.parse(question.privateSnapshot)
        : null;
      return {
        ...publicSnapshot,
        databaseId: question.id,
        selectedOptionId: question.attempt?.selectedOptionId ?? null,
        ...(privateSnapshot ? { correctOptionId: privateSnapshot.correctOptionId } : {}),
        correct: question.attempt?.correct ?? null,
        explanation: privateSnapshot?.explanation ?? null
      };
    });
  const completedQuestions = questions.filter(({ selectedOptionId }) => selectedOptionId).length;
  return {
    id: session.id,
    track: applicationTrack(session.track),
    eyebrow:
      session.track === DatabaseTrack.CORE_TECHNICAL
        ? "AI/ML · Core Technical"
        : "AI/ML · Applied Engineering",
    title: session.titleSnapshot,
    description: session.descriptionSnapshot,
    status: session.status,
    questions,
    completedQuestions,
    progressPercent: Math.round((completedQuestions / questions.length) * 100)
  };
}

function databaseTrack(track: PersistedAiMlPracticeTrack): DatabaseTrack {
  return track === "core-technical"
    ? DatabaseTrack.CORE_TECHNICAL
    : DatabaseTrack.APPLIED_ENGINEERING;
}

function applicationTrack(track: DatabaseTrack): PersistedAiMlPracticeTrack {
  return track === DatabaseTrack.CORE_TECHNICAL ? "core-technical" : "applied-engineering";
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
