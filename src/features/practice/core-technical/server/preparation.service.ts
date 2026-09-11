import { CoreTechnicalPreparationStatus } from "@prisma/client";
import {
  coreTechnicalConfirmedFocusSchema,
  publicCoreTechnicalConfirmedFocus
} from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import {
  coreTechnicalPrepareInputSchema,
  coreTechnicalStartPathInputSchema
} from "@/features/practice/core-technical/domain/practice-contracts";
import { CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION } from "@/features/practice/core-technical/domain/assessment-contracts";
import { coreTechnicalPracticePathBlueprint } from "@/features/practice/core-technical/domain/practice-path-blueprints";
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

export const CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION = "core-technical-generation-pipeline-v4";
export const CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION =
  "core-technical-personalized-validator-v2";

type Dependencies = {
  prisma: PrismaService;
  focus: Pick<CoreTechnicalFocusService, "confirm">;
  ranking: Pick<CoreTechnicalStoryRankingService, "rankFirstStory" | "rankSelectedStory">;
  generation: Pick<CoreTechnicalGenerationPipeline, "prepareReviewedDraft">;
  persistence: Pick<
    CoreTechnicalPersistenceService,
    "saveConfirmedFocus" | "publishPreparedBlock" | "recordPreparationFailure"
  >;
  practice: Pick<CoreTechnicalPracticeService, "current" | "historyBlock">;
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
      current: () =>
        existing?.blockId
          ? this.dependencies.practice.historyBlock(ownerId, existing.blockId)
          : this.dependencies.practice.current(ownerId),
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
      const reviewedStory = coreTechnicalPracticePathBlueprint(
        selection.selectedStory.storyKey,
        selection.selectedStory.storyVersion
      );
      if (!reviewedStory) throw new Error("The selected reviewed practice path is unavailable");
      const draft = await this.dependencies.generation.prepareReviewedDraft(
        {
          role: focus.role,
          seniority: focus.seniority,
          language: focus.stack.language,
          runtime: focus.stack.runtime,
          framework: focus.stack.framework ?? undefined,
          technology: focus.stack.technology,
          targetJob: focus.targetJob,
          targetCompany: focus.targetCompany ?? undefined,
          baselineState: difficultyState(selection.selectedStory.difficulty),
          weakMechanismKeys: focus.baselineEvidence.weakMechanismKeys,
          unassessedMechanismKeys: focus.baselineEvidence.unassessedMechanismKeys,
          resumeTopicKeys: focus.resumeEvidence.topicKeys,
          resumeMechanismKeys: focus.resumeEvidence.mechanismKeys,
          excludedTopicKeys: focus.excludedTopicKeys,
          personalizePresentation: input.personalized,
          reviewedContract: {
            storyKey: reviewedStory.key,
            storyTitle: reviewedStory.title,
            stagePatternKeys: reviewedStory.stages.map((item) => item.patternKey),
            requiredStoryTopicKeys: [
              reviewedStory.primaryTopicKey,
              ...reviewedStory.secondaryTopicKeys
            ]
          }
        },
        {
          preferApprovedArtifact: !input.personalized,
          fallbackToApprovedArtifactOnProviderFailure: input.personalized
        }
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
        "We could not prepare the complete practice path. Nothing partial was saved; try again.",
        { retryable: true, stage }
      );
    }
  }

  /** Materializes loose library questions without changing the assessment-bearing current path. */
  async startPath(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalStartPathInputSchema.parse(rawInput);
    const blocks = await this.dependencies.prisma.coreTechnicalBlock.findMany({
      where: { ownerId },
      orderBy: { ordinal: "desc" },
      select: {
        id: true,
        isCurrent: true,
        focusRevisionId: true,
        storyVersion: { select: { storyKey: true } },
        focusRevision: { select: { focusSnapshot: true } }
      }
    });
    const current = blocks.find((block) => block.isCurrent);
    if (!current) {
      throw new NotFoundErrorException(
        "CORE_TECHNICAL_BLOCK_NOT_FOUND",
        "Start your recommended Core Technical practice path first."
      );
    }

    const existing = await this.dependencies.prisma.coreTechnicalPreparationAttempt.findUnique({
      where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
      select: { status: true, focusRevisionId: true, blockId: true }
    });
    const replay = await resolveStoryPracticePreparationReplay({
      existing,
      focusRevisionId: current.focusRevisionId,
      succeededStatus: CoreTechnicalPreparationStatus.SUCCEEDED,
      inProgressStatus: CoreTechnicalPreparationStatus.IN_PROGRESS,
      current: () =>
        existing?.blockId
          ? this.dependencies.practice.historyBlock(ownerId, existing.blockId)
          : this.dependencies.practice.current(ownerId),
      requestConflict: () =>
        new ConflictErrorException(
          "CORE_TECHNICAL_PREPARATION_REQUEST_CONFLICT",
          "This path request ID belongs to a different practice focus."
        ),
      inProgress: () =>
        new ConflictErrorException(
          "CORE_TECHNICAL_PREPARATION_IN_PROGRESS",
          "This Core Technical practice path is already being prepared."
        )
    });
    if (replay) return replay;

    const saved = blocks.find((block) => block.storyVersion.storyKey === input.storyKey);
    if (saved) {
      return {
        replayed: true,
        block: await this.dependencies.practice.historyBlock(ownerId, saved.id)
      };
    }

    const focus = coreTechnicalConfirmedFocusSchema.parse(current.focusRevision.focusSnapshot);
    let selection: ReturnType<CoreTechnicalStoryRankingService["rankSelectedStory"]> | undefined;
    let stage:
      "ranking" | "story-generation" | "question-generation" | "validation" | "publishing" =
      "ranking";
    try {
      const recentStoryKeys = blocks.map((block) => block.storyVersion.storyKey);
      const recentTopicKeys = recentStoryKeys.flatMap((storyKey) => {
        const blueprint = coreTechnicalPracticePathBlueprint(storyKey);
        return blueprint ? [blueprint.primaryTopicKey, ...blueprint.secondaryTopicKeys] : [];
      });
      selection = this.dependencies.ranking.rankSelectedStory(focus, input.storyKey, {
        recentStoryKeys,
        recentTopicKeys
      });
      const reviewedStory = coreTechnicalPracticePathBlueprint(
        selection.selectedStory.storyKey,
        selection.selectedStory.storyVersion
      );
      if (!reviewedStory) throw new Error("The selected reviewed practice path is unavailable");

      stage = "story-generation";
      const draft = await this.dependencies.generation.prepareReviewedDraft(
        {
          role: focus.role,
          seniority: focus.seniority,
          language: focus.stack.language,
          runtime: focus.stack.runtime,
          framework: focus.stack.framework ?? undefined,
          technology: focus.stack.technology,
          targetJob: focus.targetJob,
          targetCompany: focus.targetCompany ?? undefined,
          baselineState: difficultyState(selection.selectedStory.difficulty),
          weakMechanismKeys: focus.baselineEvidence.weakMechanismKeys,
          unassessedMechanismKeys: focus.baselineEvidence.unassessedMechanismKeys,
          resumeTopicKeys: focus.resumeEvidence.topicKeys,
          resumeMechanismKeys: focus.resumeEvidence.mechanismKeys,
          recentTopicKeys,
          excludedTopicKeys: focus.excludedTopicKeys,
          personalizePresentation: true,
          reviewedContract: {
            storyKey: reviewedStory.key,
            storyTitle: reviewedStory.title,
            stagePatternKeys: reviewedStory.stages.map((item) => item.patternKey),
            requiredStoryTopicKeys: [
              reviewedStory.primaryTopicKey,
              ...reviewedStory.secondaryTopicKeys
            ]
          }
        },
        { fallbackToApprovedArtifactOnProviderFailure: true }
      );
      stage = "publishing";
      const published = await this.dependencies.persistence.publishPreparedBlock(ownerId, {
        requestId: input.requestId,
        focusRevisionId: current.focusRevisionId,
        libraryBlock: true,
        selection,
        draft,
        generatorVersion: CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION,
        validatorVersion: CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION,
        evaluatorVersion: CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION
      });
      return {
        replayed: false,
        block: await this.dependencies.practice.historyBlock(ownerId, published.id)
      };
    } catch (error) {
      await this.dependencies.persistence
        .recordPreparationFailure(ownerId, {
          requestId: input.requestId,
          focusRevisionId: current.focusRevisionId,
          generatorVersion: CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION,
          validatorVersion: CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION,
          selection,
          diagnostic: {
            stage,
            code: storyPracticeFailureCode("CORE_TECHNICAL_LIBRARY_PATH", stage),
            message: boundedStoryPracticeDiagnostic(error, "Unknown path preparation failure"),
            retryable: true
          }
        })
        .catch((persistenceError) => {
          console.error(
            "[core-technical] Could not persist path preparation failure",
            persistenceError
          );
        });
      throw new ServiceUnavailableErrorException(
        "CORE_TECHNICAL_PATH_PREPARATION_FAILED",
        "We could not prepare this complete practice path. Nothing partial was saved; try again.",
        { retryable: true, stage }
      );
    }
  }
}

function difficultyState(difficulty: "guided" | "standard" | "stretch") {
  if (difficulty === "stretch") return "STRETCH" as const;
  if (difficulty === "standard") return "STANDARD" as const;
  return "GUIDED" as const;
}
