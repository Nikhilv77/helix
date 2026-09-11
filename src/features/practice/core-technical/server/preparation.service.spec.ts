import { describe, expect, it, vi } from "vitest";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";
import type { CoreTechnicalConfirmedFocus } from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "@/features/practice/core-technical/domain/story-ranking-catalogue";
import type { PrismaService } from "@/server/database/prisma.service";
import { CoreTechnicalPreparationService } from "./preparation.service";
import { CoreTechnicalStoryRankingService } from "./story-ranking.service";

const CURRENT_ID = "11111111-1111-4111-8111-111111111111";
const FOCUS_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

describe("CoreTechnicalPreparationService library paths", () => {
  it("personalizes and atomically switches to an explicitly selected reviewed path", async () => {
    const focus = confirmedFocus();
    const ranker = new CoreTechnicalStoryRankingService(
      NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE
    );
    const selection = ranker.rankSelectedStory(focus, "javascript-scope-closures-retained-state");
    const prepareReviewedDraft = vi.fn().mockResolvedValue({ draft: true });
    const publishPreparedBlock = vi.fn().mockResolvedValue({ id: "published-block" });
    const service = new CoreTechnicalPreparationService({
      prisma: {
        coreTechnicalBlock: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: CURRENT_ID,
              isCurrent: true,
              focusRevisionId: FOCUS_ID,
              storyVersion: { storyKey: "javascript-values-copying-mutation" },
              focusRevision: { focusSnapshot: focus }
            }
          ])
        },
        coreTechnicalPreparationAttempt: { findUnique: vi.fn().mockResolvedValue(null) }
      } as unknown as PrismaService,
      focus: { confirm: vi.fn() },
      ranking: {
        rankFirstStory: vi.fn(),
        rankSelectedStory: vi.fn().mockReturnValue(selection)
      },
      generation: { prepareReviewedDraft },
      persistence: {
        saveConfirmedFocus: vi.fn(),
        publishPreparedBlock,
        recordPreparationFailure: vi.fn()
      },
      practice: {
        current: vi.fn().mockResolvedValue({ id: CURRENT_ID }),
        historyBlock: vi.fn().mockResolvedValue({ id: "published-block" })
      }
    });

    await expect(
      service.startPath("owner-1", {
        requestId: REQUEST_ID,
        storyKey: "javascript-scope-closures-retained-state"
      })
    ).resolves.toMatchObject({ replayed: false, block: { id: "published-block" } });

    expect(prepareReviewedDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        seniority: "mid",
        resumeTopicKeys: focus.resumeEvidence.topicKeys,
        recentTopicKeys: expect.arrayContaining(["javascript-values-and-mutation"]),
        personalizePresentation: true,
        reviewedContract: expect.objectContaining({
          storyKey: "javascript-scope-closures-retained-state"
        })
      }),
      { fallbackToApprovedArtifactOnProviderFailure: true }
    );
    expect(publishPreparedBlock).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        requestId: REQUEST_ID,
        focusRevisionId: FOCUS_ID,
        libraryBlock: true,
        selection
      })
    );
  });
});

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
    resumeEvidence: {
      topicKeys: ["javascript-scope-and-closures"],
      mechanismKeys: ["closure"]
    },
    baselineEvidence: {
      schemaVersion: 1,
      registryVersion: 1,
      sourceFingerprint: `sha256:${"b".repeat(64)}`,
      state: "STANDARD",
      validAnswerCount: 3,
      correctAnswerCount: 2,
      questions: (["technical-1", "technical-2", "technical-3"] as const).map((section, index) => ({
        section,
        resolution: "RESOLVED",
        questionId: `technical-${index}`,
        questionFingerprint: `sha256:${String(index + 1).repeat(64)}`,
        conceptKeys: [],
        mechanismKeys: [],
        correctness: index < 2 ? "CORRECT" : "INCORRECT"
      })),
      weakConceptKeys: ["javascript-scope-and-closures"],
      strongConceptKeys: [],
      unassessedConceptKeys: topics.filter((key) => key !== "javascript-scope-and-closures"),
      weakMechanismKeys: ["closure"],
      strongMechanismKeys: [],
      unassessedMechanismKeys: mechanisms.filter((key) => key !== "closure")
    }
  };
}
