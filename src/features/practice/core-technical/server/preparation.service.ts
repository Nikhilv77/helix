import {
  CoreTechnicalPreparationStatus,
  CoreTechnicalStoryPublicationStatus
} from "@prisma/client";
import {
  coreTechnicalConfirmedFocusSchema,
  publicCoreTechnicalConfirmedFocus
} from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { coreTechnicalPrepareInputSchema } from "@/features/practice/core-technical/domain/practice-contracts";
import { CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION } from "@/features/practice/core-technical/domain/assessment-contracts";
import { selectedStorySchema } from "@/features/practice/core-technical/domain/story-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import {
  boundedStoryPracticeDiagnostic,
  confirmStoryPracticeFocus,
  resolveStoryPracticePreparationReplay,
  storyPracticeFailureCode
} from "@/features/practice/shared/server/preparation-orchestrator";
import type { CoreTechnicalFocusConfirmation, CoreTechnicalFocusService } from "./focus.service";
import type { CoreTechnicalGenerationPipeline } from "./generation-pipeline";
import type { CoreTechnicalPersistenceService } from "./persistence.service";
import type { CoreTechnicalPracticeService } from "./practice.service";
import type { CoreTechnicalStoryRankingService } from "./story-ranking.service";

export const CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION = "core-technical-generation-pipeline-v2";
export const CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION =
  "core-technical-publication-validator-v1";

type Dependencies = {
  prisma: PrismaService;
  focus: Pick<CoreTechnicalFocusService, "confirm">;
  ranking: Pick<CoreTechnicalStoryRankingService, "rankFirstStory">;
  generation: Pick<CoreTechnicalGenerationPipeline, "prepareReviewedDraft">;
  persistence: Pick<
    CoreTechnicalPersistenceService,
    "saveConfirmedFocus" | "publishPreparedBlock" | "recordPreparationFailure"
  >;
  practice: Pick<CoreTechnicalPracticeService, "current">;
};

/** Orchestrates confirmation and all-or-nothing first-block preparation. */
export class CoreTechnicalPreparationService {
  constructor(private readonly dependencies: Dependencies) {}

  async confirm(ownerId: string, input: CoreTechnicalFocusConfirmation) {
    return confirmStoryPracticeFocus({
      confirm: () => this.dependencies.focus.confirm(ownerId, input),
      save: (focus) => this.dependencies.persistence.saveConfirmedFocus(ownerId, focus),
      present: (focus, saved) => ({
        id: saved.id,
        revision: saved.revision,
        schemaVersion: saved.schemaVersion,
        focusFingerprint: saved.focusFingerprint,
        confirmedAt: saved.confirmedAt.toISOString(),
        focus: publicCoreTechnicalConfirmedFocus(focus)
      })
    });
  }

  async prepare(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalPrepareInputSchema.parse(rawInput);
    const existing = await this.dependencies.prisma.coreTechnicalPreparationAttempt.findUnique({
      where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
      select: { status: true, focusRevisionId: true, blockId: true }
    });
    const replay = await resolveStoryPracticePreparationReplay({
      existing,
      focusRevisionId: input.focusRevisionId,
      succeededStatus: CoreTechnicalPreparationStatus.SUCCEEDED,
      inProgressStatus: CoreTechnicalPreparationStatus.IN_PROGRESS,
      current: () => this.dependencies.practice.current(ownerId),
      requestConflict: () =>
        new ConflictErrorException(
          "CORE_TECHNICAL_PREPARATION_REQUEST_CONFLICT",
          "This preparation request ID belongs to a different focus revision."
        ),
      inProgress: () =>
        new ConflictErrorException(
          "CORE_TECHNICAL_PREPARATION_IN_PROGRESS",
          "This Core Technical block is already being prepared."
        )
    });
    if (replay) return replay;

    const revision = await this.dependencies.prisma.coreTechnicalFocusRevision.findUnique({
      where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
      select: { focusSnapshot: true }
    });
    if (!revision) {
      throw new NotFoundErrorException(
        "CORE_TECHNICAL_FOCUS_NOT_FOUND",
        "The confirmed Core Technical focus could not be found."
      );
    }
    const focus = coreTechnicalConfirmedFocusSchema.parse(revision.focusSnapshot);
    let selection: ReturnType<CoreTechnicalStoryRankingService["rankFirstStory"]> | undefined;
    let stage:
      "ranking" | "story-generation" | "question-generation" | "validation" | "publishing" =
      "ranking";
    try {
      selection = this.dependencies.ranking.rankFirstStory(focus);
      stage = "story-generation";
      const reviewed = await this.dependencies.prisma.coreTechnicalStoryVersion.findUnique({
        where: {
          storyKey_version: {
            storyKey: selection.selectedStory.storyKey,
            version: selection.selectedStory.storyVersion
          }
        },
        select: { publicationStatus: true, storySnapshot: true }
      });
      if (
        !reviewed ||
        reviewed.publicationStatus !== CoreTechnicalStoryPublicationStatus.PUBLISHED
      ) {
        throw new Error("The selected reviewed story version has not been published");
      }
      const reviewedStory = selectedStorySchema.parse(reviewed.storySnapshot);
      const draft = await this.dependencies.generation.prepareReviewedDraft(
        {
          role: focus.role,
          seniority: focus.seniority,
          language: focus.stack.language,
          runtime: focus.stack.runtime,
          framework: focus.stack.framework ?? undefined,
          targetJob: focus.targetJob,
          targetCompany: focus.targetCompany ?? undefined,
          baselineState: focus.baselineEvidence.state,
          weakMechanismKeys: focus.baselineEvidence.weakMechanismKeys,
          unassessedMechanismKeys: focus.baselineEvidence.unassessedMechanismKeys,
          excludedTopicKeys: focus.excludedTopicKeys,
          reviewedContract: {
            storyTitle: reviewedStory.title,
            stagePatternKeys: reviewedStory.stages.map((item) => item.patternKey),
            requiredStoryTopicKeys: [
              reviewedStory.primaryTopicKey,
              ...reviewedStory.secondaryTopicKeys
            ]
          }
        },
        { preferApprovedArtifact: true }
      );
      stage = "publishing";
      await this.dependencies.persistence.publishPreparedBlock(ownerId, {
        requestId: input.requestId,
        focusRevisionId: input.focusRevisionId,
        selection,
        draft,
        generatorVersion: CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION,
        validatorVersion: CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION,
        evaluatorVersion: CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION
      });
      return { replayed: false, block: await this.dependencies.practice.current(ownerId) };
    } catch (error) {
      await this.dependencies.persistence
        .recordPreparationFailure(ownerId, {
          requestId: input.requestId,
          focusRevisionId: input.focusRevisionId,
          generatorVersion: CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION,
          validatorVersion: CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION,
          selection,
          diagnostic: {
            stage,
            code: storyPracticeFailureCode("CORE_TECHNICAL", stage),
            message: boundedStoryPracticeDiagnostic(error, "Unknown preparation failure"),
            retryable: true
          }
        })
        .catch((persistenceError) => {
          console.error("[core-technical] Could not persist preparation failure", persistenceError);
        });
      throw new ServiceUnavailableErrorException(
        "CORE_TECHNICAL_PREPARATION_FAILED",
        "We could not prepare the complete eight-question story. Nothing partial was saved; try again.",
        { retryable: true, stage }
      );
    }
  }
}
