import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  CoreTechnicalPreparationStatus,
  CoreTechnicalStoryPublicationStatus
} from "@prisma/client";
import rawArtifact from "@/features/practice/core-technical/domain/generated/follow-operation-guided-benchmark.json";
import { coreTechnicalStoryReviewArtifactSchema } from "@/features/practice/core-technical/domain/review-artifact-contracts";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "@/features/practice/core-technical/domain/story-ranking-catalogue";
import type { CoreTechnicalConfirmedFocus } from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import type { PrismaService } from "@/server/database/prisma.service";
import { CoreTechnicalStoryRankingService } from "./story-ranking.service";
import { CoreTechnicalPersistenceService } from "./persistence.service";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const FOCUS_ID = "22222222-2222-4222-8222-222222222222";
const STORY_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const BLOCK_ID = "44444444-4444-4444-8444-444444444444";
const artifact = coreTechnicalStoryReviewArtifactSchema.parse(rawArtifact);

describe("CoreTechnicalPersistenceService", () => {
  it("saves a content-addressed focus revision and advances only its active pointer", async () => {
    const created = focusRecord();
    const tx = focusTransaction({ created });
    const service = new CoreTechnicalPersistenceService(prisma(tx));

    const result = await service.saveConfirmedFocus("owner-1", confirmedFocus());

    expect(result).toEqual(created);
    expect(tx.coreTechnicalFocusRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: "owner-1",
          revision: 1,
          focusFingerprint: confirmedFocus().focusFingerprint,
          baselineSourceFingerprint: confirmedFocus().baselineEvidence.sourceFingerprint
        })
      })
    );
    expect(tx.candidateProfile.update).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      data: { activeCoreTechnicalFocusRevisionId: FOCUS_ID }
    });
  });

  it("replays an existing focus fingerprint without creating another revision", async () => {
    const existing = focusRecord();
    const tx = focusTransaction({ existing, activeFocusId: FOCUS_ID });
    const service = new CoreTechnicalPersistenceService(prisma(tx));

    expect(await service.saveConfirmedFocus("owner-1", confirmedFocus())).toEqual(existing);
    expect(tx.coreTechnicalFocusRevision.create).not.toHaveBeenCalled();
    expect(tx.candidateProfile.update).not.toHaveBeenCalled();
  });

  it("requires a release-eligible human attestation before publishing a story version", async () => {
    const transaction = vi.fn();
    const service = new CoreTechnicalPersistenceService({
      $transaction: transaction
    } as unknown as PrismaService);
    await expect(service.publishReviewedStoryVersion(candidateArtifact())).rejects.toMatchObject({
      code: "CORE_TECHNICAL_HUMAN_REVIEW_REQUIRED"
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("publishes an approved story version immutably and replays its content fingerprint", async () => {
    const approved = approvedArtifact();
    const stored = storyVersionRecord();
    const tx = storyTransaction({ stored });
    const service = new CoreTechnicalPersistenceService(
      prisma(tx),
      () => new Date("2026-09-07T12:00:00Z")
    );

    expect(await service.publishReviewedStoryVersion(approved)).toEqual(stored);
    expect(tx.coreTechnicalStoryDefinition.upsert).toHaveBeenCalled();
    expect(tx.coreTechnicalStoryVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storyKey: "follow-the-operation",
          version: 1,
          publicationStatus: CoreTechnicalStoryPublicationStatus.PUBLISHED,
          storySnapshot: expect.any(Object),
          reviewSnapshot: expect.any(Object)
        })
      })
    );

    const replayTx = storyTransaction({ existing: stored, stored });
    expect(
      await new CoreTechnicalPersistenceService(prisma(replayTx)).publishReviewedStoryVersion(
        approved
      )
    ).toEqual(stored);
    expect(replayTx.coreTechnicalStoryVersion.create).not.toHaveBeenCalled();
  });

  it("atomically publishes exactly eight frozen private/public questions and one assessment", async () => {
    const tx = blockTransaction();
    const service = new CoreTechnicalPersistenceService(
      prisma(tx),
      () => new Date("2026-09-07T13:00:00Z")
    );

    const result = await service.publishPreparedBlock("owner-1", publishInput());

    expect(result.id).toBe(BLOCK_ID);
    const create = tx.coreTechnicalBlock.create.mock.calls[0]![0];
    const questions = create.data.questions.create;
    expect(questions).toHaveLength(8);
    expect(questions.map((question: { order: number }) => question.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8
    ]);
    expect(create.data.assessment.create).toMatchObject({
      schemaVersion: 1,
      evaluatorVersion: "evaluator-v1"
    });
    expect(questions.every((question: { state: unknown }) => question.state !== undefined)).toBe(
      true
    );
    const serializedPublic = JSON.stringify(
      questions.map((question: { publicSnapshot: unknown }) => question.publicSnapshot)
    );
    const serializedPrivate = JSON.stringify(
      questions.map((question: { privateSnapshot: unknown }) => question.privateSnapshot)
    );
    expect(serializedPublic).not.toContain("correctChoiceIndex");
    expect(serializedPublic).not.toContain("referenceSolution");
    expect(serializedPublic).not.toContain("hiddenTests");
    expect(serializedPrivate).toContain("referenceSolution");
    expect(tx.coreTechnicalPreparationAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CoreTechnicalPreparationStatus.SUCCEEDED,
          blockId: BLOCK_ID
        })
      })
    );
    expect(tx.coreTechnicalStoryProgress.upsert).toHaveBeenCalled();
  });

  it("stores a candidate-specific path title while preserving the reviewed pattern contract", async () => {
    const tx = blockTransaction();
    const input = publishInput();
    input.draft.story.title = "Trace and fix an async Node.js failure";

    await expect(
      new CoreTechnicalPersistenceService(prisma(tx)).publishPreparedBlock("owner-1", input)
    ).resolves.toMatchObject({ id: BLOCK_ID });

    expect(tx.coreTechnicalBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storySnapshot: expect.objectContaining({
            title: "Trace and fix an async Node.js failure"
          })
        })
      })
    );
  });

  it("replays the same request and converges a different concurrent request on the existing current block", async () => {
    const current = blockRecord();
    const replayTx = blockTransaction({
      existingAttempt: { status: "SUCCEEDED", blockId: BLOCK_ID },
      current
    });
    const replay = await new CoreTechnicalPersistenceService(prisma(replayTx)).publishPreparedBlock(
      "owner-1",
      publishInput()
    );
    expect(replay.id).toBe(BLOCK_ID);
    expect(replayTx.coreTechnicalBlock.create).not.toHaveBeenCalled();

    const concurrentTx = blockTransaction({ current });
    const concurrentInput = {
      ...publishInput(),
      requestId: "55555555-5555-4555-8555-555555555555"
    };
    const converged = await new CoreTechnicalPersistenceService(
      prisma(concurrentTx)
    ).publishPreparedBlock("owner-1", concurrentInput);
    expect(converged.id).toBe(BLOCK_ID);
    expect(concurrentTx.coreTechnicalBlock.create).not.toHaveBeenCalled();
    expect(concurrentTx.coreTechnicalPreparationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blockId: BLOCK_ID,
          status: CoreTechnicalPreparationStatus.SUCCEEDED
        })
      })
    );
  });

  it("retries a failed generation under the same preparation request", async () => {
    const tx = blockTransaction({
      existingAttempt: { status: CoreTechnicalPreparationStatus.FAILED, blockId: null }
    });
    tx.coreTechnicalPreparationAttempt.update
      .mockResolvedValueOnce({ id: "attempt-1" })
      .mockResolvedValueOnce({});

    const result = await new CoreTechnicalPersistenceService(prisma(tx)).publishPreparedBlock(
      "owner-1",
      publishInput()
    );

    expect(result.id).toBe(BLOCK_ID);
    expect(tx.coreTechnicalBlock.create).toHaveBeenCalledOnce();
    expect(tx.coreTechnicalPreparationAttempt.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: CoreTechnicalPreparationStatus.IN_PROGRESS,
          diagnosticsSnapshot: expect.anything(),
          completedAt: null
        })
      })
    );
  });

  it("demotes an assessed current block only inside the atomic next-block publication", async () => {
    const current = {
      ...blockRecord(),
      status: "ASSESSED",
      assessment: {
        id: "66666666-6666-4666-8666-666666666666",
        status: "COMPLETED"
      }
    };
    const tx = blockTransaction({ current });
    const input = {
      ...publishInput(),
      requestId: "77777777-7777-4777-8777-777777777777",
      previousBlockId: BLOCK_ID
    };

    await new CoreTechnicalPersistenceService(prisma(tx)).publishPreparedBlock("owner-1", input);

    expect(tx.coreTechnicalBlock.update).toHaveBeenCalledWith({
      where: { id_ownerId: { id: BLOCK_ID, ownerId: "owner-1" } },
      data: { isCurrent: false }
    });
    expect(tx.coreTechnicalBlock.create).toHaveBeenCalledOnce();
  });

  it("rejects a foreign focus, unpublished story, critic failure, or malformed eight-slot ordering", async () => {
    const foreignTx = blockTransaction({ focus: null });
    await expect(
      new CoreTechnicalPersistenceService(prisma(foreignTx)).publishPreparedBlock(
        "owner-1",
        publishInput()
      )
    ).rejects.toMatchObject({ code: "CORE_TECHNICAL_FOCUS_MISMATCH" });

    const unpublishedTx = blockTransaction({
      storyStatus: CoreTechnicalStoryPublicationStatus.REVIEW
    });
    await expect(
      new CoreTechnicalPersistenceService(prisma(unpublishedTx)).publishPreparedBlock(
        "owner-1",
        publishInput()
      )
    ).rejects.toMatchObject({ code: "CORE_TECHNICAL_STORY_NOT_PUBLISHED" });

    const failedCritic = publishInput();
    failedCritic.draft.storyReview = { ...failedCritic.draft.storyReview, approved: false };
    await expect(
      new CoreTechnicalPersistenceService(prisma(blockTransaction())).publishPreparedBlock(
        "owner-1",
        failedCritic
      )
    ).rejects.toMatchObject({ code: "CORE_TECHNICAL_CRITIC_APPROVAL_REQUIRED" });

    const malformed = publishInput();
    malformed.draft.questionBlock.questions[1] = {
      ...malformed.draft.questionBlock.questions[1]!,
      order: 1
    };
    await expect(
      new CoreTechnicalPersistenceService(prisma(blockTransaction())).publishPreparedBlock(
        "owner-1",
        malformed
      )
    ).rejects.toThrow("eight unique ordered questions");
  });

  it("records bounded failure diagnostics without publishing a partial block", async () => {
    const tx = blockTransaction();
    const failedAt = new Date("2026-09-07T14:00:00Z");
    tx.coreTechnicalPreparationAttempt.create.mockResolvedValueOnce({
      id: "attempt-failed",
      ownerId: "owner-1",
      focusRevisionId: FOCUS_ID,
      blockId: null,
      requestId: REQUEST_ID,
      status: CoreTechnicalPreparationStatus.FAILED,
      generatorVersion: "generator-v1",
      validatorVersion: "validator-v1",
      diagnosticsSnapshot: {
        stage: "validation",
        code: "BLOCK_REJECTED",
        message: "Block validation failed.",
        retryable: true
      },
      startedAt: failedAt,
      completedAt: failedAt,
      createdAt: failedAt,
      updatedAt: failedAt
    });
    const result = await new CoreTechnicalPersistenceService(
      prisma(tx),
      () => failedAt
    ).recordPreparationFailure("owner-1", {
      requestId: REQUEST_ID,
      focusRevisionId: FOCUS_ID,
      generatorVersion: "generator-v1",
      validatorVersion: "validator-v1",
      diagnostic: {
        stage: "validation",
        code: "BLOCK_REJECTED",
        message: "Block validation failed.",
        retryable: true
      }
    });

    expect(result.status).toBe(CoreTechnicalPreparationStatus.FAILED);
    expect(tx.coreTechnicalBlock.create).not.toHaveBeenCalled();
    expect(tx.coreTechnicalPreparationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CoreTechnicalPreparationStatus.FAILED,
          diagnosticsSnapshot: {
            stage: "validation",
            code: "BLOCK_REJECTED",
            message: "Block validation failed.",
            retryable: true
          }
        })
      })
    );
  });

  it("migration encodes ownership, immutable-source, uniqueness, and lifecycle constraints", () => {
    const sql = readFileSync(
      "prisma/migrations/20260907060000_story_driven_core_technical_persistence/migration.sql",
      "utf8"
    );
    expect(sql).toContain('CREATE UNIQUE INDEX "CoreTechnicalBlock_one_current_per_owner"');
    expect(sql).toContain('CREATE UNIQUE INDEX "CoreTechnicalBlockQuestion_blockId_order_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "CoreTechnicalAssessment_blockId_key"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "CoreTechnicalPreparationAttempt_ownerId_requestId_key"'
    );
    expect(sql).toContain('REFERENCES "CoreTechnicalStoryVersion"("id") ON DELETE RESTRICT');
    expect(sql).toContain('CHECK ("order" BETWEEN 1 AND 8)');
    expect(sql).not.toContain('DROP TABLE "PrepPractice');
    expect(sql).not.toContain('UPDATE "PrepPractice');
  });
});

