import { ArchitectureScenarioPublicationStatus } from "@prisma/client";
import type { ArchitectureDesignConfirmedFocus } from "@/features/practice/architecture-design/domain/focus-ranking-contracts";
import { architectureDesignQuestionBlockSchema } from "@/features/practice/architecture-design/domain/question-contracts";
import { architectureDesignScenarioSchema } from "@/features/practice/architecture-design/domain/scenario-contracts";
import type { StoryPracticeRepositoryPort } from "@/features/practice/shared/server/contracts";
import {
  ArchitectureDesignPersistenceService,
  type PublishArchitectureBlockInput,
  type PublishedArchitectureBlock,
  type SavedArchitectureFocusRevision
} from "./persistence.service";

/** Prisma implementation of the repository port consumed by shared preparation orchestration. */
export class ArchitectureDesignRepositoryAdapter
  extends ArchitectureDesignPersistenceService
  implements
    StoryPracticeRepositoryPort<
      ArchitectureDesignConfirmedFocus,
      SavedArchitectureFocusRevision,
      PublishArchitectureBlockInput,
      PublishedArchitectureBlock
    >
{
  async published(candidates: readonly ArchitectureScenarioPublicationIdentity[]) {
    if (candidates.length === 0) return [];
    const rows = await this.prisma.architectureScenarioVersion.findMany({
      where: {
        publicationStatus: ArchitectureScenarioPublicationStatus.PUBLISHED,
        OR: candidates.map(({ key, version }) => ({ scenarioKey: key, version }))
      },
      select: { scenarioKey: true, version: true }
    });
    return rows.map(({ scenarioKey: key, version }) => ({ key, version }));
  }

  async reviewedScenarioVersion(scenarioKey: string, version: number) {
    const row = await this.prisma.architectureScenarioVersion.findUnique({
      where: { scenarioKey_version: { scenarioKey, version } },
      select: {
        publicationStatus: true,
        contentFingerprint: true,
        scenarioSnapshot: true,
        privateQuestionSnapshot: true
      }
    });
    if (!row || row.publicationStatus !== ArchitectureScenarioPublicationStatus.PUBLISHED) {
      return null;
    }
    return {
      contentFingerprint: row.contentFingerprint,
      scenario: architectureDesignScenarioSchema.parse(row.scenarioSnapshot),
      questionBlock: architectureDesignQuestionBlockSchema.parse(row.privateQuestionSnapshot)
    };
  }
}

export type ArchitectureScenarioPublicationIdentity = Readonly<{
  key: string;
  version: number;
}>;
