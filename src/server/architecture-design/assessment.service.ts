import {
  ArchitectureAssessmentStatus,
  ArchitectureBlockStatus,
  ArchitectureScenarioProgressStatus,
  Prisma
} from "@prisma/client";
import {
  architectureDesignAssessmentFinalizeInputSchema,
  architectureDesignAssessmentReportSchema,
  architectureDesignAssessmentSnapshotSchema,
  architectureDesignAssessmentStartInputSchema,
  architectureDesignSafeTranscriptSchema,
  publicArchitectureDesignAssessmentSnapshot
} from "@/lib/practice/architecture-design/assessment-contracts";
import { architectureDesignConfirmedFocusSchema } from "@/lib/practice/architecture-design/focus-ranking-contracts";
import { architectureDesignQuestionSchema } from "@/lib/practice/architecture-design/question-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import {
  assertStoryPracticeAssessmentResponses,
  storyPracticeAssessmentStartDisposition
} from "@/server/story-practice/assessment-orchestrator";
import {
  STORY_PRACTICE_TRANSACTION_OPTIONS as transactionOptions,
  storyPracticeFingerprint
} from "@/server/story-practice/practice-orchestrator";
import { buildArchitectureDesignAssessmentSnapshot } from "./assessment-blueprint";
import type { ArchitectureDesignAssessmentEvaluator } from "./assessment-evaluator";

const assessmentReadSelect = {
  id: true,
  blockId: true,
  status: true,
  schemaVersion: true,
  evaluatorVersion: true,
  evaluatorFingerprint: true,
  assessmentSnapshot: true,
  readyAt: true,
  startedAt: true,
  completedAt: true,
  report: {
    select: { reportSnapshot: true, transcriptSnapshot: true, finalizedAt: true }
  }
} satisfies Prisma.ArchitectureAssessmentSelect;