function approvedArtifact() {
  return coreTechnicalStoryReviewArtifactSchema.parse({
    ...artifact,
    evaluation: {
      ...artifact.evaluation,
      releaseEligible: true,
      humanReviewStatus: "approved"
    },
    humanReview: {
      status: "approved",
      reviewerId: "human-reviewer-1",
      reviewedAt: "2026-09-07",
      notes: [
        "A human reviewed every story stage, private answer, hint, test, rubric, and production claim."
      ]
    }
  });
}

function candidateArtifact() {
  return coreTechnicalStoryReviewArtifactSchema.parse({
    ...artifact,
    evaluation: {
      ...artifact.evaluation,
      releaseEligible: false,
      humanReviewStatus: "candidate"
    },
    humanReview: {
      status: "candidate",
      reviewerId: null,
      reviewedAt: null,
      notes: [
        "This fixture deliberately verifies that publication fails closed before human approval."
      ]
    }
  });
}

function confirmedFocus(): CoreTechnicalConfirmedFocus {
  const topics = NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key);
  const mechanisms = [
    ...new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys))
  ];
  return {
    schemaVersion: 1,
    focusFingerprint: `sha256:${"f".repeat(64)}`,
    confirmedAt: "2026-09-07T10:00:00.000Z",
    role: "backend",
    seniority: "mid",
    targetJob: "Backend Engineer",
    targetCompany: null,
    targetDate: null,
    stack: {
      language: "javascript",
      runtime: "nodejs",
      runtimeVersion: "22 LTS",
      framework: "express"
    },
    excludedTopicKeys: [],
    resumeEvidence: { topicKeys: [], mechanismKeys: [] },
    baselineEvidence: {
      schemaVersion: 1,
      registryVersion: 1,
      sourceFingerprint: `sha256:${"b".repeat(64)}`,
      state: "GUIDED",
      validAnswerCount: 3,
      correctAnswerCount: 1,
      questions: (["technical-1", "technical-2", "technical-3"] as const).map((section, index) => ({
        section,
        resolution: "RESOLVED",
        questionId: `technical-${index}`,
        questionFingerprint: `sha256:${String(index + 1).repeat(64)}`,
        conceptKeys: [],
        mechanismKeys: [],
        correctness: index === 0 ? "CORRECT" : "INCORRECT"
      })),
      weakConceptKeys: ["javascript-values-and-mutation"],
      strongConceptKeys: [],
      unassessedConceptKeys: topics.filter((key) => key !== "javascript-values-and-mutation"),
      weakMechanismKeys: ["reference-identity"],
      strongMechanismKeys: [],
      unassessedMechanismKeys: mechanisms.filter((key) => key !== "reference-identity")
    }
  };
}

