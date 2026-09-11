import type { CoreTechnicalStoryRankingCandidate } from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "@/features/practice/core-technical/domain/story-ranking-catalogue";
import { coreTechnicalPracticePathTitle } from "@/features/practice/core-technical/domain/practice-path-presentation";
import { coreTechnicalPracticePathBlueprint } from "@/features/practice/core-technical/domain/practice-path-blueprints";
import type { CandidateProfile } from "@/lib/shared/types";
import type { PrismaService } from "@/server/database/prisma.service";
import type { CoreTechnicalRunnerService } from "./runner.service";

export type CoreTechnicalEligibilityReason =
  | "AVAILABLE"
  | "UNSUPPORTED_ROLE"
  | "LEVEL_REQUIRED"
  | "RUNNER_UNAVAILABLE"
  | "CONTENT_UNAVAILABLE";

export type CoreTechnicalEligibility = {
  available: boolean;
  reason: CoreTechnicalEligibilityReason;
  message: string;
  stack: {
    language: "javascript";
    runtime: "nodejs";
    runtimeVersion: "22 LTS";
  };
  requiredStoryCount: number;
  publishedStoryCount: number;
  stories: CoreTechnicalStoryLibraryEntry[];
};

export type CoreTechnicalStoryLibraryEntry = {
  key: string;
  version: number;
  title: string;
  expectedMinutes: number;
  difficulties: CoreTechnicalStoryRankingCandidate["difficulties"];
  topicKeys: string[];
  mechanismKeys: string[];
  questions: Array<{
    order: number;
    title: string;
    format: string;
  }>;
};

type EligibilityProfile = Pick<CandidateProfile, "targetRole" | "level">;

/** Fail-closed launch eligibility for the first complete two-story path. */
export class CoreTechnicalEligibilityService {
  constructor(
    _prisma: Pick<PrismaService, "coreTechnicalStoryVersion">,
    private readonly runner: Pick<CoreTechnicalRunnerService, "supportsStack">,
    private readonly catalogue: readonly CoreTechnicalStoryRankingCandidate[] = NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE
  ) {}

  async forProfile(profile: EligibilityProfile): Promise<CoreTechnicalEligibility> {
    const stack = {
      language: "javascript",
      runtime: "nodejs",
      runtimeVersion: "22 LTS"
    } as const;
    if (profile.targetRole !== "backend" && profile.targetRole !== "fullstack") {
      return unavailable(
        "UNSUPPORTED_ROLE",
        "Core Technical is currently available for backend and full-stack Node.js paths.",
        stack
      );
    }
    if (!profile.level) {
      return unavailable(
        "LEVEL_REQUIRED",
        "Choose your experience level before starting Core Technical practice.",
        stack
      );
    }
    if (!this.runner.supportsStack(stack)) {
      return unavailable(
        "RUNNER_UNAVAILABLE",
        "The pinned Node.js practice runner is unavailable right now.",
        stack
      );
    }

    const role = profile.targetRole;
    const candidates = this.catalogue.filter(
      (candidate) =>
        candidate.publicationStatus === "published" &&
        candidate.roles.includes(role) &&
        candidate.language === stack.language &&
        candidate.runtime === stack.runtime &&
        candidate.runtimeVersion === stack.runtimeVersion
    );
    if (candidates.length < 2) {
      return unavailable(
        "CONTENT_UNAVAILABLE",
        "The reviewed Node.js practice path is not available yet.",
        stack
      );
    }

    return {
      available: true,
      reason: "AVAILABLE",
      message: "Your JavaScript and Node.js 22 practice path is ready.",
      stack,
      requiredStoryCount: 2,
      publishedStoryCount: candidates.length,
      stories: candidates.map(publicStory)
    };
  }
}

function unavailable(
  reason: Exclude<CoreTechnicalEligibilityReason, "AVAILABLE">,
  message: string,
  stack: CoreTechnicalEligibility["stack"],
  stories: CoreTechnicalStoryLibraryEntry[] = []
): CoreTechnicalEligibility {
  return {
    available: false,
    reason,
    message,
    stack,
    requiredStoryCount: 2,
    publishedStoryCount: stories.length,
    stories
  };
}

function publicStory(
  candidate: CoreTechnicalStoryRankingCandidate
): CoreTechnicalStoryLibraryEntry {
  const blueprint = coreTechnicalPracticePathBlueprint(candidate.key, candidate.version);
  return {
    key: candidate.key,
    version: candidate.version,
    title: coreTechnicalPracticePathTitle(candidate.key, candidate.title),
    expectedMinutes: blueprint?.expectedMinutes ?? 45,
    difficulties: candidate.difficulties,
    topicKeys: [...candidate.topicKeys],
    mechanismKeys: [...candidate.mechanismKeys],
    questions: blueprint?.stages.map(({ order, title, format }) => ({ order, title, format })) ?? []
  };
}
