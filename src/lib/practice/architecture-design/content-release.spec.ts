import { describe, expect, it } from "vitest";
import { buildArchitectureDesignPublicationPayloads } from "@/server/architecture-design/content-publisher";
import { auditArchitectureDesignContent } from "./content-release-audit";
import { architectureDesignDimensionSchema } from "./contracts";
import { toPublicArchitectureDesignQuestionBlock } from "./question-contracts";
import { architectureDesignReviewArtifactSchema } from "./review-artifact-contracts";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "./reviewed-scenarios";
import {
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  buildArchitectureDesignScenarioRankingCatalogue
} from "./scenario-ranking-catalogue";

describe("Architecture & Design content release", () => {
  it("provides two approved four-question scenarios with passing release audits", () => {
    expect(ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.map(({ caseKey }) => caseKey)).toEqual([
      "multi-tenant-webhook-delivery",
      "high-volume-notification-platform"
    ]);

    for (const artifact of ARCHITECTURE_DESIGN_REVIEW_CANDIDATES) {
      const audit = auditArchitectureDesignContent(artifact);
      const rubricDimensions = new Set(
        artifact.questionBlock.questions.flatMap((question) =>
          question.rubric.flatMap(({ dimensionKeys }) => dimensionKeys)
        )
      );

      expect(artifact.questionBlock.questions).toHaveLength(4);
      expect(artifact.questionBlock.questions.every(({ hints }) => hints.length === 3)).toBe(true);
      expect(artifact.questionBlock.questions.every(({ format }) => !isExecutable(format))).toBe(
        true
      );
      expect(rubricDimensions).toEqual(new Set(architectureDesignDimensionSchema.options));
      expect(audit).toMatchObject({
        automatedValid: true,
        releaseEligible: true,
        reviewStatus: "approved",
        schemaIssues: [],
        identityIssues: [],
        coherenceIssues: [],
        coverageIssues: [],
        publicSafetyIssues: []
      });
    }
  });

  it("publishes catalogue entries after human approval", () => {
    expect(ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE).toHaveLength(2);
    expect(
      ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.every(
        ({ publicationStatus }) => publicationStatus === "published"
      )
    ).toBe(true);
    expect(
      ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.every(
        ({ roles, dimensionKeys }) =>
          roles.includes("backend") &&
          roles.includes("fullstack") &&
          dimensionKeys.length === architectureDesignDimensionSchema.options.length
      )
    ).toBe(true);
  });

  it("refuses publication without human review attestation", () => {
    const candidates = candidateArtifacts();
    expect(() =>
      buildArchitectureDesignPublicationPayloads(
        candidates,
        buildArchitectureDesignScenarioRankingCatalogue(candidates)
      )
    ).toThrow("not release eligible");
  });

  it("builds stable private/public repository payloads after explicit approval", () => {
    const approved = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES;
    const catalogue = buildArchitectureDesignScenarioRankingCatalogue(approved);
    const first = buildArchitectureDesignPublicationPayloads(approved, catalogue);
    const second = buildArchitectureDesignPublicationPayloads(structuredClone(approved), catalogue);

    expect(first).toHaveLength(2);
    expect(first.map(({ contentFingerprint }) => contentFingerprint)).toEqual(
      second.map(({ contentFingerprint }) => contentFingerprint)
    );
    expect(first.every((payload) => Object.isFrozen(payload))).toBe(true);
    for (const payload of first) {
      const publicKeys = allKeys(payload.publicQuestionSnapshot);
      expect(publicKeys).not.toEqual(
        expect.arrayContaining([
          "hints",
          "referenceAnswer",
          "correctChoiceIndex",
          "rubric",
          "commonMistakes",
          "interviewerFollowUps"
        ])
      );
      expect(payload.contentFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  it("detects stage drift and missing dimension coverage", () => {
    const drifted = structuredClone(ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!);
    drifted.scenario.stages[1]!.artifactKey = "different-contract-artifact";
    expect(auditArchitectureDesignContent(drifted).coherenceIssues).toContain(
      "question 2 does not use its declared artifact"
    );

    const uncovered = structuredClone(ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[1]!);
    uncovered.questionBlock.questions[0]!.rubric[1]!.dimensionKeys = ["requirements-framing"];
    expect(auditArchitectureDesignContent(uncovered).coverageIssues).toContain(
      "uncovered Architecture dimension: capacity-estimation"
    );
  });

  it("rejects executable capability fields and preserves the public snapshot audit", () => {
    const changed = structuredClone(ARCHITECTURE_DESIGN_REVIEW_CANDIDATES[0]!) as unknown as Record<
      string,
      unknown
    >;
    const block = changed.questionBlock as { questions: Array<Record<string, unknown>> };
    block.questions[0]!.runnerContract = { runtime: "nodejs" };
    expect(auditArchitectureDesignContent(changed)).toMatchObject({
      automatedValid: false,
      releaseEligible: false,
      reviewStatus: "invalid"
    });

    for (const artifact of ARCHITECTURE_DESIGN_REVIEW_CANDIDATES) {
      expect(() => toPublicArchitectureDesignQuestionBlock(artifact.questionBlock)).not.toThrow();
    }
  });
});

function candidateArtifacts() {
  return ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.map((artifact) =>
    architectureDesignReviewArtifactSchema.parse({
      ...structuredClone(artifact),
      humanReview: {
        status: "candidate",
        reviewerId: null,
        reviewedAt: null,
        notes: ["Test-only candidate content proves the publisher still enforces human approval."]
      }
    })
  );
}

function isExecutable(format: string): boolean {
  return format === "debug-repair" || format === "micro-implementation";
}

function allKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)]);
}