function publishInput() {
  const focus = confirmedFocus();
  const catalogue = NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE.map((story) => ({
    ...story,
    publicationStatus: "published" as const
  }));
  const selection = new CoreTechnicalStoryRankingService(catalogue).rankFirstStory(focus);
  return {
    requestId: REQUEST_ID,
    focusRevisionId: FOCUS_ID,
    selection,
    draft: {
      story: structuredClone(artifact.story),
      storyReview: structuredClone(artifact.storyReview),
      questionBlock: structuredClone(artifact.questionBlock),
      questionBlockReview: structuredClone(artifact.questionBlockReview)
    },
    generatorVersion: "generator-v1",
    validatorVersion: "validator-v1",
    evaluatorVersion: "evaluator-v1"
  };
}

function prisma(tx: object): PrismaService {
  return {
    $transaction: vi.fn().mockImplementation((work) => work(tx))
  } as unknown as PrismaService;
}

function focusTransaction(options: {
  existing?: unknown;
  created?: unknown;
  activeFocusId?: string | null;
}) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    candidateProfile: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          ownerId: "owner-1",
          activeCoreTechnicalFocusRevisionId: options.activeFocusId ?? null
        }),
      update: vi.fn().mockResolvedValue({})
    },
    coreTechnicalFocusRevision: {
      findUnique: vi.fn().mockResolvedValue(options.existing ?? null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(options.created)
    }
  };
}

