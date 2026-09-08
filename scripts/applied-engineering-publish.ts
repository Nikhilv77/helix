import "dotenv/config";

import { auditAppliedEngineeringContent } from "../src/lib/practice/applied-engineering/content-release-audit";
import { NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE } from "../src/lib/practice/applied-engineering/incident-ranking-catalogue";
import { appliedEngineeringReviewArtifactSchema } from "../src/lib/practice/applied-engineering/review-artifact-contracts";
import { APPLIED_ENGINEERING_REVIEW_CANDIDATES } from "../src/lib/practice/applied-engineering/reviewed-incidents";
import { AppliedEngineeringPersistenceService } from "../src/server/applied-engineering/persistence.service";
import { PrismaService } from "../src/server/database/prisma.service";

const artifacts = APPLIED_ENGINEERING_REVIEW_CANDIDATES.map((artifact) =>
  appliedEngineeringReviewArtifactSchema.parse(artifact)
);

async function main(): Promise<void> {
  for (const artifact of artifacts) {
    const audit = auditAppliedEngineeringContent(artifact);
    if (!audit.releaseEligible || audit.reviewStatus !== "approved") {
      throw new Error(`Applied Engineering artifact is not release eligible: ${artifact.caseKey}`);
    }
    const catalogueEntry = NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE.find(
      (entry) => entry.key === artifact.incident.key
    );
    if (
      !catalogueEntry ||
      catalogueEntry.publicationStatus !== "published" ||
      catalogueEntry.version !== 1
    ) {
      throw new Error(
        `Applied Engineering catalogue entry is not published: ${artifact.incident.key}`
      );
    }
  }

  const prisma = new PrismaService();
  try {
    await prisma.connect();
    const persistence = new AppliedEngineeringPersistenceService(prisma);
    const published = [];
    for (const artifact of artifacts) {
      const incidentVersion = await persistence.publishReviewedIncidentVersion(artifact);
      const catalogueEntry = NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE.find(
        (entry) => entry.key === incidentVersion.incidentKey
      );
      if (!catalogueEntry || catalogueEntry.version !== incidentVersion.version) {
        throw new Error(
          `Published database version does not match the catalogue: ${incidentVersion.incidentKey}@${incidentVersion.version}`
        );
      }
      published.push({
        id: incidentVersion.id,
        incidentKey: incidentVersion.incidentKey,
        version: incidentVersion.version,
        publicationStatus: incidentVersion.publicationStatus
      });
    }
    process.stdout.write(`${JSON.stringify({ published }, null, 2)}\n`);
  } finally {
    await prisma.disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Applied Engineering publication failed: ${error instanceof Error ? error.message : "Unknown error"}\n`
  );
  process.exitCode = 1;
});
