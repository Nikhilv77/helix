import { createHash } from "node:crypto";
import {
  AppliedEngineeringIncidentPublicationStatus,
  AppliedEngineeringIncidentProgressStatus,
  AppliedEngineeringPreparationStatus,
  Prisma
} from "@prisma/client";
import { z } from "zod";
import {
  appliedEngineeringConfirmedFocusSchema,
  appliedEngineeringIncidentSelectionSchema,
  type AppliedEngineeringConfirmedFocus,
  type AppliedEngineeringIncidentSelection
} from "@/features/practice/applied-engineering/domain/focus-ranking-contracts";
import {
  appliedEngineeringQuestionBlockSchema,
  toPublicAppliedEngineeringQuestion,
} from "@/features/practice/applied-engineering/domain/question-contracts";
import {
  appliedEngineeringReviewArtifactSchema
} from "@/features/practice/applied-engineering/domain/review-artifact-contracts";
import { auditAppliedEngineeringContent } from "@/features/practice/applied-engineering/domain/content-release-audit";
import { selectedAppliedEngineeringIncidentSchema } from "@/features/practice/applied-engineering/domain/incident-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";

const focusRevisionSelect = {
  id: true,
  ownerId: true,
  revision: true,
  schemaVersion: true,
  focusFingerprint: true,
  baselineSchemaVersion: true,
  baselineSourceFingerprint: true,
  focusSnapshot: true,
  confirmedAt: true,
  createdAt: true
} satisfies Prisma.AppliedEngineeringFocusRevisionSelect;

const incidentVersionSelect = {
  id: true,
  incidentKey: true,
  version: true,
  schemaVersion: true,
  publicationStatus: true,
  contentFingerprint: true,
  incidentSnapshot: true,
  reviewSnapshot: true,
  publishedAt: true,
  retiredAt: true,
  createdAt: true
} satisfies Prisma.AppliedEngineeringIncidentVersionSelect;

const publishedBlockSelect = {
  id: true,
  ownerId: true,
  ordinal: true,
  isCurrent: true,
  status: true,
  focusRevisionId: true,
  incidentVersionId: true,
  schemaVersion: true,
  rankingPolicyVersion: true,
  preparationRequestId: true,
  contentFingerprint: true,
  preparedAt: true,
  createdAt: true,
  questions: {
    orderBy: { order: "asc" as const },
    select: {
      id: true,
      order: true,
      questionKey: true,
      contentVersion: true,
      contentFingerprint: true,
      status: true,
      publicSnapshot: true
    }
  },
  assessment: { select: { id: true, status: true } }
} satisfies Prisma.AppliedEngineeringBlockSelect;

