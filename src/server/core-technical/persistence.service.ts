import { createHash } from "node:crypto";
import {
  CoreTechnicalPreparationStatus,
  CoreTechnicalStoryProgressStatus,
  CoreTechnicalStoryPublicationStatus,
  Prisma
} from "@prisma/client";
import { z } from "zod";
import {
  coreTechnicalConfirmedFocusSchema,
  coreTechnicalStorySelectionSchema,
  type CoreTechnicalConfirmedFocus,
  type CoreTechnicalStorySelection
} from "@/lib/practice/core-technical/focus-ranking-contracts";
import {
  frozenQuestionBlockSchema,
  toPublicCoreTechnicalQuestion,
  type FrozenQuestionBlock
} from "@/lib/practice/core-technical/question-contracts";
import { coreTechnicalStoryReviewArtifactSchema } from "@/lib/practice/core-technical/review-artifact-contracts";
import { selectedStorySchema, type SelectedCoreTechnicalStory } from "@/lib/practice/core-technical/story-contracts";
import { coreTechnicalCriticReportSchema } from "@/lib/practice/core-technical/critic-contracts";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import { isCoreTechnicalCriticReportApproved } from "./generation-critic";

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
} satisfies Prisma.CoreTechnicalFocusRevisionSelect;

const storyVersionSelect = {
  id: true,
  storyKey: true,
  version: true,
  schemaVersion: true,
  publicationStatus: true,
  contentFingerprint: true,
  storySnapshot: true,
  reviewSnapshot: true,
  publishedAt: true,
  retiredAt: true,
  createdAt: true
} satisfies Prisma.CoreTechnicalStoryVersionSelect;

const publishedBlockSelect = {
  id: true,
  ownerId: true,
  ordinal: true,
  isCurrent: true,
  status: true,
  focusRevisionId: true,
  storyVersionId: true,
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
} satisfies Prisma.CoreTechnicalBlockSelect;

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
} satisfies Prisma.CoreTechnicalPreparationAttemptSelect;

const preparationFailureSchema = z.object({
  requestId: z.string().uuid(),
  focusRevisionId: z.string().uuid(),
  generatorVersion: z.string().min(1).max(160),
  validatorVersion: z.string().min(1).max(160),
  selection: coreTechnicalStorySelectionSchema.optional(),
  diagnostic: z.object({
    stage: z.enum(["ranking", "story-generation", "question-generation", "validation", "publishing"]),
    code: z.string().min(2).max(120),
    message: z.string().min(2).max(700),
    retryable: z.boolean()
  }).strict()
}).strict();

export type SavedCoreTechnicalFocusRevision = Prisma.CoreTechnicalFocusRevisionGetPayload<{
  select: typeof focusRevisionSelect;
}>;
export type PublishedCoreTechnicalStoryVersion = Prisma.CoreTechnicalStoryVersionGetPayload<{
  select: typeof storyVersionSelect;
}>;
export type PublishedCoreTechnicalBlock = Prisma.CoreTechnicalBlockGetPayload<{
  select: typeof publishedBlockSelect;
}>;
export type CoreTechnicalPreparationAttemptRecord = Prisma.CoreTechnicalPreparationAttemptGetPayload<{
  select: typeof preparationAttemptSelect;
}>;

export type PublishCoreTechnicalBlockInput = {
  requestId: string;
  focusRevisionId: string;
  previousBlockId?: string;
  selection: CoreTechnicalStorySelection;
  draft: {
    story: SelectedCoreTechnicalStory;
    storyReview: unknown;
    questionBlock: FrozenQuestionBlock;
    questionBlockReview: unknown;
  };
  generatorVersion: string;
  validatorVersion: string;
  evaluatorVersion: string;
};

/**
 * Persistence boundary for immutable focus, reviewed story versions, and
 * all-or-nothing eight-question publication. Runtime lifecycle writes begin in Step 12.
 */
