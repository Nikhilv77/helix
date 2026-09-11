import { AppliedEngineeringPreparationStatus } from "@prisma/client";
import { appliedEngineeringConfirmedFocusSchema } from "@/features/practice/applied-engineering/domain/focus-ranking-contracts";
import {
  appliedEngineeringPrepareInputSchema,
  appliedEngineeringStartPathInputSchema
} from "@/features/practice/applied-engineering/domain/practice-contracts";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/features/practice/applied-engineering/domain/reviewed-incidents";
import { publicAppliedEngineeringConfirmedFocus } from "@/features/practice/applied-engineering/domain/focus-ranking-contracts";
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
import type { AppliedEngineeringFocusService } from "./focus.service";
import type { AppliedEngineeringIncidentRankingService } from "./incident-ranking.service";
import type { AppliedEngineeringPersistenceService } from "./persistence.service";
import type { AppliedEngineeringPracticeService } from "./practice.service";

export class AppliedEngineeringPreparationService {
  constructor(
    private readonly dependencies: {
      prisma: PrismaService;
      focus: Pick<AppliedEngineeringFocusService, "confirm">;
      ranking: Pick<
        AppliedEngineeringIncidentRankingService,
        "rankFirstIncident" | "rankSelectedIncident"
      >;
      persistence: Pick<
        AppliedEngineeringPersistenceService,
        "saveConfirmedFocus" | "publishPreparedBlock" | "recordPreparationFailure"
      >;
      practice: Pick<AppliedEngineeringPracticeService, "current" | "historyBlock">;
    }
  ) {}

  async confirm(ownerId: string, input: Parameters<AppliedEngineeringFocusService["confirm"]>[1]) {
    return confirmStoryPracticeFocus({
      confirm: () => this.dependencies.focus.confirm(ownerId, input),
      save: (focus) => this.dependencies.persistence.saveConfirmedFocus(ownerId, focus),
      present: (focus, saved) => ({
        id: saved.id,
        revision: saved.revision,
        schemaVersion: saved.schemaVersion,
        focusFingerprint: saved.focusFingerprint,
        confirmedAt: saved.confirmedAt.toISOString(),
        focus: publicAppliedEngineeringConfirmedFocus(focus)
      })
    });
  }

  async prepare(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringPrepareInputSchema.parse(rawInput);
    const existing = await this.dependencies.prisma.appliedEngineeringPreparationAttempt.findUnique(
      {
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: { status: true, focusRevisionId: true, blockId: true }
      }
    );
    const replay = await resolveStoryPracticePreparationReplay({
      existing,
      focusRevisionId: input.focusRevisionId,
      succeededStatus: AppliedEngineeringPreparationStatus.SUCCEEDED,
      inProgressStatus: AppliedEngineeringPreparationStatus.IN_PROGRESS,
      current: () => this.dependencies.practice.current(ownerId),
      requestConflict: () =>
        new ConflictErrorException(
          "APPLIED_ENGINEERING_PREPARATION_REQUEST_CONFLICT",
          "This preparation request ID belongs to a different focus revision."
        ),
      inProgress: () =>
        new ConflictErrorException(
          "APPLIED_ENGINEERING_PREPARATION_IN_PROGRESS",
          "This Applied Engineering block is already being prepared."
        )
    });
    if (replay) return replay;
    const revision = await this.dependencies.prisma.appliedEngineeringFocusRevision.findUnique({
      where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
      select: { focusSnapshot: true }
    });
    if (!revision)
      throw new NotFoundErrorException(
        "APPLIED_ENGINEERING_FOCUS_NOT_FOUND",
        "The confirmed Applied Engineering focus could not be found."
      );
    const focus = appliedEngineeringConfirmedFocusSchema.parse(revision.focusSnapshot);
    let selection:
      ReturnType<AppliedEngineeringIncidentRankingService["rankFirstIncident"]> | undefined;
    let stage: "ranking" | "validation" | "publishing" = "ranking";
    try {
      selection = this.dependencies.ranking.rankFirstIncident(focus);
      stage = "validation";
      const artifact = APPLIED_ENGINEERING_REVIEW_CANDIDATES.find(
        (candidate) => candidate.caseKey === selection!.selectedIncident.incidentKey
      );
      if (!artifact) throw new Error("The selected reviewed incident artifact is unavailable");
      stage = "publishing";
      await this.dependencies.persistence.publishPreparedBlock(ownerId, {
        requestId: input.requestId,
        focusRevisionId: input.focusRevisionId,
        selection,
        draft: { incident: artifact.incident, questionBlock: artifact.questionBlock },
        generatorVersion: "applied-engineering-reviewed-artifact-v1",
        validatorVersion: "applied-engineering-publication-validator-v1",
        evaluatorVersion: "applied-engineering-assessment-evaluator-v1"
      });
      return { replayed: false, block: await this.dependencies.practice.current(ownerId) };
    } catch (error) {
      await this.dependencies.persistence
        .recordPreparationFailure(ownerId, {
          requestId: input.requestId,
          focusRevisionId: input.focusRevisionId,
          generatorVersion: "applied-engineering-reviewed-artifact-v1",
          validatorVersion: "applied-engineering-publication-validator-v1",
          selection,
          diagnostic: {
            stage,
            code: storyPracticeFailureCode("APPLIED_ENGINEERING", stage),
            message: boundedStoryPracticeDiagnostic(error, "Unknown preparation failure"),
            retryable: true
          }
        })
        .catch(() => undefined);
      throw new ServiceUnavailableErrorException(
        "APPLIED_ENGINEERING_PREPARATION_FAILED",
        "We could not prepare the complete eight-question incident. Nothing partial was saved; try again.",
        { retryable: true, stage }
      );
    }
  }

