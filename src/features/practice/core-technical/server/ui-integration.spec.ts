import { CoreTechnicalStoryPublicationStatus } from "@prisma/client";
import { requireCoreTechnicalLaunchEligibility } from "@/app/api/practice/core-technical/_shared";
import type { CoreTechnicalStoryRankingCandidate } from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import {
  coreTechnicalHistoryNavigation,
  coreTechnicalPracticeEntry,
  coreTechnicalViewState
} from "@/features/practice/core-technical/domain/ui-state";
import type { CandidateProfile } from "@/lib/shared/types";
import type { PrismaService } from "@/server/database/prisma.service";
import type { AppContainer } from "@/server/app-container";
import { CoreTechnicalEligibilityService } from "./eligibility.service";
import type { CoreTechnicalPublicBlock } from "./practice.service";

describe("Core Technical UI integration state", () => {
  it("fails closed until two matching catalogue and database stories plus the runner are available", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { storyKey: "story-one", version: 1 },
      { storyKey: "story-two", version: 1 }
    ]);
    const runner = { supportsStack: vi.fn().mockReturnValue(true) };
    const service = new CoreTechnicalEligibilityService(
      { coreTechnicalStoryVersion: { findMany } } as unknown as PrismaService,
      runner,
      [candidate("story-one"), candidate("story-two")]
    );

    await expect(service.forProfile(profile())).resolves.toMatchObject({
      available: true,
      reason: "AVAILABLE",
      publishedStoryCount: 2,
      stories: [
        { key: "story-one", title: "Title story-one" },
        { key: "story-two", title: "Title story-two" }
      ]
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        publicationStatus: CoreTechnicalStoryPublicationStatus.PUBLISHED,
        OR: [
          { storyKey: "story-one", version: 1 },
          { storyKey: "story-two", version: 1 }
        ]
      },
      select: { storyKey: true, version: true }
    });

    const underReview = new CoreTechnicalEligibilityService(
      { coreTechnicalStoryVersion: { findMany } } as unknown as PrismaService,
      runner,
      [candidate("story-one", "review"), candidate("story-two")]
    );
    await expect(underReview.forProfile(profile())).resolves.toMatchObject({
      available: false,
      reason: "CONTENT_UNAVAILABLE",
      stories: []
    });
  });

  it("rejects a direct launch mutation when the server eligibility gate is unavailable", async () => {
    const forProfile = vi.fn().mockResolvedValue({
      available: false,
      reason: "RUNNER_UNAVAILABLE",
      message: "The pinned Node.js practice runner is unavailable right now."
    });

    await expect(
      requireCoreTechnicalLaunchEligibility(
        { coreTechnicalEligibilityService: { forProfile } } as unknown as AppContainer,
        profile() as CandidateProfile
      )
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CORE_TECHNICAL_RUNNER_UNAVAILABLE"
    });
    expect(forProfile).toHaveBeenCalledTimes(1);
  });

  it("maps every block lifecycle and preserves a resumable card independently of new eligibility", () => {
    const unavailable = { available: false };
    expect(coreTechnicalViewState(null, unavailable)).toBe("unavailable");
    expect(coreTechnicalViewState(null, { available: true })).toBe("confirmation");
    expect(coreTechnicalViewState(block("PRACTISING"), unavailable)).toBe("practising");
    expect(coreTechnicalViewState(block("ASSESSMENT_READY"), unavailable)).toBe("assessment-ready");
    expect(coreTechnicalViewState(block("ASSESSMENT_IN_PROGRESS"), unavailable)).toBe(
      "assessment-in-progress"
    );
    const finalizing = block("ASSESSMENT_IN_PROGRESS");
    finalizing.assessment = { status: "FINALIZING" } as CoreTechnicalPublicBlock["assessment"];
    expect(coreTechnicalViewState(finalizing, unavailable)).toBe("assessment-finalizing");
    expect(coreTechnicalViewState(block("ASSESSED"), unavailable)).toBe("report");
    expect(coreTechnicalPracticeEntry(unavailable, null)).toBeNull();
    expect(coreTechnicalPracticeEntry(unavailable, block("PRACTISING"))).toMatchObject({
      key: "core-technical",
      href: "/practice/core-technical",
      totalQuestions: 8
    });
  });

  it("derives previous and next history links by immutable ordinal, not query order", () => {
    const history = [summary("third", 3), summary("first", 1), summary("second", 2)];
    expect(coreTechnicalHistoryNavigation(history, "second")).toMatchObject({
      previousBlockId: "first",
      nextBlockId: "third",
      totalBlocks: 3
    });
    expect(coreTechnicalHistoryNavigation(history, "foreign")).toBeNull();
  });
});

function candidate(
  key: string,
  publicationStatus: CoreTechnicalStoryRankingCandidate["publicationStatus"] = "published"
): CoreTechnicalStoryRankingCandidate {
  return {
    key,
    version: 1,
    title: `Title ${key}`,
    publicationStatus,
    roles: ["backend", "fullstack"],
    language: "javascript",
    runtime: "nodejs",
    runtimeVersion: "22 LTS",
    frameworks: [],
    difficulties: ["guided", "standard", "stretch"],
    prerequisiteStoryKeys: [],
    topicKeys: ["async-scheduling"],
    mechanismKeys: ["event-loop"],
    targetKeywords: ["backend"]
  };
}

function profile(): Pick<CandidateProfile, "targetRole" | "level"> {
  return { targetRole: "backend", level: "3-5" };
}

function block(status: CoreTechnicalPublicBlock["status"]): CoreTechnicalPublicBlock {
  return {
    id: "block-one",
    ordinal: 1,
    isCurrent: true,
    status,
    story: {
      title: "Follow the operation",
      premise: "A production request crosses several asynchronous boundaries during an incident.",
      expectedMinutes: 45,
      mechanismKeys: ["event-loop"],
      stages: []
    },
    selection: { difficulty: "guided" },
    questions: []
  } as unknown as CoreTechnicalPublicBlock;
}

function summary(id: string, ordinal: number) {
  return {
    id,
    ordinal,
    isCurrent: ordinal === 3,
    status: ordinal === 3 ? "PRACTISING" : "ASSESSED",
    story: {},
    completedQuestionCount: 8,
    learnedQuestionCount: 0,
    assessment: null,
    preparedAt: new Date(ordinal).toISOString(),
    assessedAt: ordinal === 3 ? null : new Date(ordinal).toISOString()
  } as never;
}
