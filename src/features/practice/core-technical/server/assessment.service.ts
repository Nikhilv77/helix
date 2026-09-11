import {
  CoreTechnicalAssessmentStatus,
  CoreTechnicalBlockStatus,
  CoreTechnicalStoryProgressStatus,
  Prisma
} from "@prisma/client";
import {
  CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION,
  coreTechnicalAssessmentFinalizeInputSchema,
  coreTechnicalAssessmentReportSchema,
  coreTechnicalAssessmentSnapshotSchema,
  coreTechnicalAssessmentStartInputSchema,
  coreTechnicalSafeTranscriptSchema,
  publicCoreTechnicalAssessmentSnapshot
} from "@/features/practice/core-technical/domain/assessment-contracts";
import { coreTechnicalConfirmedFocusSchema } from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { generatedQuestionCandidateSchema } from "@/features/practice/core-technical/domain/question-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import type { InterviewState } from "@/features/interviews/server/types";
import {
  assertStoryPracticeAssessmentResponses,
  storyPracticeAssessmentStartDisposition
} from "@/features/practice/shared/server/assessment-orchestrator";
import {
  STORY_PRACTICE_TRANSACTION_OPTIONS as transactionOptions,
  storyPracticeFingerprint as fingerprint
} from "@/features/practice/shared/server/practice-orchestrator";
import { buildCoreTechnicalAssessmentSnapshot } from "./assessment-blueprint";
import type { CoreTechnicalAssessmentEvaluator } from "./assessment-evaluator";

const assessmentReadSelect = {
  id: true,
  blockId: true,
  status: true,
  schemaVersion: true,
  evaluatorVersion: true,
  assessmentSnapshot: true,
  readyAt: true,
  startedAt: true,
  completedAt: true,
  report: {
    select: {
      reportSnapshot: true,
      transcriptSnapshot: true,
      finalizedAt: true
    }
  }
} satisfies Prisma.CoreTechnicalAssessmentSelect;

