import {
  ArchitecturePreparationStatus,
  ArchitectureScenarioProgressStatus,
  ArchitectureScenarioPublicationStatus,
  Prisma
} from "@prisma/client";
import { z } from "zod";
import { auditArchitectureDesignContent } from "@/features/practice/architecture-design/domain/content-release-audit";
import {
  architectureDesignConfirmedFocusSchema,
  architectureDesignScenarioSelectionSchema,
  type ArchitectureDesignConfirmedFocus,
  type ArchitectureDesignScenarioSelection
} from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import {
  architectureDesignQuestionBlockSchema,
  toPublicArchitectureDesignQuestion
} from "@/features/practice/architecture-design/domain/question-contracts";
import { architectureDesignReviewArtifactSchema } from "@/features/practice/architecture-design/domain/review-artifact-contracts";
import { architectureDesignScenarioSchema } from "@/features/practice/architecture-design/domain/scenario-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import { storyPracticeFingerprint } from "@/features/practice/shared/server/practice-orchestrator";

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
} satisfies Prisma.ArchitectureFocusRevisionSelect;

const scenarioVersionSelect = {
  id: true,
  scenarioKey: true,
  version: true,
  schemaVersion: true,
  publicationStatus: true,
  contentFingerprint: true,
  scenarioSnapshot: true,
  publicQuestionSnapshot: true,
  privateQuestionSnapshot: true,
  reviewSnapshot: true,
  publishedAt: true,
  retiredAt: true,
  createdAt: true
} satisfies Prisma.ArchitectureScenarioVersionSelect;

const publishedBlockSelect = {
  id: true,
  ownerId: true,
  ordinal: true,
  isCurrent: true,
  status: true,
  focusRevisionId: true,
  scenarioVersionId: true,
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
  assessment: {
    select: { id: true, status: true, evaluatorVersion: true, evaluatorFingerprint: true }
  }
} satisfies Prisma.ArchitectureBlockSelect;

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
} satisfies Prisma.ArchitecturePreparationAttemptSelect;

const preparationFailureSchema = z
  .object({
    requestId: z.string().uuid(),
    focusRevisionId: z.string().uuid(),
    generatorVersion: z.string().trim().min(1).max(160),
    validatorVersion: z.string().trim().min(1).max(160),
    selection: architectureDesignScenarioSelectionSchema.optional(),
    diagnostic: z
      .object({
        stage: z.enum(["ranking", "content-reading", "validation", "publishing"]),
        code: z.string().trim().min(2).max(120),
        message: z.string().trim().min(2).max(700),
        retryable: z.boolean()
      })
      .strict()
  })
  .strict();

export type SavedArchitectureFocusRevision = Prisma.ArchitectureFocusRevisionGetPayload<{
  select: typeof focusRevisionSelect;
}>;
export type PublishedArchitectureScenarioVersion = Prisma.ArchitectureScenarioVersionGetPayload<{
  select: typeof scenarioVersionSelect;
}>;
export type PublishedArchitectureBlock = Prisma.ArchitectureBlockGetPayload<{
  select: typeof publishedBlockSelect;
}>;
export type ArchitecturePreparationAttemptRecord = Prisma.ArchitecturePreparationAttemptGetPayload<{
  select: typeof preparationAttemptSelect;
}>;

export type PublishArchitectureBlockInput = {
  requestId: string;
  focusRevisionId: string;
  previousBlockId?: string;
  selection: ArchitectureDesignScenarioSelection;
  draft: {
    scenario: z.input<typeof architectureDesignScenarioSchema>;
    questionBlock: z.input<typeof architectureDesignQuestionBlockSchema>;
  };
  generatorVersion: string;
  validatorVersion: string;
  evaluatorVersion: string;
};

