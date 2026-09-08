import { readFileSync } from "node:fs";
import { ArchitectureScenarioPublicationStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { ArchitectureDesignConfirmedFocus } from "@/lib/practice/architecture-design/focus-ranking-contracts";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/lib/practice/architecture-design/reviewed-scenarios";
import type { PrismaService } from "@/server/database/prisma.service";
import { storyPracticeFingerprint } from "@/server/story-practice/practice-orchestrator";
import { ArchitectureDesignRepositoryAdapter } from "./repository-adapter";
import { ArchitectureDesignPersistenceService } from "./persistence.service";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const FOCUS_ID = "22222222-2222-4222-8222-222222222222";
const SCENARIO_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const BLOCK_ID = "44444444-4444-4444-8444-444444444444";
const artifact = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!;

describe("ArchitectureDesignPersistenceService", () => {
  it("saves a content-addressed owner focus and advances the active pointer", async () => {
    const created = { id: FOCUS_ID, ownerId: "owner-1", revision: 1 };
    const tx = focusTransaction({ created });
    const result = await new ArchitectureDesignRepositoryAdapter(prisma(tx)).saveConfirmedFocus(
      "owner-1",
      focus()
    );

    expect(result).toEqual(created);
    expect(tx.architectureFocusRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: "owner-1", revision: 1 })
      })
    );
    expect(tx.candidateProfile.update).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      data: { activeArchitectureFocusRevisionId: FOCUS_ID }
    });
  });

  it("blocks candidate content and publishes approved public/private snapshots", async () => {
    const transaction = vi.fn();
    const service = new ArchitectureDesignPersistenceService({
      $transaction: transaction
    } as unknown as PrismaService);
    await expect(service.publishReviewedScenarioVersion(candidateArtifact())).rejects.toMatchObject(
      {
        code: "ARCHITECTURE_DESIGN_HUMAN_REVIEW_REQUIRED"
      }
    );
    expect(transaction).not.toHaveBeenCalled();

    const stored = { id: SCENARIO_VERSION_ID, scenarioKey: artifact.caseKey, version: 1 };
    const tx = scenarioTransaction(stored);
    await expect(
      new ArchitectureDesignPersistenceService(prisma(tx)).publishReviewedScenarioVersion(artifact)
    ).resolves.toEqual(stored);

    const create = tx.architectureScenarioVersion.create.mock.calls[0]![0];
    expect(create.data).toEqual(
      expect.objectContaining({
        publicationStatus: ArchitectureScenarioPublicationStatus.PUBLISHED,
        version: 1,
        publicQuestionSnapshot: expect.any(Object),
        privateQuestionSnapshot: expect.any(Object)
      })
    );
    expect(JSON.stringify(create.data.publicQuestionSnapshot)).not.toMatch(
      /referenceAnswer|rubric|correctChoiceIndex|hints/
    );
    expect(JSON.stringify(create.data.privateQuestionSnapshot)).toContain("referenceAnswer");
  });

  it("publishes exactly four frozen questions and one assessment atomically", async () => {
    const tx = blockTransaction();
    const result = await new ArchitectureDesignRepositoryAdapter(
      prisma(tx),
      () => new Date("2026-09-08T12:00:00Z")
    ).publishPreparedBlock("owner-1", {
      requestId: REQUEST_ID,
      focusRevisionId: FOCUS_ID,
      selection: selection(),
      draft: { scenario: artifact.scenario, questionBlock: artifact.questionBlock },
      generatorVersion: "architecture-reviewed-content-v1",
      validatorVersion: "architecture-validator-v1",
      evaluatorVersion: "architecture-evaluator-v1"
    });

    expect(result.id).toBe(BLOCK_ID);
    const create = tx.architectureBlock.create.mock.calls[0]![0];
    expect(create.data.questions.create).toHaveLength(4);
    expect(create.data.assessment.create).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        evaluatorVersion: "architecture-evaluator-v1",
        evaluatorFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/)
      })
    );
    expect(tx.architectureBlock.create).toHaveBeenCalledTimes(1);
  });

  it("compares prepared content with its JSON-persisted reviewed snapshots", async () => {
    const tx = blockTransaction();
    const changedScenario = {
      ...artifact.scenario,
      premise:
        "Design a different platform whose persisted reviewed content must not authorize this prepared block."
    };

    await expect(
      new ArchitectureDesignPersistenceService(prisma(tx)).publishPreparedBlock("owner-1", {
        requestId: REQUEST_ID,
        focusRevisionId: FOCUS_ID,
        selection: selection(),
        draft: { scenario: changedScenario, questionBlock: artifact.questionBlock },
        generatorVersion: "architecture-reviewed-content-v1",
        validatorVersion: "architecture-validator-v1",
        evaluatorVersion: "architecture-evaluator-v1"
      })
    ).rejects.toMatchObject({ code: "ARCHITECTURE_DESIGN_REVIEWED_CONTRACT_MISMATCH" });
    expect(tx.architectureBlock.create).not.toHaveBeenCalled();
  });

  it("replays an owner request without creating a second block", async () => {
    const replay = { id: BLOCK_ID, questions: new Array(4).fill({}) };
    const tx = blockTransaction({
      existingAttempt: { status: "SUCCEEDED", blockId: BLOCK_ID, focusRevisionId: FOCUS_ID },
      replay
    });
    const result = await new ArchitectureDesignPersistenceService(prisma(tx)).publishPreparedBlock(
      "owner-1",
      {
        requestId: REQUEST_ID,
        focusRevisionId: FOCUS_ID,
        selection: selection(),
        draft: { scenario: artifact.scenario, questionBlock: artifact.questionBlock },
        generatorVersion: "architecture-reviewed-content-v1",
        validatorVersion: "architecture-validator-v1",
        evaluatorVersion: "architecture-evaluator-v1"
      }
    );

    expect(result).toBe(replay);
    expect(tx.architectureBlock.create).not.toHaveBeenCalled();
  });

  it("keeps the migration isolated and enforces owner and current-block invariants", () => {
    const sql = readFileSync(
      "prisma/migrations/20260908130000_story_driven_architecture_design_persistence/migration.sql",
      "utf8"
    );
    expect(sql).toContain('CREATE TABLE "ArchitectureBlock"');
    expect(sql).toContain('CREATE UNIQUE INDEX "ArchitectureBlock_one_current_per_owner"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "ArchitecturePreparationAttempt_ownerId_requestId_key"'
    );
    expect(sql).toContain('FOREIGN KEY ("blockId", "ownerId")');
    expect(sql).toContain('FOREIGN KEY ("activeArchitectureFocusRevisionId", "ownerId")');
    expect(sql).toContain('CHECK ("order" BETWEEN 1 AND 4)');
    expect(sql).toContain('"evaluatorFingerprint" TEXT NOT NULL');
    expect(sql).not.toContain("ArchitectureCodeRun");
    expect(sql).not.toContain("DROP TABLE");
  });

  it("reads only matching database-published scenario identities and frozen content", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ scenarioKey: artifact.scenario.key, version: 1 }]);
    const findUnique = vi.fn().mockResolvedValue({
      publicationStatus: "PUBLISHED",
      contentFingerprint: contentFingerprint(),
      scenarioSnapshot: artifact.scenario,
      privateQuestionSnapshot: artifact.questionBlock
    });
    const adapter = new ArchitectureDesignRepositoryAdapter({
      architectureScenarioVersion: { findMany, findUnique }
    } as unknown as PrismaService);

    await expect(adapter.published([{ key: artifact.scenario.key, version: 1 }])).resolves.toEqual([
      { key: artifact.scenario.key, version: 1 }
    ]);
    await expect(adapter.reviewedScenarioVersion(artifact.scenario.key, 1)).resolves.toMatchObject({
      contentFingerprint: contentFingerprint(),
      scenario: { key: artifact.scenario.key },
      questionBlock: { scenarioKey: artifact.scenario.key }
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ publicationStatus: "PUBLISHED" })
      })
    );
  });
});

