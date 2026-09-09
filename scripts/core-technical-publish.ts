import "dotenv/config";

import followOperationArtifact from "../src/features/practice/core-technical/domain/generated/follow-operation-guided-benchmark.json";
import operationFailsHalfwayArtifact from "../src/features/practice/core-technical/domain/generated/operation-fails-halfway-standard-benchmark.json";
import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "../src/features/practice/core-technical/domain/gold-cases";
import { auditCoreTechnicalGoldCases } from "../src/features/practice/core-technical/domain/gold-case-audit";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "../src/features/practice/core-technical/domain/domain-map";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "../src/features/practice/core-technical/domain/interview-patterns";
import { coreTechnicalStoryReviewArtifactSchema } from "../src/features/practice/core-technical/domain/review-artifact-contracts";
import { NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE } from "../src/features/practice/core-technical/domain/story-ranking-catalogue";
import { PrismaService } from "../src/server/database/prisma.service";
import { CoreTechnicalPersistenceService } from "../src/features/practice/core-technical/server/persistence.service";

const artifacts = [followOperationArtifact, operationFailsHalfwayArtifact].map((artifact) =>
  coreTechnicalStoryReviewArtifactSchema.parse(artifact)
);

async function main(): Promise<void> {
  const audit = auditCoreTechnicalGoldCases({
    cases: NODEJS_CORE_TECHNICAL_GOLD_CASES,
    domainMap: NODEJS_CORE_TECHNICAL_DOMAIN_MAP,
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
  });
  if (!audit.releaseReady) {
    throw new Error(
      `Core Technical gold cases are not release ready: ${audit.unapprovedCaseKeys.join(", ")}`
    );
  }

  for (const artifact of artifacts) {
    if (
      artifact.humanReview.status !== "approved" ||
      artifact.evaluation.humanReviewStatus !== "approved" ||
      !artifact.evaluation.releaseEligible
    ) {
      throw new Error(`Core Technical artifact is not release eligible: ${artifact.caseKey}`);
    }
    const catalogueEntry = NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE.find(
      (entry) => entry.key === artifact.story.key
    );
    if (!catalogueEntry || catalogueEntry.publicationStatus !== "published") {
      throw new Error(`Core Technical catalogue entry is not published: ${artifact.story.key}`);
    }
  }

  const prisma = new PrismaService();
  try {
    await prisma.connect();
    const persistence = new CoreTechnicalPersistenceService(prisma);
    const published = [];
    for (const artifact of artifacts) {
      const storyVersion = await persistence.publishReviewedStoryVersion(artifact);
      const catalogueEntry = NODEJS_CORE_TECHNICAL_STORY_RANKING_CATALOGUE.find(
        (entry) => entry.key === storyVersion.storyKey
      );
      if (!catalogueEntry || catalogueEntry.version !== storyVersion.version) {
        throw new Error(
          `Published database version does not match the catalogue: ${storyVersion.storyKey}@${storyVersion.version}`
        );
      }
      published.push({
        id: storyVersion.id,
        storyKey: storyVersion.storyKey,
        version: storyVersion.version,
        publicationStatus: storyVersion.publicationStatus
      });
    }
    process.stdout.write(JSON.stringify({ published }, null, 2) + "\n");
  } finally {
    await prisma.disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Core Technical publication failed: ${error instanceof Error ? error.message : "Unknown error"}\n`
  );
  process.exitCode = 1;
});
