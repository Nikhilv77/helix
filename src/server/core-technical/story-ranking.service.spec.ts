import { describe, expect, it } from "vitest";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/lib/practice/core-technical/domain-map";
import type { CoreTechnicalBaselineEvidence } from "@/lib/practice/core-technical/baseline-evidence-contracts";
import type { CoreTechnicalConfirmedFocus } from "@/lib/practice/core-technical/focus-ranking-contracts";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "@/lib/practice/core-technical/story-ranking-catalogue";
import { CoreTechnicalStoryRankingService } from "./story-ranking.service";

const publishedCatalogue = NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE.map((story) => ({
  ...story,
  publicationStatus: "published" as const
}));

describe("CoreTechnicalStoryRankingService", () => {
  it("applies the documented 35/25/15/15/10 policy and selects assessment gaps", () => {
    const service = new CoreTechnicalStoryRankingService(publishedCatalogue);
    const result = service.rankFirstStory(
      focus(
        evidence({
          state: "GUIDED",
          weakConceptKeys: ["nodejs-streams-and-io", "nodejs-event-loop-health"],
          weakMechanismKeys: ["backpressure", "event-loop-lag"]
        })
      )
    );

    expect(result.policyVersion).toBe(1);
    expect(result.selectedStory.storyKey).toBe("follow-the-operation");
    expect(result.selectedStory.difficulty).toBe("guided");
    expect(result.selectedStory.emphasizedConceptKeys).toContain("async-scheduling");
    expect(result.selectedStory.scores).toMatchObject({
      baselineGapTransfer: expect.any(Number),
      targetRoleJob: expect.any(Number),
      resumeProjectRelevance: expect.any(Number),
      plannedCoverage: expect.any(Number),
      storyDiversity: expect.any(Number),
      total: expect.any(Number)
    });
    expect(result.reason).toContain("initial assessment supports an unassessed transfer");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("changes the selected story, emphasis, and difficulty when baseline evidence changes", () => {
    const service = new CoreTechnicalStoryRankingService(publishedCatalogue);
    const guided = service.rankFirstStory(
      focus(
        evidence({
          state: "GUIDED",
          weakConceptKeys: ["javascript-values-and-mutation"],
          weakMechanismKeys: ["reference-identity"]
        })
      )
    );
    const stretch = service.rankFirstStory(focus(evidence({ state: "STRETCH" })));

    expect(guided.selectedStory.storyKey).toBe("follow-the-operation");
    expect(guided.selectedStory.difficulty).toBe("guided");
    expect(guided.selectedStory.emphasizedConceptKeys[0]).toBe("javascript-values-and-mutation");
    expect(stretch.selectedStory.storyKey).toBe("the-operation-fails-halfway");
    expect(stretch.selectedStory.difficulty).toBe("standard");
    expect(stretch.reason).toContain("unassessed transfer");
  });

  it("uses a broad foundation story when evidence is UNKNOWN", () => {
    const service = new CoreTechnicalStoryRankingService(publishedCatalogue);
    const result = service.rankFirstStory(focus(evidence({ state: "UNKNOWN" })));
    expect(result.selectedStory.storyKey).toBe("follow-the-operation");
    expect(result.selectedStory.difficulty).toBe("guided");
    expect(result.reason).toContain("baseline evidence is incomplete");
  });

  it("selects the shipped standard block instead of generating an unavailable story variant", () => {
    const service = new CoreTechnicalStoryRankingService(publishedCatalogue);
    const result = service.rankFirstStory(
      focus(evidence({ state: "STANDARD" }), {
        targetJob: "Java Full Stack Developer",
        resumeEvidence: {
          topicKeys: ["javascript-values-and-mutation", "javascript-scope-and-closures"],
          mechanismKeys: ["reference-identity", "lexical-scope"]
        }
      })
    );

    expect(result.selectedStory).toMatchObject({
      storyKey: "the-operation-fails-halfway",
      title: "The operation fails halfway",
      difficulty: "standard"
    });
  });

  it("enforces publication, exact stack, role, framework, prerequisites, and exclusions as hard gates", () => {
    const reviewOnly = new CoreTechnicalStoryRankingService(
      NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE.map((story) => ({
        ...story,
        publicationStatus: "review" as const
      }))
    );
    expect(() => reviewOnly.rankFirstStory(focus(evidence({ state: "GUIDED" })))).toThrow(
      "No published"
    );

    const incompatible = publishedCatalogue.map((story) => ({
      ...story,
      prerequisiteStoryKeys: ["prior-story"]
    }));
    expect(() =>
      new CoreTechnicalStoryRankingService(incompatible).rankFirstStory(
        focus(evidence({ state: "GUIDED" }))
      )
    ).toThrow("No published");

    const excluded = focus(evidence({ state: "GUIDED" }), {
      excludedTopicKeys: ["javascript-values-and-mutation"]
    });
    const result = new CoreTechnicalStoryRankingService(publishedCatalogue).rankFirstStory(
      excluded
    );
    expect(result.selectedStory.storyKey).toBe("the-operation-fails-halfway");
    expect(result.selectedStory.difficulty).toBe("standard");
  });

  it("applies recent-story and topic cooldown without changing the frozen focus", () => {
    const service = new CoreTechnicalStoryRankingService(publishedCatalogue);
    const confirmed = focus(evidence({ state: "STRETCH" }));
    const before = JSON.stringify(confirmed);
    const result = service.rankFirstStory(confirmed, {
      recentStoryKeys: ["the-operation-fails-halfway"],
      recentTopicKeys: ["nodejs-streams-and-io", "nodejs-event-loop-health"]
    });
    const repeated = result.rankings.find(
      (story) => story.storyKey === "the-operation-fails-halfway"
    )!;
    expect(repeated.scores.storyDiversity).toBeLessThan(10);
    expect(JSON.stringify(confirmed)).toBe(before);
  });

  it("breaks exact score ties by stable story key", () => {
    const duplicateScore = publishedCatalogue.map((story) => ({
      ...story,
      difficulties: ["standard" as const],
      targetKeywords: [],
      topicKeys: ["async-scheduling"],
      mechanismKeys: ["event-loop"]
    }));
    const result = new CoreTechnicalStoryRankingService(duplicateScore).rankFirstStory(
      focus(evidence({ state: "STANDARD" }), {
        resumeEvidence: { topicKeys: [], mechanismKeys: [] }
      })
    );
    expect(result.rankings[0]!.storyKey).toBe("follow-the-operation");
  });
});

function focus(
  baselineEvidence: CoreTechnicalBaselineEvidence,
  overrides: Partial<CoreTechnicalConfirmedFocus> = {}
): CoreTechnicalConfirmedFocus {
  return {
    schemaVersion: 1,
    focusFingerprint: `sha256:${"f".repeat(64)}`,
    confirmedAt: "2026-09-07T10:00:00.000Z",
    role: "backend",
    seniority: "senior",
    targetJob: "Senior Backend Engineer",
    targetCompany: "Example Labs",
    targetDate: "2026-12-01",
    stack: {
      language: "javascript",
      runtime: "nodejs",
      runtimeVersion: "22 LTS",
      framework: "express"
    },
    excludedTopicKeys: [],
    resumeEvidence: {
      topicKeys: ["nodejs-streams-and-io", "nodejs-event-loop-health"],
      mechanismKeys: ["backpressure", "event-loop-lag"]
    },
    baselineEvidence,
    ...overrides
  };
}

function evidence(
  overrides: Partial<CoreTechnicalBaselineEvidence>
): CoreTechnicalBaselineEvidence {
  const domainTopics = NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key);
  const domainMechanisms = [
    ...new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys))
  ];
  const state = overrides.state ?? "STANDARD";
  const weakConceptKeys = overrides.weakConceptKeys ?? [];
  const weakMechanismKeys = overrides.weakMechanismKeys ?? [];
  return {
    schemaVersion: 1,
    registryVersion: 1,
    sourceFingerprint: `sha256:${"b".repeat(64)}`,
    state,
    validAnswerCount: state === "UNKNOWN" ? 0 : 3,
    correctAnswerCount: state === "STRETCH" ? 3 : state === "STANDARD" ? 2 : 1,
    questions: (["technical-1", "technical-2", "technical-3"] as const).map((section, index) => ({
      section,
      resolution: state === "UNKNOWN" ? "MISSING" : "RESOLVED",
      questionId: state === "UNKNOWN" ? null : `technical-${index}`,
      questionFingerprint: state === "UNKNOWN" ? null : `sha256:${String(index + 2).repeat(64)}`,
      conceptKeys: [],
      mechanismKeys: [],
      correctness: state === "UNKNOWN" ? "UNKNOWN" : "CORRECT"
    })),
    weakConceptKeys,
    strongConceptKeys: [],
    unassessedConceptKeys: domainTopics.filter((key) => !weakConceptKeys.includes(key)),
    weakMechanismKeys,
    strongMechanismKeys: [],
    unassessedMechanismKeys: domainMechanisms.filter((key) => !weakMechanismKeys.includes(key)),
    ...overrides
  };
}
