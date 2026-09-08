import { ArchitecturePreparationStatus } from "@prisma/client";
import { ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION } from "@/lib/practice/architecture-design/assessment-contracts";
import {
  architectureDesignConfirmedFocusSchema,
  publicArchitectureDesignConfirmedFocus
} from "@/lib/practice/architecture-design/focus-ranking-contracts";
import { architectureDesignPrepareInputSchema } from "@/lib/practice/architecture-design/practice-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import {
  boundedStoryPracticeDiagnostic,
  confirmStoryPracticeFocus,
  resolveStoryPracticePreparationReplay,
  storyPracticeFailureCode
} from "@/server/story-practice/preparation-orchestrator";
import type { ArchitectureDesignFocusService } from "./focus.service";
import type { ArchitectureDesignPersistenceService } from "./persistence.service";
import type { ArchitectureDesignPracticeService } from "./practice.service";
import type { ArchitectureDesignRepositoryAdapter } from "./repository-adapter";
import type { ArchitectureDesignScenarioRankingService } from "./scenario-ranking.service";

const GENERATOR_VERSION = "architecture-design-reviewed-content-v1";
const VALIDATOR_VERSION = "architecture-design-publication-validator-v1";

export class ArchitectureDesignPreparationService {
  constructor(
    private readonly dependencies: {
      prisma: PrismaService;
      focus: Pick<ArchitectureDesignFocusService, "confirm">;
      ranking: Pick<ArchitectureDesignScenarioRankingService, "rankFirstScenario">;
      repository: Pick<ArchitectureDesignRepositoryAdapter, "reviewedScenarioVersion"> &
        Pick<
          ArchitectureDesignPersistenceService,
          "saveConfirmedFocus" | "publishPreparedBlock" | "recordPreparationFailure"
        >;
      practice: Pick<ArchitectureDesignPracticeService, "current">;
    }
  ) {}

  async confirm(ownerId: string, input: Parameters<ArchitectureDesignFocusService["confirm"]>[1]) {
    return confirmStoryPracticeFocus({
      confirm: () => this.dependencies.focus.confirm(ownerId, input),
      save: (focus) => this.dependencies.repository.saveConfirmedFocus(ownerId, focus),
      present: (focus, saved) => ({
        id: saved.id,
        revision: saved.revision,
        schemaVersion: saved.schemaVersion,
        focusFingerprint: saved.focusFingerprint,
        confirmedAt: saved.confirmedAt.toISOString(),
        focus: publicArchitectureDesignConfirmedFocus(focus)
      })
    });
  }

  async prepare(ownerId: string, rawInput: unknown) {
    const input = architectureDesignPrepareInputSchema.parse(rawInput);
    const existing = await this.dependencies.prisma.architecturePreparationAttempt.findUnique({
      where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
      select: { status: true, focusRevisionId: true, blockId: true }
    });
    const replay = await resolveStoryPracticePreparationReplay({
      existing,
      focusRevisionId: input.focusRevisionId,
      succeededStatus: ArchitecturePreparationStatus.SUCCEEDED,
      inProgressStatus: ArchitecturePreparationStatus.IN_PROGRESS,
      current: () => this.dependencies.practice.current(ownerId),
      requestConflict: () =>
        new ConflictErrorException(
          "ARCHITECTURE_DESIGN_PREPARATION_REQUEST_CONFLICT",
          "This preparation request ID belongs to a different focus revision."
        ),
      inProgress: () =>
        new ConflictErrorException(
          "ARCHITECTURE_DESIGN_PREPARATION_IN_PROGRESS",
          "This Architecture & Design block is already being prepared."
        )
    });
    if (replay) return replay;

    const revision = await this.dependencies.prisma.architectureFocusRevision.findUnique({
      where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
      select: { focusSnapshot: true }
    });
    if (!revision) {
      throw new NotFoundErrorException(
        "ARCHITECTURE_DESIGN_FOCUS_NOT_FOUND",
        "The confirmed Architecture & Design focus could not be found."
      );
    }
    const focus = architectureDesignConfirmedFocusSchema.parse(revision.focusSnapshot);
    let selection:
      ReturnType<ArchitectureDesignScenarioRankingService["rankFirstScenario"]> | undefined;
    let stage: "ranking" | "content-reading" | "validation" | "publishing" = "ranking";
    try {
      selection = this.dependencies.ranking.rankFirstScenario(focus);
      stage = "content-reading";
      const reviewed = await this.dependencies.repository.reviewedScenarioVersion(
        selection.selectedScenario.scenarioKey,
        selection.selectedScenario.scenarioVersion
      );
      if (!reviewed) throw new Error("The selected published scenario content is unavailable");
      stage = "validation";
      if (
        reviewed.scenario.key !== selection.selectedScenario.scenarioKey ||
        reviewed.questionBlock.scenarioKey !== reviewed.scenario.key
      ) {
        throw new Error("The selected reviewed scenario snapshots do not match");
      }
      stage = "publishing";
      await this.dependencies.repository.publishPreparedBlock(ownerId, {
        requestId: input.requestId,
        focusRevisionId: input.focusRevisionId,
        selection,
        draft: { scenario: reviewed.scenario, questionBlock: reviewed.questionBlock },
        generatorVersion: GENERATOR_VERSION,
        validatorVersion: VALIDATOR_VERSION,
        evaluatorVersion: ARCHITECTURE_DESIGN_ASSESSMENT_EVALUATOR_VERSION
      });
      return { replayed: false, block: await this.dependencies.practice.current(ownerId) };
    } catch (error) {
      await this.dependencies.repository
        .recordPreparationFailure(ownerId, {
          requestId: input.requestId,
          focusRevisionId: input.focusRevisionId,
          generatorVersion: GENERATOR_VERSION,
          validatorVersion: VALIDATOR_VERSION,
          selection,
          diagnostic: {
            stage,
            code: storyPracticeFailureCode("ARCHITECTURE_DESIGN", stage),
            message: boundedStoryPracticeDiagnostic(error, "Unknown preparation failure"),
            retryable: true
          }
        })
        .catch(() => undefined);
      throw new ServiceUnavailableErrorException(
        "ARCHITECTURE_DESIGN_PREPARATION_FAILED",
        "We could not prepare the complete four-question scenario. Nothing partial was saved; try again.",
        { retryable: true, stage }
      );
    }
  }
}