function storyTransaction(options: { existing?: unknown; stored: unknown }) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    coreTechnicalStoryDefinition: { upsert: vi.fn().mockResolvedValue({}) },
    coreTechnicalStoryVersion: {
      findUnique: vi.fn().mockResolvedValue(options.existing ?? null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(options.stored)
    }
  };
}

function blockTransaction(
  options: {
    existingAttempt?: unknown;
    current?: unknown;
    focus?: unknown;
    storyStatus?: CoreTechnicalStoryPublicationStatus;
  } = {}
) {
  const hasFocusOverride = Object.prototype.hasOwnProperty.call(options, "focus");
  const currentResponses =
    options.existingAttempt &&
    typeof options.existingAttempt === "object" &&
    "blockId" in options.existingAttempt &&
    options.existingAttempt.blockId
      ? [options.current ?? blockRecord()]
      : [options.current ?? null, null];
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    coreTechnicalPreparationAttempt: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.existingAttempt
            ? { focusRevisionId: FOCUS_ID, ...(options.existingAttempt as object) }
            : null
        ),
      create: vi.fn().mockResolvedValue({ id: "attempt-1" }),
      update: vi.fn().mockResolvedValue({})
    },
    coreTechnicalFocusRevision: {
      findUnique: vi.fn().mockResolvedValue(
        hasFocusOverride
          ? options.focus
          : {
              id: FOCUS_ID,
              focusFingerprint: confirmedFocus().focusFingerprint
            }
      )
    },
    coreTechnicalStoryVersion: {
      findUnique: vi.fn().mockResolvedValue({
        id: STORY_VERSION_ID,
        publicationStatus: options.storyStatus ?? CoreTechnicalStoryPublicationStatus.PUBLISHED,
        storySnapshot: artifact.story
      })
    },
    coreTechnicalBlock: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(currentResponses[0])
        .mockResolvedValueOnce(currentResponses[1]),
      create: vi.fn().mockResolvedValue(blockRecord()),
      update: vi.fn().mockResolvedValue({})
    },
    coreTechnicalStoryProgress: { upsert: vi.fn().mockResolvedValue({}) }
  };
}

