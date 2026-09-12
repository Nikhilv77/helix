import { describe, expect, it } from "vitest";
import { buildArchitectureDesignPublicationPayloads } from "@/features/practice/architecture-design/server/content-publisher";
import { auditArchitectureDesignContent } from "./content-release-audit";
import { architectureDesignDimensionSchema } from "./contracts";
import { toPublicArchitectureDesignQuestionBlock } from "./question-contracts";
import { architectureDesignReviewArtifactSchema } from "./review-artifact-contracts";
import { ARCHITECTURE_DESIGN_REVIEW_CANDIDATES } from "./reviewed-scenarios";
import { ARCHITECTURE_DESIGN_PROPOSED_SCENARIO_BRIEFS } from "./scenario-briefs";
import {
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  buildArchitectureDesignScenarioRankingCatalogue
} from "./scenario-ranking-catalogue";

describe("Architecture & Design content release", () => {
  it("provides six approved four-question scenarios with passing release audits", () => {
    expect(ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.map(({ caseKey }) => caseKey)).toEqual([
      "multi-tenant-webhook-delivery",
      "high-volume-notification-platform",
      "marketplace-checkout-inventory",
      "collaborative-document-editing",
      "global-media-processing",
      "search-autocomplete-platform"
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

  it("keeps approved artifacts published and incomplete briefs draft-only", () => {
    expect(ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE).toHaveLength(6);
    expect(
      ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.filter(
        ({ publicationStatus }) => publicationStatus === "published"
      ).map(({ key }) => key)
    ).toEqual([
      "multi-tenant-webhook-delivery",
      "high-volume-notification-platform",
      "marketplace-checkout-inventory",
      "collaborative-document-editing",
      "global-media-processing",
      "search-autocomplete-platform"
    ]);
    expect(
      ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.filter(
        ({ publicationStatus }) => publicationStatus === "draft"
      ).map(({ key }) => key)
    ).toEqual(ARCHITECTURE_DESIGN_PROPOSED_SCENARIO_BRIEFS.map(({ key }) => key));
    expect(
      ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.every(
        ({ roles, dimensionKeys, architectureFamily }) =>
          roles.includes("backend") &&
          roles.includes("fullstack") &&
          dimensionKeys.length === architectureDesignDimensionSchema.options.length &&
          architectureFamily.length > 0
      )
    ).toBe(true);
    expect(ARCHITECTURE_DESIGN_PROPOSED_SCENARIO_BRIEFS.every(isDeeplyFrozen)).toBe(true);
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

    expect(first).toHaveLength(6);
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

  it("covers the collaborative path's critical realtime and authorization cases", () => {
    const collaborative = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.find(
      ({ caseKey }) => caseKey === "collaborative-document-editing"
    )!;
    const content = JSON.stringify(collaborative).toLowerCase();

    expect(content).toMatch(/offline.{0,180}(revok|access)|revok.{0,180}offline/);
    expect(content).toMatch(/mixed.{0,80}(client|protocol).{0,80}version/);
    expect(content).toMatch(/slow client/);
    expect(content).toMatch(/hot document/);
    expect(content).toMatch(/fenced|ownership epoch/);
  });

  it("covers the media path's object security, lineage, deletion, and replay cases", () => {
    const media = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.find(
      ({ caseKey }) => caseKey === "global-media-processing"
    )!;
    const content = JSON.stringify(media).toLowerCase();

    expect(content).toMatch(/short-lived.{0,120}(upload|permission)|signed multipart/);
    expect(content).toMatch(/server-owned.{0,100}(object|namespace|key)/);
    expect(content).toMatch(/derivative.{0,160}(lineage|transformation version)/);
    expect(content).toMatch(/deletion.{0,200}(cdn|derivative|backup)/);
    expect(content).toMatch(/duplicate.{0,160}(processing|delivery|job)/);
  });

  it("covers search authorization, stale writes, pagination, deletion, and reindex rollback", () => {
    const search = ARCHITECTURE_DESIGN_REVIEW_CANDIDATES.find(
      ({ caseKey }) => caseKey === "search-autocomplete-platform"
    )!;
    const content = JSON.stringify(search).toLowerCase();

    expect(content).toMatch(/authoriz.{0,180}(leak|scope|filter)/);
    expect(content).toMatch(/stale|older.{0,100}(event|version)/);
    expect(content).toMatch(/search-after|signed cursor/);
    expect(content).toMatch(/deletion.{0,240}(cache|index|replica|backup)/);
    expect(content).toMatch(/reindex.{0,240}(rollback|alias|reversible)/);
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

function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen);
}
