import { DesignSession, DesignSessionStatus } from "@prisma/client";
import { AiProviderException } from "../ai/ai-provider.exception";
import { AiService } from "../ai/ai.service";
import { AppHttpError } from "../common/http-error";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { DesignSessionsRepository } from "./design-sessions.repository";
import { DesignValidationReview, PersistedDesignValidation } from "./design-validation.schema";
import { DesignValidationService } from "./design-validation.service";
import { DeterministicDesignValidatorService } from "./deterministic-design-validator.service";
import { RequirementAnalysis } from "./requirement-analysis.schema";
import { GeneratedSystemDesign } from "./system-design.schema";

describe("DesignValidationService", () => {
  const requirements: RequirementAnalysis = {
    productSummary: "A notification platform.",
    functionalRequirements: [
      {
        id: "FR-1",
        requirement: "Users can schedule notifications.",
        priority: "MUST"
      }
    ],
    nonFunctionalRequirements: [
      {
        id: "NFR-1",
        category: "Reliability",
        requirement: "Retries must handle transient provider failures.",
        target: null
      }
    ],
    assumptions: [],
    scaleInputs: {
      expectedUsers: "1,000,000 monthly active users",
      requestRate: "24 requests per active user per day",
      storage: "10 KB per user",
      regions: null,
      availabilityTarget: null,
      latencyTarget: null,
      notes: []
    },
    constraints: [],
    missingInformation: [],
    clarificationQuestions: []
  };
  const design = createDesign();
  const session: DesignSession = {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "11111111-1111-4111-8111-111111111111",
    title: "Session",
    problemStatement: "Design a system",
    status: DesignSessionStatus.COMPLETED,
    currentStep: null,
    failureCode: null,
    failureMessage: null,
    requirementAnalysis: requirements,
    clarificationAnswers: null,
    requirementsAnalyzedAt: new Date("2026-01-01T00:01:00.000Z"),
    capacityCalculation: null,
    capacityCalculatedAt: null,
    generatedDesign: design,
    designGeneratedAt: new Date("2026-01-01T00:02:00.000Z"),
    architectureDiagram: null,
    diagramGeneratedAt: null,
    designValidation: null,
    designValidatedAt: null,
    startedAt: null,
    completedAt: new Date("2026-01-01T00:02:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
  const aiReview = createReview(82);

  function createService(
    repository: Partial<DesignSessionsRepository>,
    aiService: Partial<AiService> = {
      generateStructured: jest.fn().mockResolvedValue(aiReview)
    }
  ): DesignValidationService {
    return new DesignValidationService(
      repository as DesignSessionsRepository,
      new DeterministicDesignValidatorService(),
      aiService as AiService
    );
  }

  it("validates and persists a merged design review", async () => {
    const designValidatedAt = new Date("2026-01-01T00:03:00.000Z");
    const saveDesignValidation = jest.fn().mockImplementation(
      (_id: string, validation: PersistedDesignValidation) =>
        Promise.resolve({
          ...session,
          designValidation: validation,
          designValidatedAt
        })
    );
    const generateStructured = jest.fn().mockResolvedValue(aiReview);
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(session),
        saveDesignValidation
      },
      { generateStructured }
    );

    const result = await service.validateDesign(session.id);

    expect(result.designSessionId).toBe(session.id);
    expect(result.validatedAt).toBe(designValidatedAt);
    expect(result.validation?.overallScore).toEqual(expect.any(Number));
    expect(result.validation?.aiReview).toEqual(aiReview);
    expect(result.validation?.deterministicReview.overallScore).toEqual(expect.any(Number));
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "design_validation.review",
        modelClass: "reasoning"
      })
    );
    expect(saveDesignValidation).toHaveBeenCalledWith(session.id, expect.any(Object));
  });

  it("supports rerunning validation by replacing the saved review", async () => {
    const existingValidation: PersistedDesignValidation = {
      ...createReview(50),
      deterministicReview: new DeterministicDesignValidatorService().validate({
        design,
        requirements
      }),
      aiReview: createReview(50),
      validatedAt: new Date("2026-01-01T00:02:30.000Z").toISOString()
    };
    const saveDesignValidation = jest.fn().mockImplementation(
      (_id: string, validation: PersistedDesignValidation) =>
        Promise.resolve({
          ...session,
          designValidation: validation,
          designValidatedAt: new Date("2026-01-01T00:04:00.000Z")
        })
    );
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        designValidation: existingValidation,
        designValidatedAt: new Date("2026-01-01T00:02:30.000Z")
      }),
      saveDesignValidation
    });

    await expect(service.validateDesign(session.id)).resolves.toMatchObject({
      validation: {
        aiReview
      }
    });
    expect(saveDesignValidation).toHaveBeenCalledTimes(1);
  });

  it("rejects validation when no generated design exists", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        generatedDesign: null
      })
    });

    await expect(service.validateDesign(session.id)).rejects.toBeInstanceOf(ConflictErrorException);
  });

  it("maps AI provider failures safely without saving", async () => {
    const saveDesignValidation = jest.fn();
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(session),
        saveDesignValidation
      },
      {
        generateStructured: jest.fn().mockRejectedValue(
          new AiProviderException({
            code: "AI_PROVIDER_ERROR",
            message: "Provider internals",
            provider: "gemini",
            operation: "design_validation.review",
            retryable: false
          })
        )
      }
    );

    await expect(service.validateDesign(session.id)).rejects.toBeInstanceOf(AppHttpError);
    expect(saveDesignValidation).not.toHaveBeenCalled();
  });

  it("returns persisted validation", async () => {
    const validation: PersistedDesignValidation = {
      ...createReview(82),
      deterministicReview: new DeterministicDesignValidatorService().validate({
        design,
        requirements
      }),
      aiReview,
      validatedAt: new Date("2026-01-01T00:03:00.000Z").toISOString()
    };
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        designValidation: validation,
        designValidatedAt: new Date("2026-01-01T00:03:00.000Z")
      })
    });

    await expect(service.getValidation(session.id)).resolves.toMatchObject({
      designSessionId: session.id,
      validation,
      validatedAt: new Date("2026-01-01T00:03:00.000Z")
    });
  });
});