export class CoreTechnicalPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async saveConfirmedFocus(
    ownerId: string,
    rawFocus: CoreTechnicalConfirmedFocus
  ): Promise<SavedCoreTechnicalFocusRevision> {
    const focus = coreTechnicalConfirmedFocusSchema.parse(rawFocus);
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `core-technical-focus:${ownerId}`);
      const owner = await tx.candidateProfile.findUnique({
        where: { ownerId },
        select: { ownerId: true, activeCoreTechnicalFocusRevisionId: true }
      });
      if (!owner) {
        throw new NotFoundErrorException(
          "CORE_TECHNICAL_PROFILE_NOT_FOUND",
          "Your profile could not be found."
        );
      }

      const existing = await tx.coreTechnicalFocusRevision.findUnique({
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
        if (owner.activeCoreTechnicalFocusRevisionId !== existing.id) {
          await tx.candidateProfile.update({
            where: { ownerId },
            data: { activeCoreTechnicalFocusRevisionId: existing.id }
          });
        }
        return existing;
      }

      const latest = await tx.coreTechnicalFocusRevision.findFirst({
        where: { ownerId },
        orderBy: { revision: "desc" },
        select: { revision: true }
      });
      const created = await tx.coreTechnicalFocusRevision.create({
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
        data: { activeCoreTechnicalFocusRevisionId: created.id }
      });
      return created;
    }, transactionOptions);
  }

  async publishReviewedStoryVersion(
    rawArtifact: unknown
  ): Promise<PublishedCoreTechnicalStoryVersion> {
    const artifact = coreTechnicalStoryReviewArtifactSchema.parse(rawArtifact);
    if (artifact.humanReview.status !== "approved" || !artifact.evaluation.releaseEligible) {
      throw new ConflictErrorException(
        "CORE_TECHNICAL_HUMAN_REVIEW_REQUIRED",
        "A release-eligible human approval is required before publishing this story."
      );
    }
    if (artifact.story.key !== artifact.questionBlock.storyKey) {
      throw new Error("Reviewed story and question block keys do not match");
    }
    const contentFingerprint = fingerprint(artifact.story);

    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `core-technical-story:${artifact.story.key}`);
      const existing = await tx.coreTechnicalStoryVersion.findUnique({
        where: {
          storyKey_contentFingerprint: {
            storyKey: artifact.story.key,
            contentFingerprint
          }
        },
        select: storyVersionSelect
      });
      if (existing) {
        if (existing.publicationStatus !== CoreTechnicalStoryPublicationStatus.PUBLISHED) {
          throw new ConflictErrorException(
            "CORE_TECHNICAL_STORY_VERSION_NOT_PUBLISHED",
            "This immutable story content already exists without a published approval."
          );
        }
        return existing;
      }

      const latest = await tx.coreTechnicalStoryVersion.findFirst({
        where: { storyKey: artifact.story.key },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      await tx.coreTechnicalStoryDefinition.upsert({
        where: { key: artifact.story.key },
        create: { key: artifact.story.key, title: artifact.story.title },
        update: { title: artifact.story.title }
      });
      return tx.coreTechnicalStoryVersion.create({
        data: {
          storyKey: artifact.story.key,
          version: (latest?.version ?? 0) + 1,
          schemaVersion: artifact.story.schemaVersion,
          publicationStatus: CoreTechnicalStoryPublicationStatus.PUBLISHED,
          contentFingerprint,
          storySnapshot: toJson(artifact.story),
          reviewSnapshot: toJson({
            caseKey: artifact.caseKey,
            generatedAt: artifact.generatedAt,
            storyReview: artifact.storyReview,
            questionBlockReview: artifact.questionBlockReview,
            evaluation: artifact.evaluation,
            humanReview: artifact.humanReview
          }),
          publishedAt: this.now()
        },
        select: storyVersionSelect
      });
    }, transactionOptions);
  }

  async publishPreparedBlock(
    ownerId: string,
    rawInput: PublishCoreTechnicalBlockInput
  ): Promise<PublishedCoreTechnicalBlock> {
    const input = parsePublishInput(rawInput);
    assertCompleteDraft(input);
    const publicQuestions = input.draft.questionBlock.questions.map((question) =>
      toPublicCoreTechnicalQuestion(question, false)
    );
    const questionRows = input.draft.questionBlock.questions.map((question, index) => ({
      question,
      publicQuestion: publicQuestions[index]!,
      contentFingerprint: fingerprint(question)
    }));
    const blockFingerprint = fingerprint({
      focusFingerprint: input.selection.focusFingerprint,
      selection: input.selection,
      story: input.draft.story,
      questionBlock: input.draft.questionBlock
    });
    const preparedAt = this.now();

    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `core-technical-block:${ownerId}`);
      const existingAttempt = await tx.coreTechnicalPreparationAttempt.findUnique({
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: { status: true, blockId: true, focusRevisionId: true }
      });
      if (existingAttempt && existingAttempt.focusRevisionId !== input.focusRevisionId) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_PREPARATION_REQUEST_CONFLICT",
          "This preparation request ID belongs to a different focus revision."
        );
      }
      if (existingAttempt?.blockId) {
        const replay = await tx.coreTechnicalBlock.findFirst({
          where: { id: existingAttempt.blockId, ownerId },
          select: publishedBlockSelect
        });
        if (replay) return replay;
      }
      if (existingAttempt && existingAttempt.status !== CoreTechnicalPreparationStatus.FAILED) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_PREPARATION_NOT_REPLAYABLE",
          "This preparation request did not publish a reusable block."
        );
      }

      const focus = await tx.coreTechnicalFocusRevision.findUnique({
        where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
        select: { id: true, focusFingerprint: true }
      });
      if (!focus || focus.focusFingerprint !== input.selection.focusFingerprint) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_FOCUS_MISMATCH",
          "The selected story does not belong to the confirmed focus revision."
        );
      }
      const storyVersion = await tx.coreTechnicalStoryVersion.findUnique({
        where: {
          storyKey_version: {
            storyKey: input.selection.selectedStory.storyKey,
            version: input.selection.selectedStory.storyVersion
          }
        },
        select: { id: true, publicationStatus: true, storySnapshot: true }
      });
      if (!storyVersion || storyVersion.publicationStatus !== CoreTechnicalStoryPublicationStatus.PUBLISHED) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_STORY_NOT_PUBLISHED",
          "The selected Core Technical story version is not published."
        );
      }
      assertReviewedContractMatches(storyVersion.storySnapshot, input.draft.story);

      const current = await tx.coreTechnicalBlock.findFirst({
        where: { ownerId, isCurrent: true },
        select: publishedBlockSelect
      });
      if (current) {
        if (input.previousBlockId && current.id === input.previousBlockId) {
          if (
            current.status !== "ASSESSED" ||
            current.assessment?.status !== "COMPLETED"
          ) {
            throw new ConflictErrorException(
              "CORE_TECHNICAL_CONTINUATION_NOT_READY",
              "Complete the current story assessment before continuing."
            );
          }
        } else {
          if (input.previousBlockId) {
            const previous = await tx.coreTechnicalBlock.findFirst({
              where: { id: input.previousBlockId, ownerId },
              select: { ordinal: true, status: true }
            });
            if (
              !previous ||
              previous.status !== "ASSESSED" ||
              current.ordinal !== previous.ordinal + 1
            ) {
              throw new ConflictErrorException(
                "CORE_TECHNICAL_CONTINUATION_STALE",
                "A newer Core Technical story has already replaced this continuation."
              );
            }
          }
          await tx.coreTechnicalPreparationAttempt.create({
            data: {
              ownerId,
              focusRevisionId: input.focusRevisionId,
              blockId: current.id,
              requestId: input.requestId,
              status: CoreTechnicalPreparationStatus.SUCCEEDED,
              generatorVersion: input.generatorVersion,
              validatorVersion: input.validatorVersion,
              selectionSnapshot: toJson(input.selection),
              startedAt: preparedAt,
              completedAt: preparedAt
            }
          });
          return current;
        }
      } else if (input.previousBlockId) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_CONTINUATION_STALE",
          "The story selected for continuation is no longer current."
        );
      }

      const latest = await tx.coreTechnicalBlock.findFirst({
        where: { ownerId },
        orderBy: { ordinal: "desc" },
        select: { ordinal: true }
      });
      const attempt = existingAttempt
        ? await tx.coreTechnicalPreparationAttempt.update({
            where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
            data: {
              status: CoreTechnicalPreparationStatus.IN_PROGRESS,
              generatorVersion: input.generatorVersion,
              validatorVersion: input.validatorVersion,
              selectionSnapshot: toJson(input.selection),
              diagnosticsSnapshot: Prisma.DbNull,
              startedAt: preparedAt,
              completedAt: null
            },
            select: { id: true }
          })
        : await tx.coreTechnicalPreparationAttempt.create({
            data: {
              ownerId,
              focusRevisionId: input.focusRevisionId,
              requestId: input.requestId,
              status: CoreTechnicalPreparationStatus.IN_PROGRESS,
              generatorVersion: input.generatorVersion,
              validatorVersion: input.validatorVersion,
              selectionSnapshot: toJson(input.selection),
              startedAt: preparedAt
            },
            select: { id: true }
          });
      if (current && input.previousBlockId) {
        await tx.coreTechnicalBlock.update({
          where: { id_ownerId: { id: current.id, ownerId } },
          data: { isCurrent: false }
        });
      }
      const block = await tx.coreTechnicalBlock.create({
        data: {
          ordinal: (latest?.ordinal ?? 0) + 1,
          owner: { connect: { ownerId } },
          focusRevision: {
            connect: { id_ownerId: { id: input.focusRevisionId, ownerId } }
          },
          storyVersion: { connect: { id: storyVersion.id } },
          schemaVersion: input.draft.questionBlock.schemaVersion,
          rankingPolicyVersion: input.selection.policyVersion,
          preparationRequestId: input.requestId,
          contentFingerprint: blockFingerprint,
          selectionSnapshot: toJson(input.selection),
          storySnapshot: toJson(input.draft.story),
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
        tx.coreTechnicalPreparationAttempt.update({
          where: { id: attempt.id },
          data: {
            status: CoreTechnicalPreparationStatus.SUCCEEDED,
            blockId: block.id,
            completedAt: preparedAt
          }
        }),
        tx.coreTechnicalStoryProgress.upsert({
          where: {
            ownerId_storyKey: {
              ownerId,
              storyKey: input.selection.selectedStory.storyKey
            }
          },
          create: {
            ownerId,
            storyKey: input.selection.selectedStory.storyKey,
            status: CoreTechnicalStoryProgressStatus.PRACTISING,
            unlockedAt: preparedAt,
            startedAt: preparedAt
          },
          update: {
            status: CoreTechnicalStoryProgressStatus.PRACTISING,
            startedAt: preparedAt
          }
        })
      ]);
      return block;
    }, transactionOptions);
  }

  /** Saves bounded server-only failure metadata without ever creating a partial block. */
  async recordPreparationFailure(
    ownerId: string,
    rawInput: z.input<typeof preparationFailureSchema>
  ): Promise<CoreTechnicalPreparationAttemptRecord> {
    const input = preparationFailureSchema.parse(rawInput);
    const failedAt = this.now();
    return this.prisma.$transaction(async (tx) => {
      await lock(tx, `core-technical-block:${ownerId}`);
      const focus = await tx.coreTechnicalFocusRevision.findUnique({
        where: { id_ownerId: { id: input.focusRevisionId, ownerId } },
        select: { id: true }
      });
      if (!focus) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_FOCUS_MISMATCH",
          "The failed preparation does not belong to this candidate's focus revision."
        );
      }
      const existing = await tx.coreTechnicalPreparationAttempt.findUnique({
        where: { ownerId_requestId: { ownerId, requestId: input.requestId } },
        select: preparationAttemptSelect
      });
      if (existing && existing.focusRevisionId !== input.focusRevisionId) {
        throw new ConflictErrorException(
          "CORE_TECHNICAL_PREPARATION_REQUEST_CONFLICT",
          "This preparation request ID belongs to a different focus revision."
        );
      }
      if (existing?.status === CoreTechnicalPreparationStatus.SUCCEEDED ||
          existing?.status === CoreTechnicalPreparationStatus.FAILED) return existing;

      const data = {
        status: CoreTechnicalPreparationStatus.FAILED,
        diagnosticsSnapshot: toJson(input.diagnostic),
        completedAt: failedAt
      } as const;
      if (existing) {
        return tx.coreTechnicalPreparationAttempt.update({
          where: { id: existing.id },
          data,
          select: preparationAttemptSelect
        });
      }
      return tx.coreTechnicalPreparationAttempt.create({
        data: {
          ownerId,
          focusRevisionId: input.focusRevisionId,
          requestId: input.requestId,
          status: CoreTechnicalPreparationStatus.FAILED,
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

function parsePublishInput(input: PublishCoreTechnicalBlockInput) {
  return {
    requestId: z.string().uuid().parse(input.requestId),
    focusRevisionId: z.string().uuid().parse(input.focusRevisionId),
    previousBlockId: z.string().uuid().optional().parse(input.previousBlockId),
    selection: coreTechnicalStorySelectionSchema.parse(input.selection),
    draft: {
      story: selectedStorySchema.parse(input.draft.story),
      storyReview: coreTechnicalCriticReportSchema.parse(input.draft.storyReview),
      questionBlock: frozenQuestionBlockSchema.parse(input.draft.questionBlock),
      questionBlockReview: coreTechnicalCriticReportSchema.parse(input.draft.questionBlockReview)
    },
    generatorVersion: z.string().min(1).max(160).parse(input.generatorVersion),
    validatorVersion: z.string().min(1).max(160).parse(input.validatorVersion),
    evaluatorVersion: z.string().min(1).max(160).parse(input.evaluatorVersion)
  };
}

function assertCompleteDraft(input: ReturnType<typeof parsePublishInput>): void {
  const { story, storyReview, questionBlock, questionBlockReview } = input.draft;
  if (!isCoreTechnicalCriticReportApproved(storyReview) || !isCoreTechnicalCriticReportApproved(questionBlockReview)) {
    throw new ConflictErrorException(
      "CORE_TECHNICAL_CRITIC_APPROVAL_REQUIRED",
      "The complete story and question block must pass every critic before publication."
    );
  }
  const selected = input.selection.selectedStory;
  if (
    input.selection.focusFingerprint.length === 0 ||
    selected.storyKey !== story.key ||
    selected.title !== story.title ||
    selected.difficulty !== story.difficulty ||
    questionBlock.storyKey !== story.key
  ) throw new Error("The ranked selection, story, and question block do not match");

  const orders = questionBlock.questions.map((question) => question.order);
  const keys = questionBlock.questions.map((question) => question.key);
  if (
    new Set(orders).size !== 8 ||
    orders.some((order, index) => order !== index + 1) ||
    new Set(keys).size !== 8
  ) throw new Error("A published Core Technical block requires eight unique ordered questions");
  questionBlock.questions.forEach((question, index) => {
    const stage = story.stages[index];
    if (
      !stage ||
      question.storyKey !== story.key ||
      question.stageKey !== stage.key ||
      question.patternKey !== stage.patternKey ||
      question.format !== stage.format
    ) throw new Error(`Question ${index + 1} does not match its frozen story stage`);
  });
}

function assertReviewedContractMatches(rawReviewedStory: Prisma.JsonValue, story: SelectedCoreTechnicalStory): void {
  const reviewed = selectedStorySchema.parse(rawReviewedStory);
  if (
    reviewed.key !== story.key ||
    reviewed.title !== story.title ||
    reviewed.stages.some((stage, index) => stage.patternKey !== story.stages[index]?.patternKey)
  ) throw new ConflictErrorException(
    "CORE_TECHNICAL_REVIEWED_CONTRACT_MISMATCH",
    "The generated block differs from its published reviewed story contract."
  );
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(
      ([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`
    ).join(",")}}`;
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
