import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AppliedEngineeringIncidentPublicationStatus } from "@prisma/client";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/features/practice/applied-engineering/domain/reviewed-incidents";
import type { AppliedEngineeringConfirmedFocus } from "@/features/practice/applied-engineering/domain/focus-ranking-contracts";
import type { PrismaService } from "@/server/database/prisma.service";
import { AppliedEngineeringPersistenceService } from "./persistence.service";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const FOCUS_ID = "22222222-2222-4222-8222-222222222222";
const INCIDENT_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const BLOCK_ID = "44444444-4444-4444-8444-444444444444";
const artifact = APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]!;

describe("AppliedEngineeringPersistenceService", () => {
  it("saves a content-addressed focus revision and advances the active pointer", async () => {
    const created = { id: FOCUS_ID, ownerId: "owner-1", revision: 1 };
    const tx = focusTransaction({ created });
    const result = await new AppliedEngineeringPersistenceService(prisma(tx)).saveConfirmedFocus(
      "owner-1",
      focus()
    );

    expect(result).toEqual(created);
    expect(tx.appliedEngineeringFocusRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: "owner-1", revision: 1 })
      })
    );
    expect(tx.candidateProfile.update).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      data: { activeAppliedEngineeringFocusRevisionId: FOCUS_ID }
    });
  });

  it("replays an approved incident publication and refuses unapproved content", async () => {
    const transaction = vi.fn();
    const service = new AppliedEngineeringPersistenceService({ $transaction: transaction } as unknown as PrismaService);
    const unapproved = structuredClone(artifact);
    unapproved.humanReview.status = "candidate";
    unapproved.humanReview.reviewerId = null;
    unapproved.humanReview.reviewedAt = null;
    await expect(service.publishReviewedIncidentVersion(unapproved)).rejects.toMatchObject({
      code: "APPLIED_ENGINEERING_HUMAN_REVIEW_REQUIRED"
    });
    expect(transaction).not.toHaveBeenCalled();

    const approved = structuredClone(artifact);
    approved.humanReview = {
      status: "approved",
      reviewerId: "project-owner",
      reviewedAt: "2026-09-08",
      notes: ["The project owner reviewed the incident, private answers, executable repairs, and rollout evidence."]
    };
    const stored = { id: INCIDENT_VERSION_ID, incidentKey: artifact.caseKey, version: 1 };
    const tx = incidentTransaction({ stored });
    await expect(
      new AppliedEngineeringPersistenceService(prisma(tx)).publishReviewedIncidentVersion(approved)
    ).resolves.toEqual(stored);
    expect(tx.appliedEngineeringIncidentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicationStatus: AppliedEngineeringIncidentPublicationStatus.PUBLISHED,
          version: 1
        })
      })
    );
  });

  it("publishes eight frozen questions and one assessment in one transaction", async () => {
    const tx = blockTransaction();
    const result = await new AppliedEngineeringPersistenceService(
      prisma(tx),
      () => new Date("2026-09-08T12:00:00Z")
    ).publishPreparedBlock("owner-1", {
      requestId: REQUEST_ID,
      focusRevisionId: FOCUS_ID,
      selection: selection(),
      draft: { incident: artifact.incident, questionBlock: artifact.questionBlock },
      generatorVersion: "applied-generator-v1",
      validatorVersion: "applied-validator-v1",
      evaluatorVersion: "applied-evaluator-v1"
    });

    expect(result.id).toBe(BLOCK_ID);
    const create = tx.appliedEngineeringBlock.create.mock.calls[0]![0];
    expect(create.data.questions.create).toHaveLength(8);
    expect(create.data.assessment.create).toEqual(
      expect.objectContaining({ schemaVersion: 1, evaluatorVersion: "applied-evaluator-v1" })
    );
  });

  it("keeps the migration isolated and enforces current-block/request uniqueness", () => {
    const sql = readFileSync(
      "prisma/migrations/20260908100000_story_driven_applied_engineering_persistence/migration.sql",
      "utf8"
    );
    expect(sql).toContain('CREATE TABLE "AppliedEngineeringBlock"');
    expect(sql).toContain('CREATE UNIQUE INDEX "AppliedEngineeringBlock_one_current_per_owner"');
    expect(sql).toContain('CREATE UNIQUE INDEX "AppliedEngineeringPreparationAttempt_ownerId_requestId_key"');
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain('CoreTechnical');
  });
});