/** Durable Architecture boundary; lifecycle services remain in the shared orchestrators. */
export class ArchitectureDesignPersistenceService {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async saveConfirmedFocus(
    ownerId: string,
    rawFocus: ArchitectureDesignConfirmedFocus
  ): Promise<SavedArchitectureFocusRevision> {
    const focus = architectureDesignConfirmedFocusSchema.parse(rawFocus);
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `architecture-design-focus:${ownerId}`);
      const owner = await tx.candidateProfile.findUnique({
        where: { ownerId },
        select: { ownerId: true, activeArchitectureFocusRevisionId: true }
      });
      if (!owner) {
        throw new NotFoundErrorException(
          "ARCHITECTURE_DESIGN_PROFILE_NOT_FOUND",
          "Your profile could not be found."
        );
      }
      const existing = await tx.architectureFocusRevision.findUnique({
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
        if (owner.activeArchitectureFocusRevisionId !== existing.id) {
          await tx.candidateProfile.update({
            where: { ownerId },
            data: { activeArchitectureFocusRevisionId: existing.id }
          });
        }
        return existing;
      }
      const latest = await tx.architectureFocusRevision.findFirst({
        where: { ownerId },
        orderBy: { revision: "desc" },
        select: { revision: true }
      });
      const created = await tx.architectureFocusRevision.create({
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
        data: { activeArchitectureFocusRevisionId: created.id }
      });
      return created;
    }, transactionOptions);
  }

  async publishReviewedScenarioVersion(
    rawArtifact: unknown
  ): Promise<PublishedArchitectureScenarioVersion> {
    const artifact = architectureDesignReviewArtifactSchema.parse(rawArtifact);
    const audit = auditArchitectureDesignContent(artifact);
    if (!audit.releaseEligible) {
      throw new ConflictErrorException(
        "ARCHITECTURE_DESIGN_HUMAN_REVIEW_REQUIRED",
        "A release-eligible human approval is required before publishing this scenario."
      );
    }
    const contentFingerprint = storyPracticeFingerprint({
      scenario: artifact.scenario,
      questionBlock: artifact.questionBlock
    });
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `architecture-design-scenario:${artifact.scenario.key}`);
      const existing = await tx.architectureScenarioVersion.findUnique({
        where: {
          scenarioKey_contentFingerprint: {
            scenarioKey: artifact.scenario.key,
            contentFingerprint
          }
        },
        select: scenarioVersionSelect
      });
      if (existing) {
        if (existing.publicationStatus !== ArchitectureScenarioPublicationStatus.PUBLISHED) {
          throw new ConflictErrorException(
            "ARCHITECTURE_DESIGN_SCENARIO_VERSION_NOT_PUBLISHED",
            "This immutable scenario content already exists without a published approval."
          );
        }
        return existing;
      }
      const latest = await tx.architectureScenarioVersion.findFirst({
        where: { scenarioKey: artifact.scenario.key },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      await tx.architectureScenarioDefinition.upsert({
        where: { key: artifact.scenario.key },
        create: { key: artifact.scenario.key, title: artifact.scenario.title },
        update: { title: artifact.scenario.title }
      });
      return tx.architectureScenarioVersion.create({
        data: {
          scenarioKey: artifact.scenario.key,
          version: (latest?.version ?? 0) + 1,
          schemaVersion: artifact.scenario.schemaVersion,
          publicationStatus: ArchitectureScenarioPublicationStatus.PUBLISHED,
          contentFingerprint,
          scenarioSnapshot: toJson(artifact.scenario),
          publicQuestionSnapshot: toJson({
            schemaVersion: artifact.questionBlock.schemaVersion,
            scenarioKey: artifact.questionBlock.scenarioKey,
            questions: artifact.questionBlock.questions.map((question) =>
              toPublicArchitectureDesignQuestion(question, false)
            )
          }),
          privateQuestionSnapshot: toJson(artifact.questionBlock),
          reviewSnapshot: toJson({
            artifactVersion: artifact.artifactVersion,
            auditVersion: artifact.auditVersion,
            caseKey: artifact.caseKey,
            authoredAt: artifact.authoredAt,
            authoring: artifact.authoring,
            humanReview: artifact.humanReview
          }),
          publishedAt: this.now()
        },
        select: scenarioVersionSelect
      });
    }, transactionOptions);
  }

  async publishPreparedBlock(
    ownerId: string,
    rawInput: PublishArchitectureBlockInput
  ): Promise<PublishedArchitectureBlock> {
    const input = parsePublishInput(rawInput);
    assertCompleteDraft(input);
    const questionRows = input.draft.questionBlock.questions.map((question) => ({
      question,
      publicQuestion: toPublicArchitectureDesignQuestion(question, false),
      contentFingerprint: storyPracticeFingerprint(question)
    }));
    const blockFingerprint = storyPracticeFingerprint({
      focusFingerprint: input.selection.focusFingerprint,
      selection: input.selection,
      scenario: input.draft.scenario,
      questionBlock: input.draft.questionBlock
    });
    const reviewedContentFingerprint = fingerprintPersistedReviewedContent(input.draft);
    const evaluatorFingerprint = storyPracticeFingerprint({ version: input.evaluatorVersion });
    const preparedAt = this.now();

    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `architecture-design-block:${ownerId}`);
      const existingAttempt = await tx.architecturePreparationAttempt.findUnique({
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: { status: true, blockId: true, focusRevisionId: true }
      });
      if (existingAttempt && existingAttempt.focusRevisionId !== input.focusRevisionId) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_PREPARATION_REQUEST_CONFLICT",
          "This preparation request ID belongs to a different focus revision."
        );
      }
      if (existingAttempt?.blockId) {
        const replay = await tx.architectureBlock.findFirst({
          where: { id: existingAttempt.blockId, ownerId },
          select: publishedBlockSelect
        });
        if (replay) return replay;
      }
      if (existingAttempt && existingAttempt.status !== ArchitecturePreparationStatus.FAILED) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_PREPARATION_NOT_REPLAYABLE",
          "This preparation request did not publish a reusable block."
        );
      }
      const focus = await tx.architectureFocusRevision.findUnique({
        where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
        select: { id: true, focusFingerprint: true }
      });
      if (!focus || focus.focusFingerprint !== input.selection.focusFingerprint) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_FOCUS_MISMATCH",
          "The selected scenario does not belong to the confirmed focus revision."
        );
      }
      const selected = input.selection.selectedScenario;
      const scenarioVersion = await tx.architectureScenarioVersion.findUnique({
        where: {
          scenarioKey_version: {
            scenarioKey: selected.scenarioKey,
            version: selected.scenarioVersion
          }
        },
        select: {
          id: true,
          publicationStatus: true,
          scenarioSnapshot: true,
          privateQuestionSnapshot: true
        }
      });
      if (
        !scenarioVersion ||
        scenarioVersion.publicationStatus !== ArchitectureScenarioPublicationStatus.PUBLISHED
      ) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_SCENARIO_NOT_PUBLISHED",
          "The selected Architecture scenario version is not published."
        );
      }
      const persistedReviewedContentFingerprint = fingerprintPersistedReviewedContent({
        scenario: architectureDesignScenarioSchema.parse(scenarioVersion.scenarioSnapshot),
        questionBlock: architectureDesignQuestionBlockSchema.parse(
          scenarioVersion.privateQuestionSnapshot
        )
      });
      if (persistedReviewedContentFingerprint !== reviewedContentFingerprint) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_REVIEWED_CONTRACT_MISMATCH",
          "The prepared block differs from its published reviewed scenario and questions."
        );
      }

      const current = await tx.architectureBlock.findFirst({
        where: { ownerId, isCurrent: true },
        select: publishedBlockSelect
      });
      if (current && !input.previousBlockId) return current;
      if (current && input.previousBlockId && current.id !== input.previousBlockId) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_CONTINUATION_STALE",
          "A newer Architecture scenario has already replaced this continuation."
        );
      }
      const latest = await tx.architectureBlock.findFirst({
        where: { ownerId },
        orderBy: { ordinal: "desc" },
        select: { ordinal: true }
      });
      const attempt = existingAttempt
        ? await tx.architecturePreparationAttempt.update({
            where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
            data: {
              status: ArchitecturePreparationStatus.IN_PROGRESS,
              generatorVersion: input.generatorVersion,
              validatorVersion: input.validatorVersion,
              selectionSnapshot: toJson(input.selection),
              diagnosticsSnapshot: Prisma.DbNull,
              startedAt: preparedAt,
              completedAt: null
            },
            select: { id: true }
          })
        : await tx.architecturePreparationAttempt.create({
            data: {
              ownerId,
              focusRevisionId: input.focusRevisionId,
              requestId: input.requestId,
              status: ArchitecturePreparationStatus.IN_PROGRESS,
              generatorVersion: input.generatorVersion,
              validatorVersion: input.validatorVersion,
              selectionSnapshot: toJson(input.selection),
              startedAt: preparedAt
            },
            select: { id: true }
          });
      if (current) {
        await tx.architectureBlock.update({
          where: { id_ownerId: { id: current.id, ownerId } },
          data: { isCurrent: false }
        });
      }
      const block = await tx.architectureBlock.create({
        data: {
          ordinal: (latest?.ordinal ?? 0) + 1,
          owner: { connect: { ownerId } },
          focusRevision: { connect: { id_ownerId: { id: input.focusRevisionId, ownerId } } },
          scenarioVersion: { connect: { id: scenarioVersion.id } },
          schemaVersion: input.draft.questionBlock.schemaVersion,
          rankingPolicyVersion: input.selection.policyVersion,
          preparationRequestId: input.requestId,
          contentFingerprint: blockFingerprint,
          selectionSnapshot: toJson(input.selection),
          scenarioSnapshot: toJson(input.draft.scenario),
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
              evaluatorVersion: input.evaluatorVersion,
              evaluatorFingerprint
            }
          }
        },
        select: publishedBlockSelect
      });
      await Promise.all([
        tx.architecturePreparationAttempt.update({
          where: { id: attempt.id },
          data: {
            status: ArchitecturePreparationStatus.SUCCEEDED,
            blockId: block.id,
            completedAt: preparedAt
          }
        }),
        tx.architectureScenarioProgress.upsert({
          where: { ownerId_scenarioKey: { ownerId, scenarioKey: selected.scenarioKey } },
          create: {
            ownerId,
            scenarioKey: selected.scenarioKey,
            status: ArchitectureScenarioProgressStatus.PRACTISING,
            unlockedAt: preparedAt,
            startedAt: preparedAt
          },
          update: { status: ArchitectureScenarioProgressStatus.PRACTISING, startedAt: preparedAt }
        })
      ]);
      return block;
    }, transactionOptions);
  }

  async recordPreparationFailure(
    ownerId: string,
    rawInput: z.input<typeof preparationFailureSchema>
  ): Promise<ArchitecturePreparationAttemptRecord> {
    const input = preparationFailureSchema.parse(rawInput);
    const failedAt = this.now();
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `architecture-design-block:${ownerId}`);
      const focus = await tx.architectureFocusRevision.findUnique({
        where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
        select: { id: true }
      });
      if (!focus) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_FOCUS_MISMATCH",
          "The failed preparation does not belong to this candidate's focus revision."
        );
      }
      const existing = await tx.architecturePreparationAttempt.findUnique({
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: preparationAttemptSelect
      });
      if (existing && existing.focusRevisionId !== input.focusRevisionId) {
        throw new ConflictErrorException(
          "ARCHITECTURE_DESIGN_PREPARATION_REQUEST_CONFLICT",
          "This preparation request ID belongs to a different focus revision."
        );
      }
      if (
        existing?.status === ArchitecturePreparationStatus.SUCCEEDED ||
        existing?.status === ArchitecturePreparationStatus.FAILED
      ) {
        return existing;
      }
      const data = {
        status: ArchitecturePreparationStatus.FAILED,
        diagnosticsSnapshot: toJson(input.diagnostic),
        completedAt: failedAt
      } as const;
      if (existing) {
        return tx.architecturePreparationAttempt.update({
          where: { id: existing.id },
          data,
          select: preparationAttemptSelect
        });
      }
      return tx.architecturePreparationAttempt.create({
        data: {
          ownerId,
          focusRevisionId: input.focusRevisionId,
          requestId: input.requestId,
          status: ArchitecturePreparationStatus.FAILED,
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

function parsePublishInput(input: PublishArchitectureBlockInput) {
  return {
    requestId: z.string().uuid().parse(input.requestId),
    focusRevisionId: z.string().uuid().parse(input.focusRevisionId),
    previousBlockId: z.string().uuid().optional().parse(input.previousBlockId),
    selection: architectureDesignScenarioSelectionSchema.parse(input.selection),
    draft: {
      scenario: architectureDesignScenarioSchema.parse(input.draft.scenario),
      questionBlock: architectureDesignQuestionBlockSchema.parse(input.draft.questionBlock)
    },
    generatorVersion: z.string().trim().min(1).max(160).parse(input.generatorVersion),
    validatorVersion: z.string().trim().min(1).max(160).parse(input.validatorVersion),
    evaluatorVersion: z.string().trim().min(1).max(160).parse(input.evaluatorVersion)
  };
}

function assertCompleteDraft(input: ReturnType<typeof parsePublishInput>): void {
  const selected = input.selection.selectedScenario;
  if (
    selected.scenarioKey !== input.draft.scenario.key ||
    selected.title !== input.draft.scenario.title ||
    input.draft.questionBlock.scenarioKey !== input.draft.scenario.key
  ) {
    throw new Error("The ranked selection, scenario, and question block do not match");
  }
  const orders = input.draft.questionBlock.questions.map((question) => question.order);
  if (new Set(orders).size !== 4 || orders.some((order, index) => order !== index + 1)) {
    throw new Error("A published Architecture block requires four ordered questions");
  }
  input.draft.questionBlock.questions.forEach((question, index) => {
    const stage = input.draft.scenario.stages[index];
    if (
      !stage ||
      question.stageKey !== stage.key ||
      question.format !== stage.format ||
      question.artifact.key !== stage.artifactKey
    ) {
      throw new Error(`Question ${index + 1} does not match its frozen scenario stage`);
    }
  });
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fingerprintPersistedReviewedContent(value: {
  scenario: z.input<typeof architectureDesignScenarioSchema>;
  questionBlock: z.input<typeof architectureDesignQuestionBlockSchema>;
}): string {
  return storyPracticeFingerprint(toJson(value));
}

async function lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

const transactionOptions = { maxWait: 20_000, timeout: 120_000 } as const;