export class CoreTechnicalAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: Pick<CoreTechnicalAssessmentEvaluator, "evaluate">,
    private readonly now: () => Date = () => new Date()
  ) {}

  async read(ownerId: string, assessmentId: string) {
    const assessment = await this.prisma.coreTechnicalAssessment.findFirst({
      where: { id: assessmentId, ownerId },
      select: assessmentReadSelect
    });
    if (!assessment) throw assessmentNotFound();
    return publicAssessment(assessment);
  }

  async start(ownerId: string, rawInput: unknown, options: { allowLocked?: boolean } = {}) {
    const input = coreTechnicalAssessmentStartInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.coreTechnicalAssessment.findFirst({
        where: { id: input.assessmentId, ownerId },
        select: {
          id: true,
          status: true,
          assessmentSnapshot: true,
          block: {
            select: {
              id: true,
              isCurrent: true,
              status: true,
              contentFingerprint: true,
              storySnapshot: true,
              storyVersion: { select: { storyKey: true } },
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
          }
        }
      });
      if (!assessment) throw assessmentNotFound();
      const disposition = storyPracticeAssessmentStartDisposition({
        status: assessment.status,
        isCurrent: assessment.block.isCurrent,
        allowLocked: options.allowLocked === true,
        historical: () =>
          new ConflictErrorException(
            "CORE_TECHNICAL_ASSESSMENT_HISTORICAL",
            "Historical Core Technical assessments are read-only."
          ),
        locked: () =>
          new ConflictErrorException(
            "CORE_TECHNICAL_ASSESSMENT_LOCKED",
            "Complete or Learn every practice-path question before starting the assessment."
          )
      });
      if (disposition === "replay") return;
      const earlyStart = disposition === "start-early";

      const startedAt = this.now();
      if (earlyStart) {
        await tx.coreTechnicalBlockQuestion.updateMany({
          where: {
            blockId: assessment.block.id,
            ownerId,
            status: "ACTIVE"
          },
          data: { status: "LEARNED", learnedAt: startedAt }
        });
      }
      const assessmentQuestions = earlyStart
        ? assessment.block.questions.map((question) => ({
            ...question,
            status: question.status === "ACTIVE" ? ("LEARNED" as const) : question.status
          }))
        : assessment.block.questions;
      const snapshot = assessment.assessmentSnapshot
        ? coreTechnicalAssessmentSnapshotSchema.parse(assessment.assessmentSnapshot)
        : buildCoreTechnicalAssessmentSnapshot({
            blockContentFingerprint: assessment.block.contentFingerprint,
            storySnapshot: assessment.block.storySnapshot,
            questions: assessmentQuestions,
            preparedAt: startedAt
          });
      await Promise.all([
        tx.coreTechnicalAssessment.update({
          where: { id_ownerId: { id: input.assessmentId, ownerId } },
          data: {
            status: CoreTechnicalAssessmentStatus.IN_PROGRESS,
            startRequestId: input.requestId,
            ...(earlyStart ? { readyAt: startedAt } : {}),
            startedAt,
            assessmentSnapshot: toJson(snapshot)
          }
        }),
        tx.coreTechnicalBlock.update({
          where: { id_ownerId: { id: assessment.block.id, ownerId } },
          data: { status: CoreTechnicalBlockStatus.ASSESSMENT_IN_PROGRESS }
        }),
        tx.coreTechnicalStoryProgress.update({
          where: {
            ownerId_storyKey: { ownerId, storyKey: assessment.block.storyVersion.storyKey }
          },
          data: { status: CoreTechnicalStoryProgressStatus.ASSESSMENT_IN_PROGRESS }
        })
      ]);
    }, transactionOptions);
    return this.read(ownerId, input.assessmentId);
  }

  async finalize(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalAssessmentFinalizeInputSchema.parse(rawInput);
    const responseFingerprint = fingerprint(input.responses);
    const phase = await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.coreTechnicalAssessment.findFirst({
        where: { id: input.assessmentId, ownerId },
        select: {
          id: true,
          blockId: true,
          status: true,
          finalizationRequestId: true,
          assessmentSnapshot: true,
          report: { select: { id: true } },
          block: { select: { isCurrent: true } }
        }
      });
      if (!assessment) throw assessmentNotFound();
      if (assessment.status === CoreTechnicalAssessmentStatus.COMPLETED && assessment.report) {
        if (assessment.finalizationRequestId === input.requestId) {
          const snapshot = coreTechnicalAssessmentSnapshotSchema.parse(
            assessment.assessmentSnapshot
          );
          if (snapshot.submission?.responseFingerprint !== responseFingerprint) {
            throw new ConflictErrorException(
              "CORE_TECHNICAL_FINALIZATION_REQUEST_CONFLICT",
              "This finalization request ID was already used for different answers."
            );
          }
        }
        return { completed: true as const };
      }
      if (!assessment.block.isCurrent) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_ASSESSMENT_HISTORICAL",
          "Historical Core Technical assessments are read-only."
        );
      }
      if (
        assessment.status === CoreTechnicalAssessmentStatus.LOCKED ||
        assessment.status === CoreTechnicalAssessmentStatus.READY
      ) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_ASSESSMENT_NOT_STARTED",
          "Start the Core Technical assessment before submitting it."
        );
      }
      if (
        assessment.status === CoreTechnicalAssessmentStatus.FINALIZING &&
        assessment.finalizationRequestId !== input.requestId
      ) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_ASSESSMENT_FINALIZING",
          "This assessment is already being finalized."
        );
      }
      const snapshot = coreTechnicalAssessmentSnapshotSchema.parse(assessment.assessmentSnapshot);
      assertResponses(snapshot, input.responses);
      if (snapshot.submission && snapshot.submission.responseFingerprint !== responseFingerprint) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_FINALIZATION_REQUEST_CONFLICT",
          "This finalization request ID was already used for different answers."
        );
      }
      const submittedAt = this.now();
      const withSubmission = coreTechnicalAssessmentSnapshotSchema.parse({
        ...snapshot,
        submission: snapshot.submission ?? {
          requestId: input.requestId,
          responseFingerprint,
          responses: input.responses,
          submittedAt: submittedAt.toISOString()
        }
      });
      await tx.coreTechnicalAssessment.update({
        where: { id_ownerId: { id: input.assessmentId, ownerId } },
        data: {
          status: CoreTechnicalAssessmentStatus.FINALIZING,
          finalizationRequestId: input.requestId,
          assessmentSnapshot: toJson(withSubmission)
        }
      });
      return { completed: false as const, snapshot: withSubmission };
    }, transactionOptions);
    if (phase.completed) return this.read(ownerId, input.assessmentId);

    const evidence = await this.loadEvidence(ownerId, input.assessmentId);
    const finalizedAt = this.now();
    let evaluated;
    try {
      evaluated = await this.evaluator.evaluate({
        assessmentId: input.assessmentId,
        blockId: evidence.block.id,
        storyKey: evidence.block.storyVersion.storyKey,
        focus: coreTechnicalConfirmedFocusSchema.parse(evidence.block.focusRevision.focusSnapshot),
        snapshot: phase.snapshot,
        responses: phase.snapshot.submission!.responses,
        questions: evidence.block.questions,
        priorStoryKeys: evidence.history.map((block) => block.storyVersion.storyKey),
        priorTopicKeys: evidence.history.flatMap((block) =>
          block.questions.flatMap(
            (question) => generatedQuestionCandidateSchema.parse(question.privateSnapshot).topicKeys
          )
        ),
        finalizedAt
      });
    } catch (error) {
      throw new ServiceUnavailableErrorException(
        "CORE_TECHNICAL_ASSESSMENT_EVALUATION_FAILED",
        "Your assessment answers are safe, but the report could not be completed. Try again.",
        { retryable: true, cause: error instanceof Error ? error.name : "unknown" }
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.coreTechnicalAssessment.findFirst({
        where: { id: input.assessmentId, ownerId },
        select: {
          blockId: true,
          status: true,
          finalizationRequestId: true,
          report: { select: { id: true } },
          block: { select: { storyVersion: { select: { storyKey: true } } } }
        }
      });
      if (!assessment) throw assessmentNotFound();
      if (assessment.report) return;
      if (
        assessment.status !== CoreTechnicalAssessmentStatus.FINALIZING ||
        assessment.finalizationRequestId !== input.requestId
      ) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_FINALIZATION_STALE",
          "This assessment finalization is no longer current."
        );
      }
      await tx.coreTechnicalAssessmentReport.create({
        data: {
          assessmentId: input.assessmentId,
          ownerId,
          schemaVersion: 1,
          evaluatorVersion: CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION,
          reportSnapshot: toJson(evaluated.report),
          transcriptSnapshot: toJson(evaluated.transcript),
          finalizedAt
        }
      });
      await Promise.all([
        tx.coreTechnicalAssessment.update({
          where: { id_ownerId: { id: input.assessmentId, ownerId } },
          data: { status: CoreTechnicalAssessmentStatus.COMPLETED, completedAt: finalizedAt }
        }),
        tx.coreTechnicalBlock.update({
          where: { id_ownerId: { id: assessment.blockId, ownerId } },
          data: { status: CoreTechnicalBlockStatus.ASSESSED, assessedAt: finalizedAt }
        }),
        tx.coreTechnicalStoryProgress.update({
          where: {
            ownerId_storyKey: { ownerId, storyKey: assessment.block.storyVersion.storyKey }
          },
          data: { status: CoreTechnicalStoryProgressStatus.ASSESSED, assessedAt: finalizedAt }
        })
      ]);
    }, transactionOptions);
    return this.read(ownerId, input.assessmentId);
  }

  /** Converts a completed shared voice-room transcript into the existing Core report contract. */
  async finalizeInterviewOwned(ownerId: string, sessionId: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id: sessionId, ownerId },
      select: { state: true }
    });
    const state = session?.state as unknown as InterviewState | undefined;
    const identity = state?.setup.coreTechnicalAssessment;
    if (!state || identity?.kind !== "core-technical-assessment") return null;
    if (state.id !== sessionId || identity.assessmentId !== sessionId || state.phase !== "done") {
      return null;
    }

    const assessment = await this.prisma.coreTechnicalAssessment.findFirst({
      where: { id: identity.assessmentId, ownerId },
      select: { blockId: true, assessmentSnapshot: true }
    });
    if (!assessment?.assessmentSnapshot || assessment.blockId !== identity.blockId) return null;
    const snapshot = coreTechnicalAssessmentSnapshotSchema.parse(assessment.assessmentSnapshot);
    const responses = coreTechnicalInterviewResponses(snapshot, state);
    if (responses.some((response) => response.answer.length === 0)) return null;

    return this.finalize(ownerId, {
      assessmentId: identity.assessmentId,
      // The durable room UUID is stable across retries and uniquely belongs to
      // this one assessment, so it is also the finalization idempotency key.
      requestId: sessionId,
      responses
    });
  }

  /** Agent-capability path used after the final spoken answer. */
  async finalizeInterviewBySession(sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { ownerId: true }
    });
    return session ? this.finalizeInterviewOwned(session.ownerId, sessionId) : null;
  }

  /** Repairs a completed room whose deferred report generation was interrupted. */
  async recoverCurrentInterview(ownerId: string) {
    const assessment = await this.prisma.coreTechnicalAssessment.findFirst({
      where: {
        ownerId,
        status: {
          in: [CoreTechnicalAssessmentStatus.IN_PROGRESS, CoreTechnicalAssessmentStatus.FINALIZING]
        },
        block: { isCurrent: true }
      },
      select: { id: true, status: true, assessmentSnapshot: true }
    });
    if (!assessment?.assessmentSnapshot) return null;
    const snapshot = coreTechnicalAssessmentSnapshotSchema.parse(assessment.assessmentSnapshot);
    if (assessment.status === CoreTechnicalAssessmentStatus.FINALIZING && snapshot.submission) {
      return this.finalize(ownerId, {
        assessmentId: assessment.id,
        requestId: snapshot.submission.requestId,
        responses: snapshot.submission.responses
      });
    }
    return this.finalizeInterviewOwned(ownerId, assessment.id);
  }

  private async loadEvidence(ownerId: string, assessmentId: string) {
    const assessment = await this.prisma.coreTechnicalAssessment.findFirst({
      where: { id: assessmentId, ownerId },
      select: {
        block: {
          select: {
            id: true,
            ordinal: true,
            focusRevision: { select: { focusSnapshot: true } },
            storyVersion: { select: { storyKey: true } },
            questions: {
              orderBy: { order: "asc" },
              select: {
                order: true,
                status: true,
                privateSnapshot: true,
                state: { select: { revealedHintCount: true } },
                attempts: {
                  orderBy: { createdAt: "desc" },
                  select: { score: true, verificationStatus: true }
                },
                codeRuns: { select: { passed: true } }
              }
            }
          }
        }
      }
    });
    if (!assessment) throw assessmentNotFound();
    const history = await this.prisma.coreTechnicalBlock.findMany({
      where: { ownerId, ordinal: { lte: assessment.block.ordinal } },
      orderBy: { ordinal: "asc" },
      select: {
        storyVersion: { select: { storyKey: true } },
        questions: { select: { privateSnapshot: true } }
      }
    });
    return { block: assessment.block, history };
  }
}