function candidateArtifact() {
  return {
    ...structuredClone(artifact),
    humanReview: {
      status: "candidate",
      reviewerId: null,
      reviewedAt: null,
      notes: [
        "Synthetic candidate content exercises the persistence approval gate without a database write."
      ]
    }
  };
}

function focus(): ArchitectureDesignConfirmedFocus {
  return {
    schemaVersion: 1,
    focusFingerprint: `sha256:${"b".repeat(64)}`,
    confirmedAt: "2026-09-08T00:00:00.000Z",
    path: "role-aligned",
    role: "backend",
    seniority: "mid",
    targetJob: "Backend Engineer",
    targetCompany: null,
    targetDate: null,
    excludedScenarioKeys: [],
    resumeEvidence: { architectureSkillKeys: ["distributed-systems"], projectKeywords: ["events"] },
    planEvidence: { blueprintId: null, topicKeys: ["webhooks"], skillKeys: ["reliability"] },
    baselineEvidence: {
      schemaVersion: 1,
      registryVersion: 1,
      sourceFingerprint: `sha256:${"a".repeat(64)}`,
      questionId: null,
      questionFingerprint: null,
      resolution: "MISSING",
      correctness: "UNKNOWN",
      state: "UNKNOWN",
      dimensionKeys: [],
      weakDimensionKeys: [],
      strongDimensionKeys: [],
      unassessedDimensionKeys: [],
      signalConsistency: "UNAVAILABLE"
    }
  };
}