function createReview(score: number): DesignValidationReview {
  const categories = [
    "functionalRequirements",
    "scalability",
    "availability",
    "reliability",
    "dataConsistency",
    "security",
    "observability",
    "disasterRecovery",
    "costAwareness",
    "operationalComplexity"
  ] as const;

  return {
    overallScore: score,
    categoryScores: categories.map((category) => ({
      category,
      score,
      summary: `${category} scored ${score}.`
    })),
    criticalIssues: [],
    warnings: [
      {
        category: "costAwareness",
        message: "Cost controls need more detail.",
        recommendation: "Add cost drivers and optimization levers."
      }
    ],
    missingAreas: [],
    improvementSuggestions: [],
    strengths: [
      {
        category: "reliability",
        message: "Retry handling is included.",
        recommendation: "Keep retry behavior measurable."
      }
    ],
    unresolvedAssumptions: ["Provider limits are unknown."]
  };
}

function createDesign(): GeneratedSystemDesign {
  return {
    architectureSummary:
      "Use APIs, queues, retries, transactions, observability, backups, restore plans, and cost controls.",
    majorComponents: [
      {
        name: "Notification API",
        responsibilities: ["Accept requests"]
      }
    ],
    apiRecommendations: [
      {
        name: "Create notification",
        recommendation: "Expose a command API.",
        reasoning: "Producers need a stable contract."
      }
    ],
    databaseChoices: [
      {
        name: "PostgreSQL",
        recommendation: "Use transactions for delivery state.",
        reasoning: "Consistency matters."
      }
    ],
    cachingStrategy: [],
    messagingAndAsyncProcessing: [],
    storageStrategy: [],
    scalabilityApproach: [
      {
        name: "Workers",
        description: "Scale workers horizontally."
      }
    ],
    reliabilityAndFailureHandling: [
      {
        name: "Retries",
        description: "Use idempotency, retries, failover, backups, RPO, and RTO."
      }
    ],
    security: [
      {
        name: "Authorization",
        description: "Authorize every tenant request."
      }
    ],
    observability: [
      {
        name: "Metrics",
        description: "Track queue lag and provider failures."
      }
    ],
    deploymentApproach: [
      {
        name: "Multi-region",
        description: "Deploy redundant services."
      }
    ],
    technologyChoices: [
      {
        category: "Messaging",
        choice: "Queue",
        reasoning: "Cost-aware scaling smooths bursts.",
        alternativesConsidered: ["Synchronous calls"]
      }
    ],
    assumptions: ["Provider limits are known."],
    tradeOffs: [
      {
        name: "Async delivery",
        description: "Improves reliability but adds operational complexity and cost."
      }
    ],
    risks: [
      {
        name: "Provider outage",
        description: "Requires disaster recovery planning."
      }
    ],
    retrievedSourceReferences: []
  };
}
