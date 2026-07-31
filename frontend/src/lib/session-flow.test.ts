import { describe, expect, it } from "vitest";
import {
  canAnalyzeRequirements,
  canCalculateCapacity,
  canGenerateDesign,
  canGenerateDiagram,
  canSubmitClarifications,
  canValidateDesign,
  getSessionProgressIndex
} from "./session-flow";
import type { DesignSession } from "./types";

function createSession(overrides: Partial<DesignSession> = {}): DesignSession {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "11111111-1111-4111-8111-111111111111",
    title: "Session",
    problemStatement: "Design notifications",
    status: "DRAFT",
    currentStep: null,
    failureCode: null,
    failureMessage: null,
    requirementAnalysis: null,
    clarificationAnswers: null,
    requirementsAnalyzedAt: null,
    capacityCalculation: null,
    capacityCalculatedAt: null,
    generatedDesign: null,
    designGeneratedAt: null,
    architectureDiagram: null,
    diagramGeneratedAt: null,
    designValidation: null,
    designValidatedAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("session flow", () => {
  it("allows only valid actions for a draft session", () => {
    const session = createSession();

    expect(canAnalyzeRequirements(session)).toBe(true);
    expect(canSubmitClarifications(session)).toBe(false);
    expect(canCalculateCapacity(session)).toBe(false);
    expect(canGenerateDesign(session)).toBe(false);
  });

  it("allows failed requirement analysis to be retried before requirements exist", () => {
    expect(
      canAnalyzeRequirements(
        createSession({
          status: "FAILED",
          failureCode: "AI_PROVIDER_ERROR",
          failureMessage: "AI provider failed while analyzing requirements"
        })
      )
    ).toBe(true);
  });

  it("allows capacity and design only after the expected prerequisites", () => {
    const readySession = createSession({
      status: "READY_FOR_DESIGN",
      requirementAnalysis: {
        productSummary: "Notifications",
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        assumptions: [],
        scaleInputs: {
          expectedUsers: null,
          requestRate: null,
          storage: null,
          regions: null,
          availabilityTarget: null,
          latencyTarget: null,
          notes: []
        },
        constraints: [],
        missingInformation: [],
        clarificationQuestions: []
      }
    });

    expect(canCalculateCapacity(readySession)).toBe(true);
    expect(canGenerateDesign(readySession)).toBe(false);
    expect(
      canGenerateDesign({
        ...readySession,
        capacityCalculation: {
          toolName: "capacity-calculator",
          inputs: {},
          results: {
            dailyActiveUsers: { raw: 10, display: "10", unit: "users" },
            averageRequestsPerSecond: { raw: 1, display: "1", unit: "rps" },
            peakRequestsPerSecond: { raw: 2, display: "2", unit: "rps" },
            readQps: { raw: 1, display: "1", unit: "qps" },
            writeQps: { raw: 1, display: "1", unit: "qps" },
            dailyBandwidth: { raw: 1, display: "1", unit: "MB" },
            monthlyBandwidth: { raw: 30, display: "30", unit: "MB" },
            monthlyStorageGrowth: { raw: 1, display: "1", unit: "GB" },
            retainedStorageEstimate: { raw: 12, display: "12", unit: "GB" }
          },
          assumptions: [],
          warnings: []
        }
      })
    ).toBe(true);
  });

  it("tracks progress through diagram and validation", () => {
    const completedSession = createSession({
      status: "COMPLETED",
      generatedDesign: {
        architectureSummary: "Use queues.",
        majorComponents: [],
        apiRecommendations: [],
        databaseChoices: [],
        cachingStrategy: [],
        messagingAndAsyncProcessing: [],
        storageStrategy: [],
        scalabilityApproach: [],
        reliabilityAndFailureHandling: [],
        security: [],
        observability: [],
        deploymentApproach: [],
        technologyChoices: [],
        assumptions: [],
        tradeOffs: [],
        risks: [],
        retrievedSourceReferences: []
      },
      architectureDiagram: {
        type: "flowchart",
        direction: "TD",
        mermaid: "flowchart TD\n  A --> B",
        generatedAt: "2026-01-01T00:00:00.000Z"
      },
      designValidation: {
        overallScore: 85,
        categoryScores: [],
        criticalIssues: [],
        warnings: [],
        missingAreas: [],
        improvementSuggestions: [],
        strengths: [],
        unresolvedAssumptions: [],
        validatedAt: "2026-01-01T00:00:00.000Z"
      }
    });

    expect(canGenerateDiagram(completedSession)).toBe(true);
    expect(canValidateDesign(completedSession)).toBe(true);
    expect(getSessionProgressIndex(completedSession)).toBe(7);
  });
});