  /** Materializes reviewed library questions without replacing the current incident. */
  async startPath(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringStartPathInputSchema.parse(rawInput);
    const blocks = await this.dependencies.prisma.appliedEngineeringBlock.findMany({
      where: { ownerId },
      orderBy: { ordinal: "desc" },
      select: {
        id: true,
        isCurrent: true,
        status: true,
        focusRevisionId: true,
        incidentVersion: { select: { incidentKey: true } },
        focusRevision: { select: { focusSnapshot: true } }
      }
    });
    const current = blocks.find((block) => block.isCurrent);
    if (!current) {
      throw new NotFoundErrorException(
        "APPLIED_ENGINEERING_BLOCK_NOT_FOUND",
        "Start your recommended Applied Engineering incident first."
      );
    }

    const existing = await this.dependencies.prisma.appliedEngineeringPreparationAttempt.findUnique(
      {
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: { status: true, focusRevisionId: true, blockId: true }
      }
    );
    const replay = await resolveStoryPracticePreparationReplay({
      existing,
      focusRevisionId: current.focusRevisionId,
      succeededStatus: AppliedEngineeringPreparationStatus.SUCCEEDED,
      inProgressStatus: AppliedEngineeringPreparationStatus.IN_PROGRESS,
      current: () =>
        existing?.blockId
          ? this.dependencies.practice.historyBlock(ownerId, existing.blockId)
          : this.dependencies.practice.current(ownerId),
      requestConflict: () =>
        new ConflictErrorException(
          "APPLIED_ENGINEERING_PREPARATION_REQUEST_CONFLICT",
          "This incident request ID belongs to a different practice focus."
        ),
      inProgress: () =>
        new ConflictErrorException(
          "APPLIED_ENGINEERING_PREPARATION_IN_PROGRESS",
          "This Applied Engineering incident is already being prepared."
        )
    });
    if (replay) return replay;

    const saved = blocks.find((block) => block.incidentVersion.incidentKey === input.storyKey);
    if (saved) {
      return {
        replayed: true,
        block: await this.dependencies.practice.historyBlock(ownerId, saved.id)
      };
    }

    const focus = appliedEngineeringConfirmedFocusSchema.parse(current.focusRevision.focusSnapshot);
    let selection:
      ReturnType<AppliedEngineeringIncidentRankingService["rankSelectedIncident"]> | undefined;
    let stage: "ranking" | "validation" | "publishing" = "ranking";
    try {
      const recentIncidentKeys = blocks.map((block) => block.incidentVersion.incidentKey);
      const completedIncidentKeys = blocks
        .filter((block) => block.status === "ASSESSED")
        .map((block) => block.incidentVersion.incidentKey);
      const recentTopicKeys = recentIncidentKeys.flatMap((incidentKey) => {
        const artifact = APPLIED_ENGINEERING_REVIEW_CANDIDATES.find(
          (candidate) => candidate.caseKey === incidentKey
        );
        return artifact
          ? [artifact.incident.primaryTopicKey, ...artifact.incident.secondaryTopicKeys]
          : [];
      });
      selection = this.dependencies.ranking.rankSelectedIncident(focus, input.storyKey, {
        recentIncidentKeys,
        recentTopicKeys,
        completedIncidentKeys
      });
      stage = "validation";
      const artifact = APPLIED_ENGINEERING_REVIEW_CANDIDATES.find(
        (candidate) => candidate.caseKey === selection!.selectedIncident.incidentKey
      );
      if (!artifact) throw new Error("The selected reviewed incident artifact is unavailable");
      stage = "publishing";
      const published = await this.dependencies.persistence.publishPreparedBlock(ownerId, {
        requestId: input.requestId,
        focusRevisionId: current.focusRevisionId,
        libraryBlock: true,
        selection,
        draft: { incident: artifact.incident, questionBlock: artifact.questionBlock },
        generatorVersion: "applied-engineering-reviewed-artifact-v1",
        validatorVersion: "applied-engineering-publication-validator-v1",
        evaluatorVersion: "applied-engineering-assessment-evaluator-v1"
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
          generatorVersion: "applied-engineering-reviewed-artifact-v1",
          validatorVersion: "applied-engineering-publication-validator-v1",
          selection,
          diagnostic: {
            stage,
            code: storyPracticeFailureCode("APPLIED_ENGINEERING_LIBRARY_PATH", stage),
            message: boundedStoryPracticeDiagnostic(error, "Unknown incident preparation failure"),
            retryable: true
          }
        })
        .catch(() => undefined);
      throw new ServiceUnavailableErrorException(
        "APPLIED_ENGINEERING_PATH_PREPARATION_FAILED",
        "We could not prepare this reviewed incident. Nothing partial was saved; try again.",
        { retryable: true, stage }
      );
    }
  }
}
