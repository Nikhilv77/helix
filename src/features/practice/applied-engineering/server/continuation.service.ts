import {
  AppliedEngineeringIncidentPublicationStatus,
  AppliedEngineeringPreparationStatus
} from "@prisma/client";
import {
  APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION,
  appliedEngineeringAssessmentReportSchema,
  appliedEngineeringContinueInputSchema
} from "@/features/practice/applied-engineering/domain/assessment-contracts";
import { appliedEngineeringConfirmedFocusSchema } from "@/features/practice/applied-engineering/domain/focus-ranking-contracts";
import { selectedAppliedEngineeringIncidentSchema } from "@/features/practice/applied-engineering/domain/incident-contracts";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/features/practice/applied-engineering/domain/reviewed-incidents";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import {
  assertStoryPracticeContinuationReady,
  resolveStoryPracticeContinuationReplay
} from "@/features/practice/shared/server/continuation-orchestrator";
import {
  boundedStoryPracticeDiagnostic,
  storyPracticeFailureCode
} from "@/features/practice/shared/server/preparation-orchestrator";
import type { AppliedEngineeringPersistenceService } from "./persistence.service";
import type { AppliedEngineeringPracticeService } from "./practice.service";

export const APPLIED_ENGINEERING_PREPARATION_GENERATOR_VERSION =
  "applied-engineering-reviewed-artifact-v1";
export const APPLIED_ENGINEERING_PREPARATION_VALIDATOR_VERSION =
  "applied-engineering-publication-validator-v1";

type Dependencies = {
  prisma: PrismaService;
  persistence: Pick<
    AppliedEngineeringPersistenceService,
    "publishPreparedBlock" | "recordPreparationFailure"
  >;
  practice: Pick<AppliedEngineeringPracticeService, "current">;
};

/** Keeps an assessed report current until a recoverable Continue succeeds atomically. */
export class AppliedEngineeringContinuationService {
  constructor(private readonly dependencies: Dependencies) {}

  async continue(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringContinueInputSchema.parse(rawInput);
    const existing = await this.dependencies.prisma.appliedEngineeringPreparationAttempt.findUnique(
      {
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: { status: true, blockId: true }
      }
    );
    const replay = await resolveStoryPracticeContinuationReplay({
      existing,
      succeededStatus: AppliedEngineeringPreparationStatus.SUCCEEDED,
      inProgressStatus: AppliedEngineeringPreparationStatus.IN_PROGRESS,
      current: () => this.dependencies.practice.current(ownerId),
      inProgress: () =>
        new ConflictErrorException(
          "APPLIED_ENGINEERING_CONTINUATION_IN_PROGRESS",
          "The next Applied Engineering incident is already being prepared."
        )
    });
    if (replay) return replay;

    const previous = await this.dependencies.prisma.appliedEngineeringBlock.findFirst({
      where: { id: input.blockId, ownerId, isCurrent: true },
      select: {
        id: true,
        status: true,
        focusRevisionId: true,
        focusRevision: { select: { focusSnapshot: true } },
        assessment: {
          select: { status: true, report: { select: { reportSnapshot: true } } }
        }
      }
    });
    if (!previous) {
      throw new NotFoundErrorException(
        "APPLIED_ENGINEERING_BLOCK_NOT_FOUND",
        "The Applied Engineering incident selected for continuation was not found."
      );
    }
    assertStoryPracticeContinuationReady(
      previous,
      () =>
        new ConflictErrorException(
          "APPLIED_ENGINEERING_CONTINUATION_NOT_READY",
          "Complete the current incident assessment before continuing."
        )
    );
    const focus = appliedEngineeringConfirmedFocusSchema.parse(
      previous.focusRevision.focusSnapshot
    );
    const report = appliedEngineeringAssessmentReportSchema.parse(
      previous.assessment.report.reportSnapshot
    );
    const selection = report.nextIncident;
    let stage: "validation" | "publishing" = "validation";
    try {
      const reviewed = await this.dependencies.prisma.appliedEngineeringIncidentVersion.findUnique({
        where: {
          incidentKey_version: {
            incidentKey: selection.selectedIncident.incidentKey,
            version: selection.selectedIncident.incidentVersion
          }
        },
        select: { publicationStatus: true, incidentSnapshot: true }
      });
      if (
        !reviewed ||
        reviewed.publicationStatus !== AppliedEngineeringIncidentPublicationStatus.PUBLISHED
      ) {
        throw new Error("The recommended reviewed incident version has not been published");
      }
      const reviewedIncident = selectedAppliedEngineeringIncidentSchema.parse(
        reviewed.incidentSnapshot
      );
      const artifact = APPLIED_ENGINEERING_REVIEW_CANDIDATES.find(
        (candidate) => candidate.caseKey === selection.selectedIncident.incidentKey
      );
      if (!artifact || artifact.incident.key !== reviewedIncident.key) {
        throw new Error("The recommended reviewed incident artifact is unavailable");
      }
      if (
        artifact.incident.title !== reviewedIncident.title ||
        artifact.questionBlock.incidentKey !== reviewedIncident.key
      ) {
        throw new Error("The recommended artifact does not match its published incident contract");
      }
      stage = "publishing";
      await this.dependencies.persistence.publishPreparedBlock(ownerId, {
        requestId: input.requestId,
        focusRevisionId: previous.focusRevisionId,
        previousBlockId: previous.id,
        selection,
        draft: { incident: artifact.incident, questionBlock: artifact.questionBlock },
        generatorVersion: APPLIED_ENGINEERING_PREPARATION_GENERATOR_VERSION,
        validatorVersion: APPLIED_ENGINEERING_PREPARATION_VALIDATOR_VERSION,
        evaluatorVersion: APPLIED_ENGINEERING_ASSESSMENT_EVALUATOR_VERSION
      });
      return { replayed: false, block: await this.dependencies.practice.current(ownerId) };
    } catch (error) {
      await this.dependencies.persistence
        .recordPreparationFailure(ownerId, {
          requestId: input.requestId,
          focusRevisionId: previous.focusRevisionId,
          generatorVersion: APPLIED_ENGINEERING_PREPARATION_GENERATOR_VERSION,
          validatorVersion: APPLIED_ENGINEERING_PREPARATION_VALIDATOR_VERSION,
          selection,
          diagnostic: {
            stage,
            code: storyPracticeFailureCode("APPLIED_ENGINEERING_CONTINUATION", stage),
            message: boundedStoryPracticeDiagnostic(error, "Unknown continuation failure"),
            retryable: true
          }
        })
        .catch((persistenceError) => {
          console.error(
            "[applied-engineering] Could not persist continuation failure",
            persistenceError
          );
        });
      throw new ServiceUnavailableErrorException(
        "APPLIED_ENGINEERING_CONTINUATION_FAILED",
        "We could not prepare the complete next incident. Your assessment report is safe; try again.",
        { retryable: true, stage, targetJob: focus.targetJob }
      );
    }
  }
}
