import "dotenv/config";

import {
  ARCHITECTURE_DESIGN_REVIEW_CANDIDATES,
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  auditArchitectureDesignContent
} from "../src/features/practice/architecture-design/domain";
import { buildArchitectureDesignPublicationPayloads } from "../src/features/practice/architecture-design/server/content-publisher";
import { ArchitectureDesignPersistenceService } from "../src/features/practice/architecture-design/server/persistence.service";
import { PrismaService } from "../src/server/database/prisma.service";

async function main(): Promise<void> {
  const audits = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.map((artifact) => ({
    caseKey: artifact.caseKey,
    ...auditArchitectureDesignContent(artifact)
  }));
  const blocked = audits.filter((audit) => !audit.releaseEligible);
  if (blocked.length > 0) {
    process.stdout.write(`${JSON.stringify({ audits }, null, 2)}\n`);
    throw new Error(
      `Architecture publication requires human approval for: ${blocked
        .map(({ caseKey }) => caseKey)
        .join(", ")}`
    );
  }

  const payloads = buildArchitectureDesignPublicationPayloads(
    ARCHITECTURE_DESIGN_REVIEW_CANDIDATES,
    ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE
  );
  const prisma = new PrismaService();
  try {
    await prisma.connect();
    const persistence = new ArchitectureDesignPersistenceService(prisma);
    const published = [];
    for (const artifact of ARCHITECTURE_DESIGN_REVIEW_CANDIDATES) {
      const scenarioVersion = await persistence.publishReviewedScenarioVersion(artifact);
      const payload = payloads.find(
        ({ scenarioKey }) => scenarioKey === scenarioVersion.scenarioKey
      );
      if (
        !payload ||
        payload.version !== scenarioVersion.version ||
        payload.contentFingerprint !== scenarioVersion.contentFingerprint
      ) {
        throw new Error(
          `Published database version does not match the approved payload: ${scenarioVersion.scenarioKey}@${scenarioVersion.version}`
        );
      }
      published.push({
        id: scenarioVersion.id,
        scenarioKey: scenarioVersion.scenarioKey,
        version: scenarioVersion.version,
        publicationStatus: scenarioVersion.publicationStatus,
        contentFingerprint: scenarioVersion.contentFingerprint
      });
    }
    process.stdout.write(`${JSON.stringify({ published }, null, 2)}\n`);
  } finally {
    await prisma.disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Architecture publication failed: ${error instanceof Error ? error.message : "Unknown error"}\n`
  );
  process.exitCode = 1;
});
