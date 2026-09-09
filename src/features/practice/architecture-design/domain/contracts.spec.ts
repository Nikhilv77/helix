import { describe, expect, it } from "vitest";
import {
  ARCHITECTURE_DESIGN_API_BASE,
  ARCHITECTURE_DESIGN_KEY,
  ARCHITECTURE_DESIGN_ROUTE_BASE,
  ARCHITECTURE_DESIGN_STAGES,
  ARCHITECTURE_DESIGN_V1_SCOPE,
  architectureDesignArtifactKindSchema,
  architectureDesignDimensionSchema,
  architectureDesignQuestionFormatSchema,
  architectureDesignWorkKind
} from "./contracts";

describe("Architecture & Design foundation contracts", () => {
  it("uses the preparation-area identity as the canonical Practice identity", () => {
    expect(ARCHITECTURE_DESIGN_KEY).toBe("architecture-design");
    expect(ARCHITECTURE_DESIGN_ROUTE_BASE).toBe("/practice/architecture-design");
    expect(ARCHITECTURE_DESIGN_API_BASE).toBe("/api/practice/architecture-design");
  });

  it("freezes one ordered four-stage system-design MVP arc", () => {
    expect(ARCHITECTURE_DESIGN_STAGES).toHaveLength(4);
    expect(ARCHITECTURE_DESIGN_STAGES.map(({ order }) => order)).toEqual([1, 2, 3, 4]);
    expect(new Set(ARCHITECTURE_DESIGN_STAGES.map(({ key }) => key)).size).toBe(4);
  });

  it("covers every stable Architecture dimension in the stage arc", () => {
    const covered = new Set(
      ARCHITECTURE_DESIGN_STAGES.flatMap(({ dimensionKeys }) => dimensionKeys)
    );
    expect(covered).toEqual(new Set(architectureDesignDimensionSchema.options));
  });

  it("keeps version 1 non-executable and compatible with the shared artifact surface", () => {
    expect(architectureDesignQuestionFormatSchema.options).toEqual([
      "mcq",
      "written",
      "artifact-diagnosis",
      "production-decision"
    ]);
    expect(architectureDesignArtifactKindSchema.options).toEqual([
      "scenario",
      "metrics",
      "config",
      "trace",
      "logs"
    ]);
    expect(ARCHITECTURE_DESIGN_V1_SCOPE.requiresRunner).toBe(false);
    expect(ARCHITECTURE_DESIGN_V1_SCOPE.supportsDiagramEditor).toBe(false);
  });

  it("maps all launch formats to an existing durable response control", () => {
    expect(architectureDesignWorkKind("mcq")).toBe("choice");
    expect(architectureDesignWorkKind("written")).toBe("text");
    expect(architectureDesignWorkKind("artifact-diagnosis")).toBe("text");
    expect(architectureDesignWorkKind("production-decision")).toBe("text");
  });

  it("limits the MVP to two reviewed four-question backend/full-stack scenarios", () => {
    expect(ARCHITECTURE_DESIGN_V1_SCOPE.roles).toEqual(["backend", "fullstack"]);
    expect(ARCHITECTURE_DESIGN_V1_SCOPE.scenarioCount).toBe(2);
    expect(ARCHITECTURE_DESIGN_V1_SCOPE.questionsPerScenario).toBe(4);
    expect(ARCHITECTURE_DESIGN_V1_SCOPE.assessmentPromptCount).toBe(5);
  });
});
