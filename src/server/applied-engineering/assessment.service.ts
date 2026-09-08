import { createHash } from "node:crypto";
import {
  AppliedEngineeringAssessmentStatus,
  AppliedEngineeringBlockStatus,
  AppliedEngineeringIncidentProgressStatus,
  Prisma
} from "@prisma/client";
import {
  APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION,
  appliedEngineeringAssessmentFinalizeInputSchema,
  appliedEngineeringAssessmentReportSchema,
  appliedEngineeringAssessmentSnapshotSchema,
  appliedEngineeringAssessmentStartInputSchema,
  appliedEngineeringSafeTranscriptSchema,
  publicAppliedEngineeringAssessmentSnapshot
} from "@/lib/practice/applied-engineering/assessment-contracts";
import { appliedEngineeringConfirmedFocusSchema } from "@/lib/practice/applied-engineering/focus-ranking-contracts";
import { appliedEngineeringQuestionSchema } from "@/lib/practice/applied-engineering/question-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import { buildAppliedEngineeringAssessmentSnapshot } from "./assessment-blueprint";
import type { AppliedEngineeringAssessmentEvaluator } from "./assessment-evaluator";

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
    select: { reportSnapshot: true, transcriptSnapshot: true, finalizedAt: true }
  }
} satisfies Prisma.AppliedEngineeringAssessmentSelect;

