import {
  NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE,
  APPLIED_ENGINEERING_REVIEW_CANDIDATES,
  type AppliedEngineeringIncidentRankingCandidate
} from "@/features/practice/applied-engineering/domain";
import type { CandidateProfile } from "@/lib/shared/types";

export type AppliedEngineeringEligibilityReason =
  | "AVAILABLE"
  | "UNSUPPORTED_ROLE"
  | "LEVEL_REQUIRED"
  | "RUNNER_UNAVAILABLE"
  | "CONTENT_UNAVAILABLE";

export type AppliedEngineeringStack = {
  language: "javascript";
  runtime: "nodejs";
  runtimeVersion: "22 LTS";
};

export type AppliedEngineeringIncidentLibraryEntry = {
  key: string;
  version: number;
  title: string;
  difficulties: AppliedEngineeringIncidentRankingCandidate["difficulties"];
  topicKeys: string[];
  productionSignalKeys: AppliedEngineeringIncidentRankingCandidate["productionSignalKeys"];
  expectedMinutes: number;
  questions: Array<{ order: number; title: string; format: string }>;
};

export type AppliedEngineeringEligibility = {
  available: boolean;
  reason: AppliedEngineeringEligibilityReason;
  message: string;
  stack: AppliedEngineeringStack;
  requiredIncidentCount: number;
  publishedIncidentCount: number;
  incidents: AppliedEngineeringIncidentLibraryEntry[];
};

export type AppliedEngineeringPublicationIdentity = { key: string; version: number };

export type AppliedEngineeringPublicationReader = {
  published(
    candidates: readonly AppliedEngineeringPublicationIdentity[]
  ): Promise<readonly AppliedEngineeringPublicationIdentity[]>;
};

type EligibilityProfile = Pick<CandidateProfile, "targetRole" | "level">;

type EligibilityDependencies = {
  publications: AppliedEngineeringPublicationReader;
  runner: { supportsStack(stack: AppliedEngineeringStack): boolean };
  catalogue?: readonly AppliedEngineeringIncidentRankingCandidate[];
};

/** Fails closed until two owner-approved artifacts also exist as published database versions. */
export class AppliedEngineeringEligibilityService {
  private readonly catalogue: readonly AppliedEngineeringIncidentRankingCandidate[];

  constructor(private readonly dependencies: EligibilityDependencies) {
    this.catalogue =
      dependencies.catalogue ?? NODEJS_APPLIED_ENGINEERING_INCIDENT_RANKING_CATALOGUE;
  }

  async forProfile(profile: EligibilityProfile): Promise<AppliedEngineeringEligibility> {
    const stack = {
      language: "javascript",
      runtime: "nodejs",
      runtimeVersion: "22 LTS"
    } as const;
    if (profile.targetRole !== "backend" && profile.targetRole !== "fullstack") {
      return unavailable(
        "UNSUPPORTED_ROLE",
        "Applied Engineering is currently available for backend and full-stack Node.js paths.",
        stack
      );
    }
    if (!profile.level) {
      return unavailable(
        "LEVEL_REQUIRED",
        "Choose your experience level before starting Applied Engineering practice.",
        stack
      );
    }
    if (!this.dependencies.runner.supportsStack(stack)) {
      return unavailable(
        "RUNNER_UNAVAILABLE",
        "The pinned Node.js practice runner is unavailable right now.",
        stack
      );
    }

    const candidates = this.catalogue.filter(
      (candidate) =>
        candidate.publicationStatus === "published" &&
        candidate.roles.includes(profile.targetRole as "backend" | "fullstack") &&
        candidate.language === stack.language &&
        candidate.runtime === stack.runtime &&
        candidate.runtimeVersion === stack.runtimeVersion
    );
    if (candidates.length < 2) {
      return unavailable(
        "CONTENT_UNAVAILABLE",
        "The reviewed Node.js Applied Engineering incident path is not available yet.",
        stack
      );
    }

    const published = await this.dependencies.publications.published(
      candidates.map(({ key, version }) => ({ key, version }))
    );
    const identities = new Set(published.map((item) => `${item.key}:${item.version}`));
    const publishedCandidates = candidates.filter((candidate) =>
      identities.has(`${candidate.key}:${candidate.version}`)
    );
    if (publishedCandidates.length < 2) {
      return unavailable(
        "CONTENT_UNAVAILABLE",
        "The reviewed Node.js Applied Engineering incident path is not available yet.",
        stack,
        publishedCandidates.map(publicIncident)
      );
    }

    return {
      available: true,
      reason: "AVAILABLE",
      message: "Your JavaScript and Node.js 22 Applied Engineering path is ready.",
      stack,
      requiredIncidentCount: 2,
      publishedIncidentCount: publishedCandidates.length,
      incidents: publishedCandidates.map(publicIncident)
    };
  }
}

function unavailable(
  reason: Exclude<AppliedEngineeringEligibilityReason, "AVAILABLE">,
  message: string,
  stack: AppliedEngineeringStack,
  incidents: AppliedEngineeringIncidentLibraryEntry[] = []
): AppliedEngineeringEligibility {
  return {
    available: false,
    reason,
    message,
    stack,
    requiredIncidentCount: 2,
    publishedIncidentCount: incidents.length,
    incidents
  };
}

function publicIncident(
  candidate: AppliedEngineeringIncidentRankingCandidate
): AppliedEngineeringIncidentLibraryEntry {
  const reviewed = APPLIED_ENGINEERING_REVIEW_CANDIDATES.find(
    (artifact) => artifact.caseKey === candidate.key
  );
  return {
    key: candidate.key,
    version: candidate.version,
    title: candidate.title,
    difficulties: [...candidate.difficulties],
    topicKeys: [...candidate.topicKeys],
    productionSignalKeys: [...candidate.productionSignalKeys],
    expectedMinutes: reviewed?.incident.expectedMinutes ?? 45,
    questions:
      reviewed?.incident.stages.map(({ order, title, format }) => ({ order, title, format })) ?? []
  };
}