function publicAssessment(
  assessment: Prisma.CoreTechnicalAssessmentGetPayload<{
    select: typeof assessmentReadSelect;
  }>
) {
  return {
    id: assessment.id,
    blockId: assessment.blockId,
    status: assessment.status,
    schemaVersion: assessment.schemaVersion,
    evaluatorVersion: assessment.evaluatorVersion,
    readyAt: assessment.readyAt?.toISOString() ?? null,
    startedAt: assessment.startedAt?.toISOString() ?? null,
    completedAt: assessment.completedAt?.toISOString() ?? null,
    assessment: assessment.assessmentSnapshot
      ? publicCoreTechnicalAssessmentSnapshot(assessment.assessmentSnapshot)
      : null,
    report: assessment.report
      ? coreTechnicalAssessmentReportSchema.parse(assessment.report.reportSnapshot)
      : null,
    transcript: assessment.report
      ? coreTechnicalSafeTranscriptSchema.parse(assessment.report.transcriptSnapshot)
      : null
  };
}

function assertResponses(
  snapshot: ReturnType<typeof coreTechnicalAssessmentSnapshotSchema.parse>,
  responses: Array<{ promptId: string }>
) {
  assertStoryPracticeAssessmentResponses(
    snapshot.prompts.map(({ id }) => id),
    responses,
    () =>
      new ConflictErrorException(
        "CORE_TECHNICAL_ASSESSMENT_RESPONSE_MISMATCH",
        "Submit exactly one answer for each frozen assessment prompt."
      )
  );
}

function assessmentNotFound() {
  return new NotFoundErrorException(
    "CORE_TECHNICAL_ASSESSMENT_NOT_FOUND",
    "Core Technical assessment not found."
  );
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lockAssessment(tx: Prisma.TransactionClient, assessmentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`core-technical-assessment:${assessmentId}`}))`;
}

function boundedInterviewAnswer(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 4_000) return normalized;
  return normalized.slice(normalized.length - 4_000);
}

export function coreTechnicalInterviewResponses(
  snapshot: ReturnType<typeof coreTechnicalAssessmentSnapshotSchema.parse>,
  state: Pick<InterviewState, "turns">
) {
  return snapshot.prompts.map((prompt, index) => ({
    promptId: prompt.id,
    answer: boundedInterviewAnswer(
      state.turns
        .filter((turn) => turn.speaker === "user" && turn.questionIndex === index)
        .map((turn) => turn.text)
        .join("\n\n")
    )
  }));
}