export class AppliedEngineeringAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: Pick<AppliedEngineeringAssessmentEvaluator, "evaluate">,
    private readonly now: () => Date = () => new Date()
  ) {}

  async read(ownerId: string, assessmentId: string) {
    const assessment = await this.prisma.appliedEngineeringAssessment.findFirst({
      where: { id: assessmentId, ownerId },
      select: assessmentReadSelect
    });
    if (!assessment) throw assessmentNotFound();
    return publicAssessment(assessment);
  }

  async start(ownerId: string, rawInput: unknown, options: { allowLocked?: boolean } = {}) {
    const input = appliedEngineeringAssessmentStartInputSchema.parse(rawInput);
    await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.appliedEngineeringAssessment.findFirst({
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
          }
        }
      });
      if (!assessment) throw assessmentNotFound();
      if (!assessment.block.isCurrent) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_ASSESSMENT_HISTORICAL",
          "Historical Applied Engineering assessments are read-only."
        );
      }
      const earlyStart =
        assessment.status === AppliedEngineeringAssessmentStatus.LOCKED &&
        options.allowLocked === true;
      if (assessment.status === AppliedEngineeringAssessmentStatus.LOCKED && !earlyStart) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_ASSESSMENT_LOCKED",
          "Complete or Learn every incident question before starting the assessment."
        );
      }
      if (
        assessment.status === AppliedEngineeringAssessmentStatus.IN_PROGRESS ||
        assessment.status === AppliedEngineeringAssessmentStatus.FINALIZING ||
        assessment.status === AppliedEngineeringAssessmentStatus.COMPLETED
      ) {
        return;
      }

      const startedAt = this.now();
      if (earlyStart) {
        await tx.appliedEngineeringBlockQuestion.updateMany({
          where: { blockId: assessment.block.id, ownerId, status: "ACTIVE" },
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
        ? appliedEngineeringAssessmentSnapshotSchema.parse(assessment.assessmentSnapshot)
        : buildAppliedEngineeringAssessmentSnapshot({
            blockContentFingerprint: assessment.block.contentFingerprint,
            selectionSnapshot: assessment.block.selectionSnapshot,
            questions: assessmentQuestions,
            preparedAt: startedAt
          });
      await Promise.all([
        tx.appliedEngineeringAssessment.update({
          where: { id_ownerId: { id: input.assessmentId, ownerId } },
          data: {
            status: AppliedEngineeringAssessmentStatus.IN_PROGRESS,
            startRequestId: input.requestId,
            ...(earlyStart ? { readyAt: startedAt } : {}),
            startedAt,
            assessmentSnapshot: toJson(snapshot)
          }
        }),
        tx.appliedEngineeringBlock.update({
          where: { id_ownerId: { id: assessment.block.id, ownerId } },
          data: { status: AppliedEngineeringBlockStatus.ASSESSMENT_IN_PROGRESS }
        }),
        tx.appliedEngineeringIncidentProgress.update({
          where: {
            ownerId_incidentKey: {
              ownerId,
              incidentKey: assessment.block.incidentVersion.incidentKey
            }
          },
          data: { status: AppliedEngineeringIncidentProgressStatus.ASSESSMENT_IN_PROGRESS }
        })
      ]);
    }, transactionOptions);
    return this.read(ownerId, input.assessmentId);
  }

  async finalize(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringAssessmentFinalizeInputSchema.parse(rawInput);
    const responseFingerprint = fingerprint(input.responses);
    const phase = await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.appliedEngineeringAssessment.findFirst({
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
      if (assessment.status === AppliedEngineeringAssessmentStatus.COMPLETED && assessment.report) {
        if (assessment.finalizationRequestId === input.requestId) {
          const snapshot = appliedEngineeringAssessmentSnapshotSchema.parse(
            assessment.assessmentSnapshot
          );
          if (snapshot.submission?.responseFingerprint !== responseFingerprint) {
            throw new ConflictErrorException(
              "APPLIED_ENGINEERING_FINALIZATION_REQUEST_CONFLICT",
              "This finalization request ID was already used for different answers."
            );
          }
        }
        return { completed: true as const };
      }
      if (!assessment.block.isCurrent) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_ASSESSMENT_HISTORICAL",
          "Historical Applied Engineering assessments are read-only."
        );
      }
      if (
        assessment.status === AppliedEngineeringAssessmentStatus.LOCKED ||
        assessment.status === AppliedEngineeringAssessmentStatus.READY
      ) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_ASSESSMENT_NOT_STARTED",
          "Start the Applied Engineering assessment before submitting it."
        );
      }
      if (
        assessment.status === AppliedEngineeringAssessmentStatus.FINALIZING &&
        assessment.finalizationRequestId !== input.requestId
      ) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_ASSESSMENT_FINALIZING",
          "This assessment is already being finalized."
        );
      }
      const snapshot = appliedEngineeringAssessmentSnapshotSchema.parse(
        assessment.assessmentSnapshot
      );
      assertResponses(snapshot, input.responses);
      if (snapshot.submission && snapshot.submission.responseFingerprint !== responseFingerprint) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_FINALIZATION_REQUEST_CONFLICT",
          "This finalization request ID was already used for different answers."
        );
      }
      const submittedAt = this.now();
      const withSubmission = appliedEngineeringAssessmentSnapshotSchema.parse({
        ...snapshot,
        submission: snapshot.submission ?? {
          requestId: input.requestId,
          responseFingerprint,
          responses: input.responses,
          submittedAt: submittedAt.toISOString()
        }
      });
      await tx.appliedEngineeringAssessment.update({
        where: { id_ownerId: { id: input.assessmentId, ownerId } },
        data: {
          status: AppliedEngineeringAssessmentStatus.FINALIZING,
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
        incidentKey: evidence.block.incidentVersion.incidentKey,
        focus: appliedEngineeringConfirmedFocusSchema.parse(
          evidence.block.focusRevision.focusSnapshot
        ),
        snapshot: phase.snapshot,
        responses: phase.snapshot.submission!.responses,
        questions: evidence.block.questions,
        priorIncidentKeys: evidence.history.map((block) => block.incidentVersion.incidentKey),
        priorTopicKeys: evidence.history.flatMap((block) =>
          block.questions.flatMap(
            (question) => appliedEngineeringQuestionSchema.parse(question.privateSnapshot).topicKeys
          )
        ),
        finalizedAt
      });
    } catch (error) {
      throw new ServiceUnavailableErrorException(
        "APPLIED_ENGINEERING_ASSESSMENT_EVALUATION_FAILED",
        "Your assessment answers are safe, but the report could not be completed. Try again.",
        { retryable: true, cause: error instanceof Error ? error.name : "unknown" }
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await lockAssessment(tx, input.assessmentId);
      const assessment = await tx.appliedEngineeringAssessment.findFirst({
        where: { id: input.assessmentId, ownerId },
        select: {
          blockId: true,
          status: true,
          finalizationRequestId: true,
          report: { select: { id: true } },
          block: { select: { incidentVersion: { select: { incidentKey: true } } } }
        }
      });
      if (!assessment) throw assessmentNotFound();
      if (assessment.report) return;
      if (
        assessment.status !== AppliedEngineeringAssessmentStatus.FINALIZING ||
        assessment.finalizationRequestId !== input.requestId
      ) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_FINALIZATION_STALE",
          "This assessment finalization is no longer current."
        );
      }
      await tx.appliedEngineeringAssessmentReport.create({
        data: {
          assessmentId: input.assessmentId,
          ownerId,
          schemaVersion: 1,
          evaluatorVersion: APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION,
          reportSnapshot: toJson(evaluated.report),
          transcriptSnapshot: toJson(evaluated.transcript),
          finalizedAt
        }
      });
      await Promise.all([
        tx.appliedEngineeringAssessment.update({
          where: { id_ownerId: { id: input.assessmentId, ownerId } },
          data: { status: AppliedEngineeringAssessmentStatus.COMPLETED, completedAt: finalizedAt }
        }),
        tx.appliedEngineeringBlock.update({
          where: { id_ownerId: { id: assessment.blockId, ownerId } },
          data: { status: AppliedEngineeringBlockStatus.ASSESSED, assessedAt: finalizedAt }
        }),
        tx.appliedEngineeringIncidentProgress.update({
          where: {
            ownerId_incidentKey: {
              ownerId,
              incidentKey: assessment.block.incidentVersion.incidentKey
            }
          },
          data: {
            status: AppliedEngineeringIncidentProgressStatus.ASSESSED,
            assessedAt: finalizedAt
          }
        })
      ]);
    }, transactionOptions);
    return this.read(ownerId, input.assessmentId);
  }

  private async loadEvidence(ownerId: string, assessmentId: string) {
    const assessment = await this.prisma.appliedEngineeringAssessment.findFirst({
      where: { id: assessmentId, ownerId },
      select: {
        block: {
          select: {
            id: true,
            ordinal: true,
            focusRevision: { select: { focusSnapshot: true } },
            incidentVersion: { select: { incidentKey: true } },
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
    const history = await this.prisma.appliedEngineeringBlock.findMany({
      where: { ownerId, ordinal: { lte: assessment.block.ordinal } },
      orderBy: { ordinal: "asc" },
      select: {
        incidentVersion: { select: { incidentKey: true } },
        questions: { select: { privateSnapshot: true } }
      }
    });
    return { block: assessment.block, history };
  }
}

function publicAssessment(
  assessment: Prisma.AppliedEngineeringAssessmentGetPayload<{
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
      ? publicAppliedEngineeringAssessmentSnapshot(assessment.assessmentSnapshot)
      : null,
    report: assessment.report
      ? appliedEngineeringAssessmentReportSchema.parse(assessment.report.reportSnapshot)
      : null,
    transcript: assessment.report
      ? appliedEngineeringSafeTranscriptSchema.parse(assessment.report.transcriptSnapshot)
      : null
  };
}

function assertResponses(
  snapshot: ReturnType<typeof appliedEngineeringAssessmentSnapshotSchema.parse>,
  responses: Array<{ promptId: string }>
) {
  const expected = snapshot.prompts.map((prompt) => prompt.id).sort();
  const actual = responses.map((response) => response.promptId).sort();
  if (new Set(actual).size !== 5 || expected.some((id, index) => id !== actual[index])) {
    throw new ConflictErrorException(
      "APPLIED_ENGINEERING_ASSESSMENT_RESPONSE_MISMATCH",
      "Submit exactly one answer for each frozen assessment prompt."
    );
  }
}

function assessmentNotFound() {
  return new NotFoundErrorException(
    "APPLIED_ENGINEERING_ASSESSMENT_NOT_FOUND",
    "Applied Engineering assessment not found."
  );
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lockAssessment(tx: Prisma.TransactionClient, assessmentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`applied-engineering-assessment:${assessmentId}`}))`;
}

const transactionOptions = { maxWait: 20_000, timeout: 120_000 } as const;
