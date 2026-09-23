import { describe, expect, it } from "vitest";
import { AI_ML_ARCHITECTURE_SCENARIOS } from "./ai-ml-scenarios";
import { auditArchitectureDesignContent } from "./content-release-audit";
import {
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  buildArchitectureDesignScenarioRankingCatalogue
} from "./scenario-ranking-catalogue";
import { buildArchitectureDesignPublicationPayloads } from "../server/content-publisher";

describe("AI/ML Architecture & Design scenarios", () => {
  it("has complete, release-eligible AI/ML-only content", () => {
    expect(AI_ML_ARCHITECTURE_SCENARIOS.map(({ caseKey }) => caseKey)).toEqual([
      "retrieval-augmented-support-assistant",
      "real-time-fraud-model-platform"
    ]);

    for (const artifact of AI_ML_ARCHITECTURE_SCENARIOS) {
      expect(artifact.scenario.roles).toEqual(["ai-ml"]);
      expect(artifact.questionBlock.questions).toHaveLength(4);
      expect(auditArchitectureDesignContent(artifact)).toMatchObject({
        automatedValid: true,
        releaseEligible: true,
        reviewStatus: "approved",
        schemaIssues: [],
        identityIssues: [],
        coherenceIssues: [],
        coverageIssues: [],
        publicSafetyIssues: []
      });
      expect(
        ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.find(({ key }) => key === artifact.caseKey)
      ).toMatchObject({ publicationStatus: "published", roles: ["ai-ml"] });
    }
    expect(
      buildArchitectureDesignPublicationPayloads(
        AI_ML_ARCHITECTURE_SCENARIOS,
        ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE
      )
    ).toHaveLength(2);
  });

  it("publishes through the existing private/public snapshot pipeline", () => {
    const catalogue = buildArchitectureDesignScenarioRankingCatalogue(AI_ML_ARCHITECTURE_SCENARIOS);
    const payloads = buildArchitectureDesignPublicationPayloads(
      AI_ML_ARCHITECTURE_SCENARIOS,
      catalogue
    );

    expect(catalogue.map(({ publicationStatus }) => publicationStatus)).toEqual([
      "published",
      "published"
    ]);
    expect(payloads).toHaveLength(2);
    for (const payload of payloads) {
      expect(payload.privateQuestionSnapshot.questions).toHaveLength(4);
      expect(payload.publicQuestionSnapshot.questions).toHaveLength(4);
      const publicJson = JSON.stringify(payload.publicQuestionSnapshot);
      expect(publicJson).not.toContain("referenceAnswer");
      expect(publicJson).not.toContain("rubric");
      expect(publicJson).not.toContain("correctChoiceIndex");
    }
  });
});