function focus(): AppliedEngineeringConfirmedFocus {
  const content = {
    schemaVersion: 1 as const,
    role: "backend" as const,
    seniority: "mid" as const,
    targetJob: "Backend Engineer",
    targetCompany: null,
    targetDate: null,
    stack: { language: "javascript" as const, runtime: "nodejs" as const, runtimeVersion: "22 LTS" as const, framework: null },
    excludedIncidentKeys: [],
    resumeEvidence: { technologyKeys: ["nodejs"], projectKeywords: ["checkout"], productionSignalKeys: ["retry-safety" as const] },
    baselineEvidence: {
      schemaVersion: 1 as const,
      registryVersion: 1 as const,
      sourceFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      source: "initial-baseline" as const,
      state: "UNKNOWN" as const,
      evidence: "not-enough-evidence" as const,
      confidence: 0,
      questionId: null,
      familiarity: "unknown" as const,
      weakSignalKeys: [],
      strongSignalKeys: [],
      unassessedSignalKeys: ["evidence-selection" as const],
      sourceTopicLabels: [],
      sourceAreaId: "applied-engineering" as const
    }
  };
  return {
    ...content,
    focusFingerprint: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    confirmedAt: "2026-09-08T00:00:00.000Z"
  };
}

function selection() {
  const selectedIncident = { incidentKey: artifact.caseKey, incidentVersion: 1, title: artifact.incident.title, difficulty: artifact.incident.difficulty, emphasizedSignalKeys: artifact.incident.productionSignalKeys.slice(0, 4), scores: { baselineGapTransfer: 20, targetRoleJob: 12, resumeProjectRelevance: 4, productionEvidenceCoverage: 10, plannedCoverage: 4, novelty: 5, total: 55 } };
  return {
    policyVersion: 1 as const,
    focusFingerprint: focus().focusFingerprint,
    selectedIncident,
    rankings: [selectedIncident],
    reason: "This incident reinforces the candidate's production reasoning and delivery skills."
  };
}

function prisma(tx: Record<string, unknown>): PrismaService {
  return { $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx)) } as unknown as PrismaService;
}

function focusTransaction(options: { created?: unknown; existing?: unknown } = {}) {
  return {
    $executeRaw: vi.fn(),
    candidateProfile: {
      findUnique: vi.fn().mockResolvedValue({ ownerId: "owner-1", activeAppliedEngineeringFocusRevisionId: null }),
      update: vi.fn()
    },
    appliedEngineeringFocusRevision: {
      findUnique: vi.fn().mockResolvedValue(options.existing ?? null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(options.created)
    }
  };
}

function incidentTransaction(options: { stored: unknown }) {
  return {
    $executeRaw: vi.fn(),
    appliedEngineeringIncidentVersion: {
      findUnique: vi.fn().mockResolvedValueOnce(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(options.stored)
    },
    appliedEngineeringIncidentDefinition: { upsert: vi.fn() }
  };
}

function blockTransaction() {
  return {
    $executeRaw: vi.fn(),
    appliedEngineeringPreparationAttempt: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "prep-id" }),
      update: vi.fn()
    },
    appliedEngineeringFocusRevision: {
      findUnique: vi.fn().mockResolvedValue({ id: FOCUS_ID, focusFingerprint: focus().focusFingerprint })
    },
    appliedEngineeringIncidentVersion: {
      findUnique: vi.fn().mockResolvedValue({ id: INCIDENT_VERSION_ID, publicationStatus: "PUBLISHED", incidentSnapshot: artifact.incident })
    },
    appliedEngineeringBlock: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: BLOCK_ID })
    },
    appliedEngineeringIncidentProgress: { upsert: vi.fn() }
  };
}