function selection() {
  const selectedScenario = {
    scenarioKey: artifact.scenario.key,
    scenarioVersion: 1,
    title: artifact.scenario.title,
    difficulty: "standard" as const,
    emphasizedDimensionKeys: artifact.scenario.dimensionKeys.slice(0, 4),
    scores: {
      baselineGapTransfer: 20,
      targetRoleJob: 12,
      resumeProjectRelevance: 4,
      dimensionCoverage: 10,
      plannedCoverage: 4,
      novelty: 5,
      total: 55
    }
  };
  return {
    policyVersion: 1 as const,
    focusFingerprint: focus().focusFingerprint,
    selectedScenario,
    rankings: [selectedScenario],
    reason: "This scenario exercises the candidate's target architecture and reliability skills."
  };
}

function prisma(tx: Record<string, unknown>): PrismaService {
  return {
    $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx))
  } as unknown as PrismaService;
}

function focusTransaction(options: { created?: unknown; existing?: unknown } = {}) {
  return {
    $executeRaw: vi.fn(),
    candidateProfile: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ ownerId: "owner-1", activeArchitectureFocusRevisionId: null }),
      update: vi.fn()
    },
    architectureFocusRevision: {
      findUnique: vi.fn().mockResolvedValue(options.existing ?? null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(options.created)
    }
  };
}

function scenarioTransaction(stored: unknown) {
  return {
    $executeRaw: vi.fn(),
    architectureScenarioVersion: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(stored)
    },
    architectureScenarioDefinition: { upsert: vi.fn() }
  };
}

function blockTransaction(options: { existingAttempt?: unknown; replay?: unknown } = {}) {
  return {
    $executeRaw: vi.fn(),
    architecturePreparationAttempt: {
      findUnique: vi.fn().mockResolvedValue(options.existingAttempt ?? null),
      create: vi.fn().mockResolvedValue({ id: "prep-id" }),
      update: vi.fn()
    },
    architectureFocusRevision: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: FOCUS_ID, focusFingerprint: focus().focusFingerprint })
    },
    architectureScenarioVersion: {
      findUnique: vi.fn().mockResolvedValue({
        id: SCENARIO_VERSION_ID,
        publicationStatus: "PUBLISHED",
        scenarioSnapshot: JSON.parse(JSON.stringify(artifact.scenario)),
        privateQuestionSnapshot: JSON.parse(JSON.stringify(artifact.questionBlock))
      })
    },
    architectureBlock: {
      findFirst: options.replay
        ? vi.fn().mockResolvedValue(options.replay)
        : vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: BLOCK_ID })
    },
    architectureScenarioProgress: { upsert: vi.fn() }
  };
}

function contentFingerprint(): string {
  return storyPracticeFingerprint({
    scenario: artifact.scenario,
    questionBlock: artifact.questionBlock
  });
}
