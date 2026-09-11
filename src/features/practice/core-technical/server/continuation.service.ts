import { CoreTechnicalPreparationStatus } from "@prisma/client";
import {
  CORE_TECHNICAL_ASSESSMENT_EVALUATOR_VERSION,
  coreTechnicalAssessmentReportSchema
} from "@/features/practice/core-technical/domain/assessment-contracts";
import { coreTechnicalConfirmedFocusSchema } from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { coreTechnicalContinueInputSchema } from "@/features/practice/core-technical/domain/assessment-contracts";
import { coreTechnicalPracticePathBlueprint } from "@/features/practice/core-technical/domain/practice-path-blueprints";
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
import type { CoreTechnicalGenerationPipeline } from "./generation-pipeline";
import type { CoreTechnicalPersistenceService } from "./persistence.service";
import {
  CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION,
  CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION
} from "./preparation.service";
import type { CoreTechnicalPracticeService } from "./practice.service";

type Dependencies = {
  prisma: PrismaService;
  generation: Pick<CoreTechnicalGenerationPipeline, "prepareReviewedDraft">;
  persistence: Pick<
    CoreTechnicalPersistenceService,
    "activateLibraryBlock" | "publishPreparedBlock" | "recordPreparationFailure"
  >;
  practice: Pick<CoreTechnicalPracticeService, "current" | "historyBlock">;
};

/** Keeps an assessed report current until an explicit, recoverable Continue succeeds. */
export class CoreTechnicalContinuationService {
  constructor(private readonly dependencies: Dependencies) {}

  async continue(ownerId: string, rawInput: unknown) {
    const input = coreTechnicalContinueInputSchema.parse(rawInput);
    const existing = await this.dependencies.prisma.coreTechnicalPreparationAttempt.findUnique({
      where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
      select: { status: true, blockId: true }
    });
    const replay = await resolveStoryPracticeContinuationReplay({
      existing,
      succeededStatus: CoreTechnicalPreparationStatus.SUCCEEDED,
      inProgressStatus: CoreTechnicalPreparationStatus.IN_PROGRESS,
      current: () => this.dependencies.practice.current(ownerId),
      inProgress: () =>
        new ConflictErrorException(
          "CORE_TECHNICAL_CONTINUATION_IN_PROGRESS",
          "The next Core Technical practice path is already being prepared."
        )
    });
    if (replay) return replay;

    const previous = await this.dependencies.prisma.coreTechnicalBlock.findFirst({
      where: { id: input.blockId, ownerId, isCurrent: true },
      select: {
        id: true,
        status: true,
        focusRevisionId: true,
        focusRevision: { select: { focusSnapshot: true } },
        assessment: {
          select: {
            status: true,
            report: { select: { reportSnapshot: true } }
          }
        }
      }
    });
    if (!previous) {
      throw new NotFoundErrorException(
        "CORE_TECHNICAL_BLOCK_NOT_FOUND",
        "The Core Technical practice path selected for continuation was not found."
      );
    }
    assertStoryPracticeContinuationReady(
      previous,
      () =>
        new ConflictErrorException(
          "CORE_TECHNICAL_CONTINUATION_NOT_READY",
          "Complete the current practice-path assessment before continuing."
        )
    );
    const focus = coreTechnicalConfirmedFocusSchema.parse(previous.focusRevision.focusSnapshot);
    const report = coreTechnicalAssessmentReportSchema.parse(
      previous.assessment.report.reportSnapshot
    );
    const continuation =
      report.continuation ??
      (report.nextStory ? { kind: "continue" as const, next: report.nextStory } : null);
    if (!continuation) {
      throw new ConflictErrorException(
        "CORE_TECHNICAL_CONTINUATION_INVALID",
        "This assessment report does not contain a continuation decision."
      );
    }
    if (continuation.kind !== "continue") {
      return { replayed: false, block: null, continuation };
    }
    const selection = continuation.next;
    const activated = await this.dependencies.persistence.activateLibraryBlock(ownerId, {
      requestId: input.requestId,
      focusRevisionId: previous.focusRevisionId,
      previousBlockId: previous.id,
      selection,
      generatorVersion: CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION,
      validatorVersion: CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION
    });
    if (activated) {
      return {
        replayed: false,
        block: await this.dependencies.practice.historyBlock(ownerId, activated.id)
      };
    }
    let stage: "story-generation" | "question-generation" | "validation" | "publishing" =
      "story-generation";
    try {
      const reviewedStory = coreTechnicalPracticePathBlueprint(
        selection.selectedStory.storyKey,
        selection.selectedStory.storyVersion
      );
      if (!reviewedStory) {
        throw new Error("The recommended reviewed practice path is unavailable");
      }
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
          weakMechanismKeys: selection.evidence.practice.weakMechanismKeys,
          unassessedMechanismKeys: [],
          resumeTopicKeys: focus.resumeEvidence.topicKeys,
          resumeMechanismKeys: focus.resumeEvidence.mechanismKeys,
          recentTopicKeys: selection.evidence.priorTopicKeys,
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
      await this.dependencies.persistence.publishPreparedBlock(ownerId, {
        requestId: input.requestId,
        focusRevisionId: previous.focusRevisionId,
        previousBlockId: previous.id,
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
          focusRevisionId: previous.focusRevisionId,
          generatorVersion: CORE_TECHNICAL_PREPARATION_GENERATOR_VERSION,
          validatorVersion: CORE_TECHNICAL_PREPARATION_VALIDATOR_VERSION,
          selection,
          diagnostic: {
            stage,
            code: storyPracticeFailureCode("CORE_TECHNICAL_CONTINUATION", stage),
            message: boundedStoryPracticeDiagnostic(error, "Unknown continuation failure"),
            retryable: true
          }
        })
        .catch((persistenceError) => {
          console.error(
            "[core-technical] Could not persist continuation failure",
            persistenceError
          );
        });
      throw new ServiceUnavailableErrorException(
        "CORE_TECHNICAL_CONTINUATION_FAILED",
        "We could not prepare the complete next practice path. Your assessment report is safe; try again.",
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