const preparationAttemptSelect = {
  id: true,
  ownerId: true,
  focusRevisionId: true,
  blockId: true,
  requestId: true,
  status: true,
  generatorVersion: true,
  validatorVersion: true,
  diagnosticsSnapshot: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.AppliedEngineeringPreparationAttemptSelect;

const preparationFailureSchema = z
  .object({
    requestId: z.string().uuid(),
    focusRevisionId: z.string().uuid(),
    generatorVersion: z.string().min(1).max(160),
    validatorVersion: z.string().min(1).max(160),
    selection: appliedEngineeringIncidentSelectionSchema.optional(),
    diagnostic: z
      .object({
        stage: z.enum(["ranking", "story-generation", "question-generation", "validation", "publishing"]),
        code: z.string().min(2).max(120),
        message: z.string().min(2).max(700),
        retryable: z.boolean()
      })
      .strict()
  })
  .strict();

export type SavedAppliedEngineeringFocusRevision = Prisma.AppliedEngineeringFocusRevisionGetPayload<{
  select: typeof focusRevisionSelect;
}>;
export type PublishedAppliedEngineeringIncidentVersion = Prisma.AppliedEngineeringIncidentVersionGetPayload<{
  select: typeof incidentVersionSelect;
}>;
export type PublishedAppliedEngineeringBlock = Prisma.AppliedEngineeringBlockGetPayload<{
  select: typeof publishedBlockSelect;
}>;
export type AppliedEngineeringPreparationAttemptRecord = Prisma.AppliedEngineeringPreparationAttemptGetPayload<{
  select: typeof preparationAttemptSelect;
}>;

export type PublishAppliedEngineeringBlockInput = {
  requestId: string;
  focusRevisionId: string;
  previousBlockId?: string;
  selection: AppliedEngineeringIncidentSelection;
  draft: {
    incident: z.input<typeof selectedAppliedEngineeringIncidentSchema>;
    questionBlock: z.input<typeof appliedEngineeringQuestionBlockSchema>;
  };
  generatorVersion: string;
  validatorVersion: string;
  evaluatorVersion: string;
};

/** Persistence boundary for immutable Applied Engineering content and blocks. */
export class AppliedEngineeringPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async saveConfirmedFocus(
    ownerId: string,
    rawFocus: AppliedEngineeringConfirmedFocus
  ): Promise<SavedAppliedEngineeringFocusRevision> {
    const focus = appliedEngineeringConfirmedFocusSchema.parse(rawFocus);
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `applied-engineering-focus:${ownerId}`);
      const owner = await tx.candidateProfile.findUnique({
        where: { ownerId },
        select: { ownerId: true, activeAppliedEngineeringFocusRevisionId: true }
      });
      if (!owner) {
        throw new NotFoundErrorException(
          "APPLIED_ENGINEERING_PROFILE_NOT_FOUND",
          "Your profile could not be found."
        );
      }
      const existing = await tx.appliedEngineeringFocusRevision.findUnique({
        where: {
          ownerId_focusFingerprint_schemaVersion: {
            ownerId,
            focusFingerprint: focus.focusFingerprint,
            schemaVersion: focus.schemaVersion
          }
        },
        select: focusRevisionSelect
      });
      if (existing) {
        if (owner.activeAppliedEngineeringFocusRevisionId !== existing.id) {
          await tx.candidateProfile.update({
            where: { ownerId },
            data: { activeAppliedEngineeringFocusRevisionId: existing.id }
          });
        }
        return existing;
      }
      const latest = await tx.appliedEngineeringFocusRevision.findFirst({
        where: { ownerId },
        orderBy: { revision: "desc" },
        select: { revision: true }
      });
      const created = await tx.appliedEngineeringFocusRevision.create({
        data: {
          ownerId,
          revision: (latest?.revision ?? 0) + 1,
          schemaVersion: focus.schemaVersion,
          focusFingerprint: focus.focusFingerprint,
          baselineSchemaVersion: focus.baselineEvidence.schemaVersion,
          baselineSourceFingerprint: focus.baselineEvidence.sourceFingerprint,
          focusSnapshot: toJson(focus),
          confirmedAt: new Date(focus.confirmedAt)
        },
        select: focusRevisionSelect
      });
      await tx.candidateProfile.update({
        where: { ownerId },
        data: { activeAppliedEngineeringFocusRevisionId: created.id }
      });
      return created;
    }, transactionOptions);
  }

  async publishReviewedIncidentVersion(
    rawArtifact: unknown
  ): Promise<PublishedAppliedEngineeringIncidentVersion> {
    const artifact = appliedEngineeringReviewArtifactSchema.parse(rawArtifact);
    const audit = auditAppliedEngineeringContent(artifact);
    if (!audit.releaseEligible) {
      throw new ConflictErrorException(
        "APPLIED_ENGINEERING_HUMAN_REVIEW_REQUIRED",
        "A release-eligible human approval is required before publishing this incident."
      );
    }
    const contentFingerprint = fingerprint(artifact.incident);
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `applied-engineering-incident:${artifact.incident.key}`);
      const existing = await tx.appliedEngineeringIncidentVersion.findUnique({
        where: {
          incidentKey_contentFingerprint: {
            incidentKey: artifact.incident.key,
            contentFingerprint
          }
        },
        select: incidentVersionSelect
      });
      if (existing) {
        if (existing.publicationStatus !== AppliedEngineeringIncidentPublicationStatus.PUBLISHED) {
          throw new ConflictErrorException(
            "APPLIED_ENGINEERING_INCIDENT_VERSION_NOT_PUBLISHED",
            "This immutable incident content already exists without a published approval."
          );
        }
        return existing;
      }
      const latest = await tx.appliedEngineeringIncidentVersion.findFirst({
        where: { incidentKey: artifact.incident.key },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      await tx.appliedEngineeringIncidentDefinition.upsert({
        where: { key: artifact.incident.key },
        create: { key: artifact.incident.key, title: artifact.incident.title },
        update: { title: artifact.incident.title }
      });
      return tx.appliedEngineeringIncidentVersion.create({
        data: {
          incidentKey: artifact.incident.key,
          version: (latest?.version ?? 0) + 1,
          schemaVersion: artifact.incident.schemaVersion,
          publicationStatus: AppliedEngineeringIncidentPublicationStatus.PUBLISHED,
          contentFingerprint,
          incidentSnapshot: toJson(artifact.incident),
          reviewSnapshot: toJson({
            caseKey: artifact.caseKey,
            authoredAt: artifact.authoredAt,
            humanReview: artifact.humanReview
          }),
          publishedAt: this.now()
        },
        select: incidentVersionSelect
      });
    }, transactionOptions);
  }

  async publishPreparedBlock(
    ownerId: string,
    rawInput: PublishAppliedEngineeringBlockInput
  ): Promise<PublishedAppliedEngineeringBlock> {
    const input = parsePublishInput(rawInput);
    assertCompleteDraft(input);
    const questionRows = input.draft.questionBlock.questions.map((question) => ({
      question,
      publicQuestion: toPublicAppliedEngineeringQuestion(question, false),
      contentFingerprint: fingerprint(question)
    }));
    const blockFingerprint = fingerprint({
      focusFingerprint: input.selection.focusFingerprint,
      selection: input.selection,
      incident: input.draft.incident,
      questionBlock: input.draft.questionBlock
    });
    const preparedAt = this.now();

    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `applied-engineering-block:${ownerId}`);
      const existingAttempt = await tx.appliedEngineeringPreparationAttempt.findUnique({
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: { status: true, blockId: true, focusRevisionId: true }
      });
      if (existingAttempt && existingAttempt.focusRevisionId !== input.focusRevisionId) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_PREPARATION_REQUEST_CONFLICT",
          "This preparation request ID belongs to a different focus revision."
        );
      }
      if (existingAttempt?.blockId) {
        const replay = await tx.appliedEngineeringBlock.findFirst({
          where: { id: existingAttempt.blockId, ownerId },
          select: publishedBlockSelect
        });
        if (replay) return replay;
      }
      if (existingAttempt && existingAttempt.status !== AppliedEngineeringPreparationStatus.FAILED) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_PREPARATION_NOT_REPLAYABLE",
          "This preparation request did not publish a reusable block."
        );
      }
      const focus = await tx.appliedEngineeringFocusRevision.findUnique({
        where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
        select: { id: true, focusFingerprint: true }
      });
      if (!focus || focus.focusFingerprint !== input.selection.focusFingerprint) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_FOCUS_MISMATCH",
          "The selected incident does not belong to the confirmed focus revision."
        );
      }
      const incidentVersion = await tx.appliedEngineeringIncidentVersion.findUnique({
        where: {
          incidentKey_version: {
            incidentKey: input.selection.selectedIncident.incidentKey,
            version: input.selection.selectedIncident.incidentVersion
          }
        },
        select: { id: true, publicationStatus: true, incidentSnapshot: true }
      });
      if (!incidentVersion || incidentVersion.publicationStatus !== AppliedEngineeringIncidentPublicationStatus.PUBLISHED) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_INCIDENT_NOT_PUBLISHED",
          "The selected Applied Engineering incident version is not published."
        );
      }
      const storedIncident = selectedAppliedEngineeringIncidentSchema.parse(incidentVersion.incidentSnapshot);
      if (storedIncident.key !== input.draft.incident.key || storedIncident.title !== input.draft.incident.title) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_REVIEWED_CONTRACT_MISMATCH",
          "The generated block differs from its published reviewed incident contract."
        );
      }

      const current = await tx.appliedEngineeringBlock.findFirst({
        where: { ownerId, isCurrent: true },
        select: publishedBlockSelect
      });
      if (current && !input.previousBlockId) return current;
      if (current && input.previousBlockId && current.id !== input.previousBlockId) {
        throw new ConflictErrorException(
          "APPLIED_ENGINEERING_CONTINUATION_STALE",
          "A newer Applied Engineering incident has already replaced this continuation."
        );
      }
      const latest = await tx.appliedEngineeringBlock.findFirst({
        where: { ownerId },
        orderBy: { ordinal: "desc" },
        select: { ordinal: true }
      });
      const attempt = existingAttempt
        ? await tx.appliedEngineeringPreparationAttempt.update({
            where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
            data: {
              status: AppliedEngineeringPreparationStatus.IN_PROGRESS,
              generatorVersion: input.generatorVersion,
              validatorVersion: input.validatorVersion,
              selectionSnapshot: toJson(input.selection),
              diagnosticsSnapshot: Prisma.DbNull,
              startedAt: preparedAt,
              completedAt: null
            },
            select: { id: true }
          })
        : await tx.appliedEngineeringPreparationAttempt.create({
            data: {
              ownerId,
              focusRevisionId: input.focusRevisionId,
              requestId: input.requestId,
              status: AppliedEngineeringPreparationStatus.IN_PROGRESS,
              generatorVersion: input.generatorVersion,
              validatorVersion: input.validatorVersion,
              selectionSnapshot: toJson(input.selection),
              startedAt: preparedAt
            },
            select: { id: true }
          });
      if (current) {
        await tx.appliedEngineeringBlock.update({
          where: { id_ownerId: { id: current.id, ownerId } },
          data: { isCurrent: false }
        });
      }
      const block = await tx.appliedEngineeringBlock.create({
        data: {
          ordinal: (latest?.ordinal ?? 0) + 1,
          owner: { connect: { ownerId } },
          focusRevision: { connect: { id_ownerId: { id: input.focusRevisionId, ownerId } } },
          incidentVersion: { connect: { id: incidentVersion.id } },
          schemaVersion: input.draft.questionBlock.schemaVersion,
          rankingPolicyVersion: input.selection.policyVersion,
          preparationRequestId: input.requestId,
          contentFingerprint: blockFingerprint,
          selectionSnapshot: toJson(input.selection),
          incidentSnapshot: toJson(input.draft.incident),
          preparedAt,
          questions: {
            create: questionRows.map(({ question, publicQuestion, contentFingerprint }) => ({
              owner: { connect: { ownerId } },
              order: question.order,
              questionKey: question.key,
              contentVersion: question.schemaVersion,
              contentFingerprint,
              publicSnapshot: toJson(publicQuestion),
              privateSnapshot: toJson(question),
              state: { create: { owner: { connect: { ownerId } } } }
            }))
          },
          assessment: {
            create: {
              owner: { connect: { ownerId } },
              schemaVersion: 1,
              evaluatorVersion: input.evaluatorVersion
            }
          }
        },
        select: publishedBlockSelect
      });
      await Promise.all([
        tx.appliedEngineeringPreparationAttempt.update({
          where: { id: attempt.id },
          data: { status: AppliedEngineeringPreparationStatus.SUCCEEDED, blockId: block.id, completedAt: preparedAt }
        }),
        tx.appliedEngineeringIncidentProgress.upsert({
          where: { ownerId_incidentKey: { ownerId, incidentKey: input.selection.selectedIncident.incidentKey } },
          create: {
            ownerId,
            incidentKey: input.selection.selectedIncident.incidentKey,
            status: AppliedEngineeringIncidentProgressStatus.PRACTISING,
            unlockedAt: preparedAt,
            startedAt: preparedAt
          },
          update: { status: AppliedEngineeringIncidentProgressStatus.PRACTISING, startedAt: preparedAt }
        })
      ]);
      return block;
    }, transactionOptions);
  }

  async recordPreparationFailure(
    ownerId: string,
    rawInput: z.input<typeof preparationFailureSchema>
  ): Promise<AppliedEngineeringPreparationAttemptRecord> {
    const input = preparationFailureSchema.parse(rawInput);
    const failedAt = this.now();
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `applied-engineering-block:${ownerId}`);
      const focus = await tx.appliedEngineeringFocusRevision.findUnique({
        where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
        select: { id: true }
      });
      if (!focus) throw new ConflictErrorException("APPLIED_ENGINEERING_FOCUS_MISMATCH", "The failed preparation does not belong to this candidate's focus revision.");
      const existing = await tx.appliedEngineeringPreparationAttempt.findUnique({
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: preparationAttemptSelect
      });
      if (existing && existing.focusRevisionId !== input.focusRevisionId) throw new ConflictErrorException("APPLIED_ENGINEERING_PREPARATION_REQUEST_CONFLICT", "This preparation request ID belongs to a different focus revision.");
      if (existing?.status === AppliedEngineeringPreparationStatus.SUCCEEDED || existing?.status === AppliedEngineeringPreparationStatus.FAILED) return existing;
      const data = { status: AppliedEngineeringPreparationStatus.FAILED, diagnosticsSnapshot: toJson(input.diagnostic), completedAt: failedAt } as const;
      if (existing) return tx.appliedEngineeringPreparationAttempt.update({ where: { id: existing.id }, data, select: preparationAttemptSelect });
      return tx.appliedEngineeringPreparationAttempt.create({
        data: {
          ownerId,
          focusRevisionId: input.focusRevisionId,
          requestId: input.requestId,
          status: AppliedEngineeringPreparationStatus.FAILED,
          generatorVersion: input.generatorVersion,
          validatorVersion: input.validatorVersion,
          selectionSnapshot: toJson(input.selection ?? { status: "unavailable-before-selection" }),
          diagnosticsSnapshot: toJson(input.diagnostic),
          startedAt: failedAt,
          completedAt: failedAt
        },
        select: preparationAttemptSelect
      });
    }, transactionOptions);
  }
}

