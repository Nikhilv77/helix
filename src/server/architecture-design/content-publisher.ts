import { auditArchitectureDesignContent } from "@/lib/practice/architecture-design/content-release-audit";
import type { ArchitectureDesignScenarioRankingCandidate } from "@/lib/practice/architecture-design/focus-ranking-contracts";
import { toPublicArchitectureDesignQuestionBlock } from "@/lib/practice/architecture-design/question-contracts";
import type { ArchitectureDesignReviewArtifact } from "@/lib/practice/architecture-design/review-artifact-contracts";
import { storyPracticeFingerprint } from "@/server/story-practice/practice-orchestrator";

export type ArchitectureDesignPublicationPayload = Readonly<{
  scenarioKey: string;
  version: 1;
  contentFingerprint: string;
  scenarioSnapshot: ArchitectureDesignReviewArtifact["scenario"];
  privateQuestionSnapshot: ArchitectureDesignReviewArtifact["questionBlock"];
  publicQuestionSnapshot: ReturnType<typeof toPublicArchitectureDesignQuestionBlock>;
  reviewSnapshot: Pick<
    ArchitectureDesignReviewArtifact,
    "artifactVersion" | "auditVersion" | "authoredAt" | "authoring" | "humanReview"
  >;
}>;

/** Builds immutable repository payloads only after automated and human approval gates pass. */
export function buildArchitectureDesignPublicationPayloads(
  artifacts: readonly ArchitectureDesignReviewArtifact[],
  catalogue: readonly ArchitectureDesignScenarioRankingCandidate[]
): readonly ArchitectureDesignPublicationPayload[] {
  const payloads = artifacts.map((artifact) => {
    const audit = auditArchitectureDesignContent(artifact);
    if (!audit.releaseEligible || audit.reviewStatus !== "approved") {
      throw new Error(
        `Architecture artifact is not release eligible: ${artifact.caseKey} (${audit.reviewStatus})`
      );
    }
    const catalogueEntry = catalogue.find((entry) => entry.key === artifact.scenario.key);
    if (
      !catalogueEntry ||
      catalogueEntry.version !== 1 ||
      catalogueEntry.publicationStatus !== "published"
    ) {
      throw new Error(`Architecture catalogue entry is not published: ${artifact.scenario.key}`);
    }
    return {
      scenarioKey: artifact.scenario.key,
      version: 1 as const,
      contentFingerprint: storyPracticeFingerprint({
        scenario: artifact.scenario,
        questionBlock: artifact.questionBlock
      }),
      scenarioSnapshot: artifact.scenario,
      privateQuestionSnapshot: artifact.questionBlock,
      publicQuestionSnapshot: toPublicArchitectureDesignQuestionBlock(artifact.questionBlock),
      reviewSnapshot: {
        artifactVersion: artifact.artifactVersion,
        auditVersion: artifact.auditVersion,
        authoredAt: artifact.authoredAt,
        authoring: artifact.authoring,
        humanReview: artifact.humanReview
      }
    };
  });
  return deepFreeze(payloads);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
