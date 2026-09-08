import {
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  type ArchitectureDesignScenarioRankingCandidate
} from "@/lib/practice/architecture-design";
import type { CandidateProfile } from "@/lib/shared/types";
import type { ArchitectureScenarioPublicationIdentity } from "./repository-adapter";

export type ArchitectureDesignEligibilityReason =
  "AVAILABLE" | "UNSUPPORTED_ROLE" | "LEVEL_REQUIRED" | "CONTENT_UNAVAILABLE";

export type ArchitectureDesignScenarioLibraryEntry = Readonly<{
  key: string;
  version: number;
  title: string;
  difficulties: ArchitectureDesignScenarioRankingCandidate["difficulties"];
  topicKeys: string[];
  dimensionKeys: ArchitectureDesignScenarioRankingCandidate["dimensionKeys"];
}>;

export type ArchitectureDesignEligibility = Readonly<{
  available: boolean;
  reason: ArchitectureDesignEligibilityReason;
  message: string;
  requiredScenarioCount: number;
  publishedScenarioCount: number;
  scenarios: ArchitectureDesignScenarioLibraryEntry[];
}>;

export type ArchitectureDesignPublicationReader = {
  published(
    candidates: readonly ArchitectureScenarioPublicationIdentity[]
  ): Promise<readonly ArchitectureScenarioPublicationIdentity[]>;
};

type EligibilityProfile = Pick<CandidateProfile, "targetRole" | "level">;

/** Fails closed until two compatible, human-reviewed database versions exist. */
export class ArchitectureDesignEligibilityService {
  private readonly catalogue: readonly ArchitectureDesignScenarioRankingCandidate[];

  constructor(
    private readonly dependencies: {
      publications: ArchitectureDesignPublicationReader;
      catalogue?: readonly ArchitectureDesignScenarioRankingCandidate[];
    }
  ) {
    this.catalogue = dependencies.catalogue ?? ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE;
  }

  async forProfile(profile: EligibilityProfile): Promise<ArchitectureDesignEligibility> {
    if (profile.targetRole !== "backend" && profile.targetRole !== "fullstack") {
      return unavailable(
        "UNSUPPORTED_ROLE",
        "Architecture & Design is currently available for backend and full-stack paths."
      );
    }
    const role = profile.targetRole;
    const seniority = toSeniority(profile.level);
    if (!seniority) {
      return unavailable(
        "LEVEL_REQUIRED",
        "Choose your experience level before starting Architecture & Design practice."
      );
    }
    const candidates = this.catalogue.filter(
      (candidate) =>
        candidate.publicationStatus === "published" &&
        candidate.roles.includes(role) &&
        candidate.seniorities.includes(seniority)
    );
    if (candidates.length < 2) {
      return unavailable(
        "CONTENT_UNAVAILABLE",
        "The reviewed Architecture & Design scenario path is not available yet."
      );
    }
    const published = await this.dependencies.publications.published(
      candidates.map(({ key, version }) => ({ key, version }))
    );
    const identities = new Set(published.map(({ key, version }) => `${key}:${version}`));
    const ready = candidates.filter((candidate) =>
      identities.has(`${candidate.key}:${candidate.version}`)
    );
    if (ready.length < 2) {
      return unavailable(
        "CONTENT_UNAVAILABLE",
        "The reviewed Architecture & Design scenario path is not available yet.",
        ready.map(publicScenario)
      );
    }
    return {
      available: true,
      reason: "AVAILABLE",
      message: "Your role-aligned Architecture & Design path is ready.",
      requiredScenarioCount: 2,
      publishedScenarioCount: ready.length,
      scenarios: ready.map(publicScenario)
    };
  }
}

function unavailable(
  reason: Exclude<ArchitectureDesignEligibilityReason, "AVAILABLE">,
  message: string,
  scenarios: ArchitectureDesignScenarioLibraryEntry[] = []
): ArchitectureDesignEligibility {
  return {
    available: false,
    reason,
    message,
    requiredScenarioCount: 2,
    publishedScenarioCount: scenarios.length,
    scenarios
  };
}

function publicScenario(
  candidate: ArchitectureDesignScenarioRankingCandidate
): ArchitectureDesignScenarioLibraryEntry {
  return {
    key: candidate.key,
    version: candidate.version,
    title: candidate.title,
    difficulties: [...candidate.difficulties],
    topicKeys: [...candidate.topicKeys],
    dimensionKeys: [...candidate.dimensionKeys]
  };
}

function toSeniority(level: CandidateProfile["level"]) {
  if (level === "fresher" || level === "0-2") return "junior" as const;
  if (level === "3-5") return "mid" as const;
  if (level === "5-plus") return "senior" as const;
  return null;
}