function parsePublishInput(input: PublishAppliedEngineeringBlockInput) {
  return {
    requestId: z.string().uuid().parse(input.requestId),
    focusRevisionId: z.string().uuid().parse(input.focusRevisionId),
    previousBlockId: z.string().uuid().optional().parse(input.previousBlockId),
    selection: appliedEngineeringIncidentSelectionSchema.parse(input.selection),
    draft: {
      incident: selectedAppliedEngineeringIncidentSchema.parse(input.draft.incident),
      questionBlock: appliedEngineeringQuestionBlockSchema.parse(input.draft.questionBlock)
    },
    generatorVersion: z.string().min(1).max(160).parse(input.generatorVersion),
    validatorVersion: z.string().min(1).max(160).parse(input.validatorVersion),
    evaluatorVersion: z.string().min(1).max(160).parse(input.evaluatorVersion)
  };
}

function assertCompleteDraft(input: ReturnType<typeof parsePublishInput>): void {
  const selected = input.selection.selectedIncident;
  if (
    selected.incidentKey !== input.draft.incident.key ||
    selected.title !== input.draft.incident.title ||
    input.draft.questionBlock.incidentKey !== input.draft.incident.key
  ) throw new Error("The ranked selection, incident, and question block do not match");
  const orders = input.draft.questionBlock.questions.map((question) => question.order);
  if (new Set(orders).size !== 8 || orders.some((order, index) => order !== index + 1)) {
    throw new Error("A published Applied Engineering block requires eight ordered questions");
  }
  input.draft.questionBlock.questions.forEach((question, index) => {
    const stage = input.draft.incident.stages[index];
    if (!stage || question.stageKey !== stage.key || question.format !== stage.format || question.patternKey !== stage.patternKey) {
      throw new Error(`Question ${index + 1} does not match its frozen incident stage`);
    }
  });
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

const transactionOptions = { maxWait: 20_000, timeout: 120_000 } as const;