export class ArchitectureDesignAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: Pick<ArchitectureDesignAssessmentEvaluator, "evaluate">,
    private readonly now: () => Date = () => new Date()
  ) {}

  async read(ownerId: string, assessmentId: string) {
    const assessment = await this.prisma.architectureAssessment.findFirst({
      where: { id: assessmentId, ownerId },
      select: assessmentReadSelect
    });
    if (!assessment) throw assessmentNotFound();
    return publicAssessment(assessment);
  }

  async start(ownerId: string, rawInput: unknown, options: { allowLocked?: boolean } = {}) {
    const input = architectureDesignAssessmentStartInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.architectureAssessment.findFirst({
        where: { id: input.assessmentId, ownerId },
        select: {
          id: true,
          status: true,
          assessmentSnapshot: true,
          block: {
            select: {
              id: true,
              isCurrent: true,
              contentFingerprint: true,
              selectionSnapshot: true,
              scenarioVersion: { select: { scenarioKey: true } },
              questions: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  order: true,
                  status: true,
                  contentFingerprint: true,
                  privateSnapshot: true
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
            "ARCHITECTURE_DESIGN_ASSESSMENT_HISTORICAL",
            "Historical Architecture & Design assessments are read-only."
          ),
        locked: () =>
          new ConflictErrorException(
            "ARCHITECTURE_DESIGN_ASSESSMENT_LOCKED",
            "Complete or Learn every design question before starting the assessment."
          )
      });
      if (disposition === "replay") return;
      const earlyStart = disposition === "start-early";
      const startedAt = this.now();
      if (earlyStart) {
        await tx.architectureBlockQuestion.updateMany({
          where: { blockId: assessment.block.id, ownerId, status: "ACTIVE" },
          data: { status: "LEARNED", learnedAt: startedAt }
        });
      }
      const questions = earlyStart
        ? assessment.block.questions.map((question) => ({
            ...question,
            status: question.status === "ACTIVE" ? ("LEARNED" as const) : question.status
          }))
        : assessment.block.questions;
      const snapshot = assessment.assessmentSnapshot
        ? architectureDesignAssessmentSnapshotSchema.parse(assessment.assessmentSnapshot)
        : buildArchitectureDesignAssessmentSnapshot({
            blockContentFingerprint: assessment.block.contentFingerprint,
            selectionSnapshot: assessment.block.selectionSnapshot,
            questions,
            preparedAt: startedAt
          });
      await Promise.all([
        tx.architectureAssessment.update({
          where: { id_ownerId: { id: input.assessmentId, ownerId } },
          data: {
            status: ArchitectureAssessmentStatus.IN_PROGRESS,
            startRequestId: input.requestId,
            ...(earlyStart ? { readyAt: startedAt } : {}),
            startedAt,
            assessmentSnapshot: toJson(snapshot)
          }
        }),
        tx.architectureBlock.update({
          where: { id_ownerId: { id: assessment.block.id, ownerId } },
          data: { status: ArchitectureBlockStatus.ASSESSMENT_IN_PROGRESS }
        }),
        tx.architectureScenarioProgress.update({
          where: {
            ownerId_scenarioKey: {
              ownerId,
              scenarioKey: assessment.block.scenarioVersion.scenarioKey
            }
          },
          data: { status: ArchitectureScenarioProgressStatus.ASSESSMENT_IN_PROGRESS }
        })
      ]);
    }, transactionOptions);
    return this.read(ownerId, input.assessmentId);
  }

  async finalize(ownerId: string, rawInput: unknown) {
    const input = architectureDesignAssessmentFinalizeInputSchema.parse(rawInput);
    const responseFingerprint = storyPracticeFingerprint(input.responses);
    const phase = await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.architectureAssessment.findFirst({
        where: { id: input.assessmentId, ownerId },
        select: {
          status: true,
          finalizationRequestId: true,
          assessmentSnapshot: true,
          report: { select: { id: true } },
          block: { select: { isCurrent: true } }
        }
      });
      if (!assessment) throw assessmentNotFound();
      if (assessment.status === ArchitectureAssessmentStatus.COMPLETED && assessment.report) {
        if (assessment.finalizationRequestId === input.requestId) {
          const snapshot = architectureDesignAssessmentSnapshotSchema.parse(
            assessment.assessmentSnapshot
          );
          if (snapshot.submission?.responseFingerprint !== responseFingerprint) {
            throw finalizationConflict();
          }
        }
        return { completed: true as const };
      }
      if (!assessment.block.isCurrent) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_ASSESSMENT_HISTORICAL",
          "Historical Architecture & Design assessments are read-only."
        );
      }
      if (
        assessment.status === ArchitectureAssessmentStatus.LOCKED ||
        assessment.status === ArchitectureAssessmentStatus.READY
      ) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_ASSESSMENT_NOT_STARTED",
          "Start the Architecture & Design assessment before submitting it."
        );
      }
      if (
        assessment.status === ArchitectureAssessmentStatus.FINALIZING &&
        assessment.finalizationRequestId !== input.requestId
      ) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_ASSESSMENT_FINALIZING",
          "This assessment is already being finalized."
        );
      }
      const snapshot = architectureDesignAssessmentSnapshotSchema.parse(
        assessment.assessmentSnapshot
      );
      assertResponses(snapshot, input.responses);
      if (snapshot.submission && snapshot.submission.responseFingerprint !== responseFingerprint) {
        throw finalizationConflict();
      }
      const submittedAt = this.now();
      const withSubmission = architectureDesignAssessmentSnapshotSchema.parse({
        ...snapshot,
        submission: snapshot.submission ?? {
          requestId: input.requestId,
          responseFingerprint,
          responses: input.responses,
          submittedAt: submittedAt.toISOString()
        }
      });
      await tx.architectureAssessment.update({
        where: { id_ownerId: { id: input.assessmentId, ownerId } },
        data: {
          status: ArchitectureAssessmentStatus.FINALIZING,
          finalizationRequestId: input.requestId,
          assessmentSnapshot: toJson(withSubmission)
        }
      });
      return { completed: false as const, snapshot: withSubmission };
    }, transactionOptions);
    if (phase.completed) return this.read(ownerId, input.assessmentId);

    const evidence = await this.loadEvidence(ownerId, input.assessmentId);
    const finalizedAt = this.now();
    let evaluated: Awaited<ReturnType<ArchitectureDesignAssessmentEvaluator["evaluate"]>>;
    try {
      evaluated = await this.evaluator.evaluate({
        assessmentId: input.assessmentId,
        blockId: evidence.block.id,
        scenarioKey: evidence.block.scenarioVersion.scenarioKey,
        focus: architectureDesignConfirmedFocusSchema.parse(
          evidence.block.focusRevision.focusSnapshot
        ),
        snapshot: phase.snapshot,
        responses: phase.snapshot.submission!.responses,
        questions: evidence.block.questions,
        priorScenarioKeys: evidence.history.map((block) => block.scenarioVersion.scenarioKey),
        priorTopicKeys: evidence.history.flatMap((block) =>
          block.questions.flatMap(
            (question) => architectureDesignQuestionSchema.parse(question.privateSnapshot).topicKeys
          )
        ),
        finalizedAt
      });
    } catch (error) {
      throw new ServiceUnavailableErrorException(
        "ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATION_FAILED",
        "Your assessment answers are safe, but the report could not be completed. Try again.",
        { retryable: true, cause: error instanceof Error ? error.name : "unknown" }
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.architectureAssessment.findFirst({
        where: { id: input.assessmentId, ownerId },
        select: {
          blockId: true,
          status: true,
          finalizationRequestId: true,
          report: { select: { id: true } },
          block: { select: { scenarioVersion: { select: { scenarioKey: true } } } }
        }
      });
      if (!assessment) throw assessmentNotFound();
      if (assessment.report) return;
      if (
        assessment.status !== ArchitectureAssessmentStatus.FINALIZING ||
        assessment.finalizationRequestId !== input.requestId
      ) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_FINALIZATION_STALE",
          "This assessment finalization is no longer current."
        );
      }
      await tx.architectureAssessmentReport.create({
        data: {
          assessmentId: input.assessmentId,
          ownerId,
          schemaVersion: 1,
          evaluatorVersion: evaluated.report.evaluatorVersion,
          evaluatorFingerprint: evaluated.report.evaluationFingerprint,
          reportSnapshot: toJson(evaluated.report),
          transcriptSnapshot: toJson(evaluated.transcript),
          finalizedAt
        }
      });
      await Promise.all([
        tx.architectureAssessment.update({
          where: { id_ownerId: { id: input.assessmentId, ownerId } },
          data: { status: ArchitectureAssessmentStatus.COMPLETED, completedAt: finalizedAt }
        }),
        tx.architectureBlock.update({
          where: { id_ownerId: { id: assessment.blockId, ownerId } },
          data: { status: ArchitectureBlockStatus.ASSESSED, assessedAt: finalizedAt }
        }),
        tx.architectureScenarioProgress.update({
          where: {
            ownerId_scenarioKey: {
              ownerId,
              scenarioKey: assessment.block.scenarioVersion.scenarioKey
            }
          },
          data: { status: ArchitectureScenarioProgressStatus.ASSESSED, assessedAt: finalizedAt }
        })
      ]);
    }, transactionOptions);
    return this.read(ownerId, input.assessmentId);
  }

  private async loadEvidence(ownerId: string, assessmentId: string) {
    const assessment = await this.prisma.architectureAssessment.findFirst({
      where: { id: assessmentId, ownerId },
      select: {
        block: {
          select: {
            id: true,
            ordinal: true,
            focusRevision: { select: { focusSnapshot: true } },
            scenarioVersion: { select: { scenarioKey: true } },
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
                }
              }
            }
          }
        }
      }
    });
    if (!assessment) throw assessmentNotFound();
    const history = await this.prisma.architectureBlock.findMany({
      where: { ownerId, ordinal: { lte: assessment.block.ordinal } },
      orderBy: { ordinal: "asc" },
      select: {
        scenarioVersion: { select: { scenarioKey: true } },
        questions: { select: { privateSnapshot: true } }
      }
    });
    return { block: assessment.block, history };
  }
}

