import { AppliedEngineeringPreparationStatus } from "@prisma/client";
import { appliedEngineeringConfirmedFocusSchema } from "@/lib/practice/applied-engineering/focus-ranking-contracts";
import { appliedEngineeringPrepareInputSchema } from "@/lib/practice/applied-engineering/practice-contracts";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/lib/practice/applied-engineering/reviewed-incidents";
import { publicAppliedEngineeringConfirmedFocus } from "@/lib/practice/applied-engineering/focus-ranking-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import { ServiceUnavailableErrorException } from "@/server/common/exceptions/service-unavailable-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import type { AppliedEngineeringFocusService } from "./focus.service";
import type { AppliedEngineeringIncidentRankingService } from "./incident-ranking.service";
import type { AppliedEngineeringPersistenceService } from "./persistence.service";
import type { AppliedEngineeringPracticeService } from "./practice.service";

export class AppliedEngineeringPreparationService {
  constructor(
    private readonly dependencies: {
      prisma: PrismaService;
      focus: Pick<AppliedEngineeringFocusService, "confirm">;
      ranking: Pick<AppliedEngineeringIncidentRankingService, "rankFirstIncident">;
      persistence: Pick<
        AppliedEngineeringPersistenceService,
        "saveConfirmedFocus" | "publishPreparedBlock" | "recordPreparationFailure"
      >;
      practice: Pick<AppliedEngineeringPracticeService, "current">;
    }
  ) {}

  async confirm(ownerId: string, input: Parameters<AppliedEngineeringFocusService["confirm"]>[1]) {
    const focus = await this.dependencies.focus.confirm(ownerId, input);
    const saved = await this.dependencies.persistence.saveConfirmedFocus(ownerId, focus);
    return {
      id: saved.id,
      revision: saved.revision,
      schemaVersion: saved.schemaVersion,
      focusFingerprint: saved.focusFingerprint,
      confirmedAt: saved.confirmedAt.toISOString(),
      focus: publicAppliedEngineeringConfirmedFocus(focus)
    };
  }

  async prepare(ownerId: string, rawInput: unknown) {
    const input = appliedEngineeringPrepareInputSchema.parse(rawInput);
    const existing = await this.dependencies.prisma.appliedEngineeringPreparationAttempt.findUnique(
      {
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: { status: true, focusRevisionId: true, blockId: true }
      }
    );
    if (existing && existing.focusRevisionId !== input.focusRevisionId)
      throw new ConflictErrorException(
        "APPLIED_ENGINEERING_PREPARATION_REQUEST_CONFLICT",
        "This preparation request ID belongs to a different focus revision."
      );
    if (existing?.status === AppliedEngineeringPreparationStatus.SUCCEEDED && existing.blockId)
      return { replayed: true, block: await this.dependencies.practice.current(ownerId) };
    if (existing?.status === AppliedEngineeringPreparationStatus.IN_PROGRESS)
      throw new ConflictErrorException(
        "APPLIED_ENGINEERING_PREPARATION_IN_PROGRESS",
        "This Applied Engineering block is already being prepared."
      );
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
            code: `APPLIED_ENGINEERING_${stage.toUpperCase()}_FAILED`,
            message:
              error instanceof Error ? error.message.slice(0, 700) : "Unknown preparation failure",
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
}
