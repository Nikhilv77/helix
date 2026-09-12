import { describe, expect, it, vi } from "vitest";
import {
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  type ArchitectureDesignBaselineEvidence,
  type ArchitectureDesignConfirmedFocus
} from "@/features/practice/architecture-design/domain";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "@/features/practice/architecture-design/domain/reviewed-scenarios";
import { ArchitectureDesignPreparationService } from "./preparation.service";
import { ArchitectureDesignScenarioRankingService } from "./scenario-ranking.service";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const FOCUS_ID = "22222222-2222-4222-8222-222222222222";
const FINGERPRINT = `sha256:${"a".repeat(64)}`;

describe("ArchitectureDesignPreparationService", () => {
  it("confirms through the shared focus protocol and returns only public focus", async () => {
    const confirmed = focus();
    const service = new ArchitectureDesignPreparationService({
      prisma: {} as never,
      focus: { confirm: vi.fn().mockResolvedValue(confirmed) },
      ranking: {} as never,
      repository: {
        saveConfirmedFocus: vi.fn().mockResolvedValue({
          id: FOCUS_ID,
          revision: 1,
          schemaVersion: 1,
          focusFingerprint: confirmed.focusFingerprint,
          confirmedAt: new Date(confirmed.confirmedAt)
        })
      } as never,
      practice: {} as never
    });

    const result = await service.confirm("owner-1", { path: "role-aligned" });

    expect(result).toMatchObject({ id: FOCUS_ID, revision: 1, focus: { role: "backend" } });
    expect(JSON.stringify(result.focus)).not.toContain("baselineEvidence");
    expect(JSON.stringify(result.focus)).not.toContain("resumeEvidence");
  });

  it("reads exact database-published content and publishes one complete block", async () => {
    const confirmed = focus();
    const ranking = new ArchitectureDesignScenarioRankingService(publishedCatalogue());
    const selection = ranking.rankFirstScenario(confirmed);
    const artifact = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.find(
      ({ caseKey }) => caseKey === selection.selectedScenario.scenarioKey
    )!;
    const publishPreparedBlock = vi.fn();
    const current = vi.fn().mockResolvedValue({ id: "block-1", questions: new Array(4).fill({}) });
    const reviewedScenarioVersion = vi.fn().mockResolvedValue({
      contentFingerprint: FINGERPRINT,
      scenario: artifact.scenario,
      questionBlock: artifact.questionBlock
    });
    const service = new ArchitectureDesignPreparationService({
      prisma: preparationPrisma(null, confirmed) as never,
      focus: {} as never,
      ranking,
      repository: {
        reviewedScenarioVersion,
        publishPreparedBlock,
        recordPreparationFailure: vi.fn(),
        saveConfirmedFocus: vi.fn()
      } as never,
      practice: { current }
    });

    await expect(
      service.prepare("owner-1", { requestId: REQUEST_ID, focusRevisionId: FOCUS_ID })
    ).resolves.toMatchObject({ replayed: false, block: { id: "block-1" } });
    expect(reviewedScenarioVersion).toHaveBeenCalledWith(
      selection.selectedScenario.scenarioKey,
      selection.selectedScenario.scenarioVersion
    );
    expect(publishPreparedBlock).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        requestId: REQUEST_ID,
        focusRevisionId: FOCUS_ID,
        draft: { scenario: artifact.scenario, questionBlock: artifact.questionBlock }
      })
    );
  });

  it("records bounded failure diagnostics without saving a partial block", async () => {
    const recordPreparationFailure = vi.fn().mockResolvedValue({ status: "FAILED" });
    const publishPreparedBlock = vi.fn();
    const service = new ArchitectureDesignPreparationService({
      prisma: preparationPrisma(null, focus()) as never,
      focus: {} as never,
      ranking: {
        rankFirstScenario: () => {
          throw new Error("No published scenario");
        }
      },
      repository: {
        reviewedScenarioVersion: vi.fn(),
        publishPreparedBlock,
        recordPreparationFailure,
        saveConfirmedFocus: vi.fn()
      } as never,
      practice: { current: vi.fn() }
    });

    await expect(
      service.prepare("owner-1", { requestId: REQUEST_ID, focusRevisionId: FOCUS_ID })
    ).rejects.toMatchObject({ code: "ARCHITECTURE_DESIGN_PREPARATION_FAILED" });
    expect(recordPreparationFailure).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        diagnostic: expect.objectContaining({
          stage: "ranking",
          code: "ARCHITECTURE_DESIGN_RANKING_FAILED"
        })
      })
    );
    expect(publishPreparedBlock).not.toHaveBeenCalled();
  });

  it("replays a successful owner request without ranking or publishing again", async () => {
    const rankFirstScenario = vi.fn();
    const publishPreparedBlock = vi.fn();
    const current = vi.fn().mockResolvedValue({ id: "existing-block" });
    const service = new ArchitectureDesignPreparationService({
      prisma: preparationPrisma(
        { status: "SUCCEEDED", focusRevisionId: FOCUS_ID, blockId: "existing-block" },
        focus()
      ) as never,
      focus: {} as never,
      ranking: { rankFirstScenario },
      repository: {
        reviewedScenarioVersion: vi.fn(),
        publishPreparedBlock,
        recordPreparationFailure: vi.fn(),
        saveConfirmedFocus: vi.fn()
      } as never,
      practice: { current }
    });

    await expect(
      service.prepare("owner-1", { requestId: REQUEST_ID, focusRevisionId: FOCUS_ID })
    ).resolves.toEqual({ replayed: true, block: { id: "existing-block" } });
    expect(rankFirstScenario).not.toHaveBeenCalled();
    expect(publishPreparedBlock).not.toHaveBeenCalled();
  });
});

function preparationPrisma(existing: unknown, confirmed: ArchitectureDesignConfirmedFocus) {
  return {
    architecturePreparationAttempt: { findUnique: vi.fn().mockResolvedValue(existing) },
    architectureFocusRevision: {
      findUnique: vi.fn().mockResolvedValue({ focusSnapshot: confirmed })
    }
  };
}

function focus(): ArchitectureDesignConfirmedFocus {
  return {
    schemaVersion: 1,
    focusFingerprint: FINGERPRINT,
    confirmedAt: "2026-09-08T10:00:00.000Z",
    path: "role-aligned",
    role: "backend",
    seniority: "mid",
    targetJob: "Backend Platform Engineer",
    targetCompany: null,
    targetDate: null,
    excludedScenarioKeys: [],
    resumeEvidence: {
      architectureSkillKeys: ["distributed-systems"],
      projectKeywords: ["webhooks"]
    },
    planEvidence: { blueprintId: null, topicKeys: [], skillKeys: [] },
    baselineEvidence: evidence()
  };
}

function evidence(): ArchitectureDesignBaselineEvidence {
  return {
    schemaVersion: 1,
    registryVersion: 1,
    sourceFingerprint: FINGERPRINT,
    questionId: null,
    questionFingerprint: null,
    resolution: "MISSING",
    correctness: "UNKNOWN",
    state: "UNKNOWN",
    dimensionKeys: [],
    weakDimensionKeys: [],
    strongDimensionKeys: [],
    unassessedDimensionKeys: ["requirements-framing", "capacity-estimation"],
    signalConsistency: "UNAVAILABLE"
  };
}

function publishedCatalogue() {
  return ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.filter(
    ({ publicationStatus }) => publicationStatus === "published"
  );
}