function focusRecord() {
  return {
    id: FOCUS_ID,
    ownerId: "owner-1",
    revision: 1,
    schemaVersion: 1,
    focusFingerprint: confirmedFocus().focusFingerprint,
    baselineSchemaVersion: 1,
    baselineSourceFingerprint: confirmedFocus().baselineEvidence.sourceFingerprint,
    focusSnapshot: confirmedFocus(),
    confirmedAt: new Date("2026-09-07T10:00:00Z"),
    createdAt: new Date("2026-09-07T10:00:00Z")
  };
}

function storyVersionRecord() {
  return {
    id: STORY_VERSION_ID,
    storyKey: artifact.story.key,
    version: 1,
    schemaVersion: 1,
    publicationStatus: CoreTechnicalStoryPublicationStatus.PUBLISHED,
    contentFingerprint: `sha256:${"c".repeat(64)}`,
    storySnapshot: artifact.story,
    reviewSnapshot: {},
    publishedAt: new Date("2026-09-07T12:00:00Z"),
    retiredAt: null,
    createdAt: new Date("2026-09-07T12:00:00Z")
  };
}

function blockRecord() {
  return {
    id: BLOCK_ID,
    ownerId: "owner-1",
    ordinal: 1,
    isCurrent: true,
    status: "PRACTISING",
    focusRevisionId: FOCUS_ID,
    storyVersionId: STORY_VERSION_ID,
    schemaVersion: 1,
    rankingPolicyVersion: 1,
    preparationRequestId: REQUEST_ID,
    contentFingerprint: `sha256:${"d".repeat(64)}`,
    preparedAt: new Date("2026-09-07T13:00:00Z"),
    createdAt: new Date("2026-09-07T13:00:00Z"),
    questions: [],
    assessment: { id: "66666666-6666-4666-8666-666666666666", status: "LOCKED" }
  };
}
