import { ArchitecturePreparationStatus } from "@prisma/client";
import {
  ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION,
  architectureDesignAssessmentReportSchema,
  architectureDesignContinueInputSchema
} from "@/features/practice/architecture-design/domain/assessment-contracts";
import { architectureDesignConfirmedFocusSchema } from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
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
import type { ArchitectureDesignPersistenceService } from "./persistence.service";
import type { ArchitectureDesignPracticeService } from "./practice.service";
import type { ArchitectureDesignRepositoryAdapter } from "./repository-adapter";

export const ARCHITECTURE_DESIGN_CONTINUATION_GENERATOR_VERSION =
  "architecture-design-reviewed-content-v1";
export const ARCHITECTURE_DESIGN_CONTINUATION_VALIDATOR_VERSION =
  "architecture-design-publication-validator-v1";

type Dependencies = {
  prisma: PrismaService;
  repository: Pick<ArchitectureDesignRepositoryAdapter, "reviewedScenarioVersion"> &
    Pick<
      ArchitectureDesignPersistenceService,
      "publishPreparedBlock" | "recordPreparationFailure"
    > &
    Partial<Pick<ArchitectureDesignPersistenceService, "activateLibraryBlock">>;
  practice: Pick<ArchitectureDesignPracticeService, "current"> &
    Partial<Pick<ArchitectureDesignPracticeService, "historyBlock">>;
};

/** Keeps the assessed block current until its recommended successor publishes atomically. */
export class ArchitectureDesignContinuationService {
  constructor(private readonly dependencies: Dependencies) {}

  async continue(ownerId: string, rawInput: unknown) {
    const input = architectureDesignContinueInputSchema.parse(rawInput);
    const existing = await this.dependencies.prisma.architecturePreparationAttempt.findUnique({
      where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
      select: { status: true, blockId: true }
    });
    const replay = await resolveStoryPracticeContinuationReplay({
      existing,
      succeededStatus: ArchitecturePreparationStatus.SUCCEEDED,
      inProgressStatus: ArchitecturePreparationStatus.IN_PROGRESS,
      current: () => this.dependencies.practice.current(ownerId),
      inProgress: () =>
        new ConflictErrorException(
          "ARCHITECTURE_DESIGN_CONTINUATION_IN_PROGRESS",
          "The next Architecture & Design scenario is already being prepared."
        )
    });
    if (replay) return replay;

    const previous = await this.dependencies.prisma.architectureBlock.findFirst({
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
        "ARCHITECTURE_DESIGN_BLOCK_NOT_FOUND",
        "The Architecture & Design block selected for continuation was not found."
      );
    }
    assertStoryPracticeContinuationReady(
      previous,
      () =>
        new ConflictErrorException(
          "ARCHITECTURE_DESIGN_CONTINUATION_NOT_READY",
          "Complete the current Architecture & Design assessment before continuing."
        )
    );
    const focus = architectureDesignConfirmedFocusSchema.parse(
      previous.focusRevision.focusSnapshot
    );
    const report = architectureDesignAssessmentReportSchema.parse(
      previous.assessment.report.reportSnapshot
    );
    const continuation =
      report.continuation ??
      (report.nextScenario ? { kind: "continue" as const, next: report.nextScenario } : null);
    if (!continuation) {
      throw new ConflictErrorException(
        "ARCHITECTURE_DESIGN_CONTINUATION_INVALID",
        "This assessment report does not contain a continuation decision."
      );
    }
    if (continuation.kind !== "continue") {
      return { replayed: false, block: null, continuation };
    }
    const selection = continuation.next;
    const activated = await this.dependencies.repository.activateLibraryBlock?.(ownerId, {
      requestId: input.requestId,
      focusRevisionId: previous.focusRevisionId,
      previousBlockId: previous.id,
      selection,
      generatorVersion: ARCHITECTURE_DESIGN_CONTINUATION_GENERATOR_VERSION,
      validatorVersion: ARCHITECTURE_DESIGN_CONTINUATION_VALIDATOR_VERSION
    });
    if (activated) {
      return {
        replayed: false,
        block: this.dependencies.practice.historyBlock
          ? await this.dependencies.practice.historyBlock(ownerId, activated.id)
          : await this.dependencies.practice.current(ownerId)
      };
    }
    let stage: "content-reading" | "validation" | "publishing" = "content-reading";
    try {
      const reviewed = await this.dependencies.repository.reviewedScenarioVersion(
        selection.selectedScenario.scenarioKey,
        selection.selectedScenario.scenarioVersion
      );
      if (!reviewed) throw new Error("The recommended published scenario is unavailable");
      stage = "validation";
      if (
        reviewed.scenario.key !== selection.selectedScenario.scenarioKey ||
        reviewed.questionBlock.scenarioKey !== reviewed.scenario.key
      ) {
        throw new Error("The recommended scenario snapshots do not match");
      }
      stage = "publishing";
      await this.dependencies.repository.publishPreparedBlock(ownerId, {
        requestId: input.requestId,
        focusRevisionId: previous.focusRevisionId,
        previousBlockId: previous.id,
        selection,
        draft: { scenario: reviewed.scenario, questionBlock: reviewed.questionBlock },
        generatorVersion: ARCHITECTURE_DESIGN_CONTINUATION_GENERATOR_VERSION,
        validatorVersion: ARCHITECTURE_DESIGN_CONTINUATION_VALIDATOR_VERSION,
        evaluatorVersion: ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION
      });
      return { replayed: false, block: await this.dependencies.practice.current(ownerId) };
    } catch (error) {
      await this.dependencies.repository
        .recordPreparationFailure(ownerId, {
          requestId: input.requestId,
          focusRevisionId: previous.focusRevisionId,
          generatorVersion: ARCHITECTURE_DESIGN_CONTINUATION_GENERATOR_VERSION,
          validatorVersion: ARCHITECTURE_DESIGN_CONTINUATION_VALIDATOR_VERSION,
          selection,
          diagnostic: {
            stage,
            code: storyPracticeFailureCode("ARCHITECTURE_DESIGN_CONTINUATION", stage),
            message: boundedStoryPracticeDiagnostic(error, "Unknown continuation failure"),
            retryable: true
          }
        })
        .catch(() => undefined);
      throw new ServiceUnavailableErrorException(
        "ARCHITECTURE_DESIGN_CONTINUATION_FAILED",
        "We could not prepare the complete next scenario. Your assessment report is safe; try again.",
        { retryable: true, stage, targetJob: focus.targetJob }
      );
    }
  }
}
