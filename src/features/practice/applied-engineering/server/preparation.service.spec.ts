import { describe, expect, it, vi } from "vitest";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "@/features/practice/applied-engineering/domain/reviewed-incidents";
import type { AppliedEngineeringConfirmedFocus } from "@/features/practice/applied-engineering/domain/focus-ranking-contracts";
import type { PrismaService } from "@/server/database/prisma.service";
import { AppliedEngineeringIncidentRankingService } from "./incident-ranking.service";
import { AppliedEngineeringPreparationService } from "./preparation.service";
import { NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE } from "@/features/practice/applied-engineering/domain/incident-ranking-catalogue";

const CURRENT_ID = "11111111-1111-4111-8111-111111111111";
const FOCUS_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

describe("AppliedEngineeringPreparationService library incidents", () => {
  it("copies the exact reviewed artifact as a loose block and returns its saved questions", async () => {
    const confirmed = focus();
    const currentArtifact = APPLIED_ENGINEERING_REVIEW_CANDIDATES[0]!;
    const targetArtifact = APPLIED_ENGINEERING_REVIEW_CANDIDATES[1]!;
    const ranker = new AppliedEngineeringIncidentRankingService(
      NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE
    );
    const selection = ranker.rankSelectedIncident(confirmed, targetArtifact.caseKey, {
      recentIncidentKeys: [currentArtifact.caseKey]
    });
    const publishPreparedBlock = vi.fn().mockResolvedValue({ id: "library-block" });
    const historyBlock = vi.fn().mockResolvedValue({
      id: "library-block",
      questions: [{ id: "question-one", order: 1 }]
    });
    const service = new AppliedEngineeringPreparationService({
      prisma: {
        appliedEngineeringBlock: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: CURRENT_ID,
              isCurrent: true,
              status: "PRACTISING",
              focusRevisionId: FOCUS_ID,
              incidentVersion: { incidentKey: currentArtifact.caseKey },
              focusRevision: { focusSnapshot: confirmed }
            }
          ])
        },
        appliedEngineeringPreparationAttempt: { findUnique: vi.fn().mockResolvedValue(null) }
      } as unknown as PrismaService,
      focus: { confirm: vi.fn() },
      ranking: {
        rankFirstIncident: vi.fn(),
        rankSelectedIncident: vi.fn().mockReturnValue(selection)
      },
      persistence: {
        saveConfirmedFocus: vi.fn(),
        publishPreparedBlock,
        recordPreparationFailure: vi.fn()
      },
      practice: { current: vi.fn(), historyBlock }
    });

    await expect(
      service.startPath("owner-1", {
        requestId: REQUEST_ID,
        storyKey: targetArtifact.caseKey
      })
    ).resolves.toMatchObject({ replayed: false, block: { id: "library-block" } });

    expect(publishPreparedBlock).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        requestId: REQUEST_ID,
        focusRevisionId: FOCUS_ID,
        libraryBlock: true,
        selection,
        draft: {
          incident: targetArtifact.incident,
          questionBlock: targetArtifact.questionBlock
        }
      })
    );
    expect(historyBlock).toHaveBeenCalledWith("owner-1", "library-block");
  });
});

function focus(): AppliedEngineeringConfirmedFocus {
  return {
    schemaVersion: 1,
    focusFingerprint: `sha256:${"f".repeat(64)}`,
    confirmedAt: "2026-09-11T10:00:00.000Z",
    role: "backend",
    seniority: "mid",
    targetJob: "Backend Engineer",
    targetCompany: null,
    targetDate: null,
    stack: {
      language: "javascript",
      runtime: "nodejs",
      runtimeVersion: "22 LTS",
      framework: null
    },
    excludedIncidentKeys: [],
    resumeEvidence: {
      technologyKeys: ["nodejs"],
      projectKeywords: ["api"],
      productionSignalKeys: ["evidence-selection"]
    },
    baselineEvidence: {
      schemaVersion: 1,
      registryVersion: 1,
      sourceFingerprint: `sha256:${"b".repeat(64)}`,
      source: "initial-baseline",
      state: "GUIDED",
      evidence: "baseline",
      confidence: 0.24,
      questionId: "engineering-7",
      familiarity: "needs-refresh",
      weakSignalKeys: ["evidence-selection"],
      strongSignalKeys: [],
      unassessedSignalKeys: ["testing-verification"],
      sourceTopicLabels: [],
      sourceAreaId: "applied-engineering"
    }
  };
}