function publicAssessment(
  assessment: Prisma.ArchitectureAssessmentGetPayload<{ select: typeof assessmentReadSelect }>
) {
  return {
    id: assessment.id,
    blockId: assessment.blockId,
    status: assessment.status,
    schemaVersion: assessment.schemaVersion,
    evaluatorVersion: assessment.evaluatorVersion,
    evaluatorFingerprint: assessment.evaluatorFingerprint,
    readyAt: assessment.readyAt?.toISOString() ?? null,
    startedAt: assessment.startedAt?.toISOString() ?? null,
    completedAt: assessment.completedAt?.toISOString() ?? null,
    assessment: assessment.assessmentSnapshot
      ? publicArchitectureDesignAssessmentSnapshot(assessment.assessmentSnapshot)
      : null,
    report: assessment.report
      ? architectureDesignAssessmentReportSchema.parse(assessment.report.reportSnapshot)
      : null,
    transcript: assessment.report
      ? architectureDesignSafeTranscriptSchema.parse(assessment.report.transcriptSnapshot)
      : null
  };
}

function assertResponses(
  snapshot: ReturnType<typeof architectureDesignAssessmentSnapshotSchema.parse>,
  responses: Array<{ promptId: string }>
) {
  assertStoryPracticeAssessmentResponses(
    snapshot.prompts.map(({ id }) => id),
    responses,
    () =>
      new ConflictErrorException(
        "ARCHITECTURE_DESIGN_ASSESSMENT_RESPONSE_MISMATCH",
        "Submit exactly one answer for each frozen assessment prompt."
      )
  );
}

function finalizationConflict() {
  return new ConflictErrorException(
    "ARCHITECTURE_DESIGN_FINALIZATION_REQUEST_CONFLICT",
    "This finalization request ID was already used for different answers."
  );
}

function assessmentNotFound() {
  return new NotFoundErrorException(
    "ARCHITECTURE_DESIGN_ASSESSMENT_NOT_FOUND",
    "Architecture & Design assessment not found."
  );
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lockAssessment(tx: Prisma.TransactionClient, assessmentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`architecture-design-assessment:${assessmentId}`}))`;
}
