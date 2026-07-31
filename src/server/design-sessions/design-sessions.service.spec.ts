import {
  DesignSession,
  DesignSessionStatus,
  KnowledgeSourceType,
  Project,
  ProjectStatus
} from "@prisma/client";
import { AiProviderException } from "../ai/ai-provider.exception";
import { AiService } from "../ai/ai.service";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { AppHttpError } from "../common/http-error";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { ProjectsService } from "../projects/projects.service";
import {
  RetrievalSearchRequest,
  RetrievalSearchResponse,
  RetrievalService
} from "../retrieval/retrieval.service";
import { CapacityCalculatorOutput } from "../tools/capacity-calculator/capacity-calculator.schema";
import { ToolsService } from "../tools/tools.service";
import { DesignSessionsRepository } from "./design-sessions.repository";
import { DesignSessionsService } from "./design-sessions.service";
import { RequirementAnalysis } from "./requirement-analysis.schema";
import { GeneratedSystemDesign } from "./system-design.schema";

describe("DesignSessionsService", () => {
  const project: Project = {
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: "user_123",
    name: "Project",
    description: null,
    status: ProjectStatus.ACTIVE,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
  const session: DesignSession = {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: project.id,
    title: "Session",
    problemStatement: "Design a system",
    status: DesignSessionStatus.DRAFT,
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
  const analysisNeedingClarification: RequirementAnalysis = {
    productSummary: "A collaborative document editor for teams.",
    functionalRequirements: [
      {
        id: "FR-1",
        requirement: "Users can edit shared documents together.",
        priority: "MUST"
      }
    ],
    nonFunctionalRequirements: [
      {
        id: "NFR-1",
        category: "Reliability",
        requirement: "The system should preserve edits during transient failures.",
        target: null
      }
    ],
    assumptions: ["Users authenticate through a future identity layer."],
    scaleInputs: {
      expectedUsers: null,
      requestRate: null,
      storage: null,
      regions: null,
      availabilityTarget: null,
      latencyTarget: null,
      notes: []
    },
    constraints: ["No native mobile offline mode was specified."],
    missingInformation: ["Expected concurrent editors is unknown."],
    clarificationQuestions: [
      {
        id: "CQ-1",
        question: "How many concurrent editors should a document support?",
        reason: "Concurrency affects collaboration and storage design."
      }
    ]
  };
  const completeAnalysis: RequirementAnalysis = {
    ...analysisNeedingClarification,
    scaleInputs: {
      expectedUsers: "1,000,000 monthly active users",
      requestRate: "24 requests per active user per day",
      storage: "10 KB per monthly active user",
      regions: null,
      availabilityTarget: null,
      latencyTarget: null,
      notes: []
    },
    missingInformation: [],
    clarificationQuestions: []
  };
  const capacityCalculation: CapacityCalculatorOutput = {
    toolName: "capacity-calculator",
    inputs: {
      monthlyActiveUsers: 1_000_000,
      dailyActiveUserPercentage: 25,
      requestsPerActiveUserPerDay: 24,
      readWriteRatio: "80:20",
      averagePayloadSizeBytes: 2048,
      peakTrafficMultiplier: 3,
      dataCreatedPerUserBytes: 10 * 1024,
      retentionPeriodDays: 365
    },
    results: {
      dailyActiveUsers: { raw: 250_000, display: "250,000 users", unit: "users" },
      averageRequestsPerSecond: { raw: 69.4444444444, display: "69.44 rps", unit: "rps" },
      peakRequestsPerSecond: { raw: 208.3333333333, display: "208 rps", unit: "rps" },
      readQps: { raw: 166.6666666666, display: "167 qps", unit: "qps" },
      writeQps: { raw: 41.6666666666, display: "41.67 qps", unit: "qps" },
      dailyBandwidth: { raw: 12_288_000_000, display: "11.44 GB", unit: "bytes" },
      monthlyBandwidth: { raw: 368_640_000_000, display: "343.32 GB", unit: "bytes" },
      monthlyStorageGrowth: { raw: 10_240_000_000, display: "9.54 GB", unit: "bytes" },
      retainedStorageEstimate: {
        raw: 124_586_666_666.66667,
        display: "116.03 GB",
        unit: "bytes"
      }
    },
    assumptions: ["A month is treated as 30 days for bandwidth and storage estimates."],
    warnings: []
  };
  const generatedDesign: GeneratedSystemDesign = {
    architectureSummary: "Use a modular collaborative editing architecture.",
    majorComponents: [
      {
        name: "API Gateway",
        responsibilities: ["Route client traffic", "Apply request limits"]
      }
    ],
    apiRecommendations: [
      {
        name: "Document APIs",
        recommendation: "Expose REST APIs for document metadata and WebSocket APIs for edits.",
        reasoning: "Separate metadata operations from realtime collaboration."
      }
    ],
    databaseChoices: [
      {
        name: "Primary database",
        recommendation: "Use PostgreSQL for document metadata.",
        reasoning: "Relational constraints are useful for ownership and sharing."
      }
    ],
    cachingStrategy: [
      {
        name: "Cache aside",
        recommendation: "Cache frequently opened document metadata.",
        reasoning: "Read-heavy metadata can avoid repeated database reads."
      }
    ],
    messagingAndAsyncProcessing: [
      {
        name: "Change events",
        recommendation: "Use a message queue for asynchronous fan-out and indexing.",
        reasoning: "Queues decouple write paths from downstream processing."
      }
    ],
    storageStrategy: [
      {
        name: "Snapshots",
        recommendation: "Store compact document snapshots and append edit operations.",
        reasoning: "Snapshots bound replay time while preserving history."
      }
    ],
    scalabilityApproach: [
      {
        name: "Horizontal collaboration workers",
        description: "Partition active documents across realtime workers."
      }
    ],
    reliabilityAndFailureHandling: [
      {
        name: "Idempotent operations",
        description: "Use operation IDs so retries do not duplicate edits."
      }
    ],
    security: [
      {
        name: "Authorization",
        description: "Check document permissions on every read and edit operation."
      }
    ],
    observability: [
      {
        name: "Collaboration metrics",
        description: "Track edit latency, connection counts, and queue lag."
      }
    ],
    deploymentApproach: [
      {
        name: "Containerized services",
        description: "Deploy stateless APIs and workers separately."
      }
    ],
    technologyChoices: [
      {
        category: "Database",
        choice: "PostgreSQL",
        reasoning: "Strong transactional default for metadata.",
        alternativesConsidered: ["MongoDB"]
      }
    ],
    assumptions: ["The design does not include offline editing."],
    tradeOffs: [
      {
        name: "Realtime complexity",
        description: "Operational transform or CRDT logic increases implementation complexity."
      }
    ],
    risks: [
      {
        name: "Hot documents",
        description: "Very popular documents may overload a single realtime partition."
      }
    ],
    retrievedSourceReferences: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentTitle: "Caching Strategies",
        sourceUrl: null,
        similarity: 0.91,
        usedFor: "Caching recommendation"
      }
    ]
  };

  function createService(
    repository: Partial<DesignSessionsRepository>,
    projectsService: Partial<ProjectsService> = {
      getExistingProject: jest.fn().mockResolvedValue(project)
    },
    aiService: Partial<AiService> = {
      generateStructured: jest.fn().mockResolvedValue(completeAnalysis)
    },
    toolsService: Partial<ToolsService> = {
      calculateCapacity: jest.fn().mockResolvedValue(capacityCalculation)
    },
    retrievalService: Partial<RetrievalService> = {
      search: jest.fn().mockResolvedValue({
        query: "query",
        results: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentTitle: "Caching Strategies",
            sourceType: "MARKDOWN",
            sourceUrl: null,
            content: "Cache aside reduces repeated database reads.",
            similarity: 0.91,
            metadata: { headingPath: ["Caching"] }
          }
        ],
        meta: {
          topK: 5,
          minSimilarity: 0.1,
          returned: 1,
          scanned: 1
        }
      })
    }
  ): DesignSessionsService {
    const repositoryWithDefaults = {
      findById: jest.fn().mockResolvedValue(session),
      ...repository
    };

    return new DesignSessionsService(
      repositoryWithDefaults as DesignSessionsRepository,
      projectsService as ProjectsService,
      aiService as AiService,
      toolsService as ToolsService,
      retrievalService as RetrievalService
    );
  }

  it("creates a design session for an active project", async () => {
    const create = jest.fn().mockResolvedValue(session);
    const service = createService({ create });

    await expect(
      service.createDesignSession(project.id, {
        title: "Session",
        problemStatement: "Design a system"
      })
    ).resolves.toBe(session);
    expect(create).toHaveBeenCalledWith(project.id, {
      title: "Session",
      problemStatement: "Design a system"
    });
  });

  it("rejects new sessions for archived projects", async () => {
    const service = createService(
      {},
      {
        getExistingProject: jest.fn().mockResolvedValue({
          ...project,
          status: ProjectStatus.ARCHIVED
        })
      }
    );

    await expect(
      service.createDesignSession(project.id, {
        title: "Session",
        problemStatement: "Design a system"
      })
    ).rejects.toBeInstanceOf(ConflictErrorException);
  });

  it("rejects editing non-draft sessions", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.COMPLETED
      })
    });

    await expect(
      service.updateDesignSession(session.id, { title: "New title" })
    ).rejects.toBeInstanceOf(ConflictErrorException);
  });

  it("deletes failed sessions", async () => {
    const failedSession = { ...session, status: DesignSessionStatus.FAILED };
    const deleteSession = jest.fn().mockResolvedValue(failedSession);
    const service = createService({
      findById: jest.fn().mockResolvedValue(failedSession),
      delete: deleteSession
    });

    await expect(service.deleteDesignSession(session.id)).resolves.toBe(failedSession);
    expect(deleteSession).toHaveBeenCalledWith(session.id);
  });

  it("throws not found when a design session does not exist", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue(null)
    });

    await expect(service.getDesignSession(session.id)).rejects.toBeInstanceOf(
      NotFoundErrorException
    );
  });

  it("analyzes draft requirements and moves to requirements pending when clarification is needed", async () => {
    const analyzedAt = new Date("2026-01-01T00:01:00.000Z");
    const beginRequirementAnalysis = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.GENERATING,
      currentStep: "requirements_analysis"
    });
    const saveRequirementAnalysis = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.REQUIREMENTS_PENDING,
      requirementAnalysis: analysisNeedingClarification,
      requirementsAnalyzedAt: analyzedAt
    });
    const generateStructured = jest.fn().mockResolvedValue(analysisNeedingClarification);
    const service = createService(
      {
        beginRequirementAnalysis,
        saveRequirementAnalysis
      },
      undefined,
      { generateStructured }
    );

    await expect(service.analyzeRequirements(session.id)).resolves.toMatchObject({
      designSessionId: session.id,
      status: DesignSessionStatus.REQUIREMENTS_PENDING,
      analysis: analysisNeedingClarification,
      clarificationAnswers: [],
      analyzedAt
    });
    expect(beginRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      [DesignSessionStatus.DRAFT, DesignSessionStatus.FAILED],
      undefined
    );
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "requirements.analysis",
        modelClass: "reasoning"
      })
    );
    expect(saveRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      analysisNeedingClarification,
      DesignSessionStatus.REQUIREMENTS_PENDING
    );
  });

  it("retries requirement analysis after a failed requirements run", async () => {
    const failedSession = {
      ...session,
      status: DesignSessionStatus.FAILED,
      failureCode: "AI_PROVIDER_ERROR",
      failureMessage: "AI provider failed while analyzing requirements"
    };
    const beginRequirementAnalysis = jest.fn().mockResolvedValue({
      ...failedSession,
      status: DesignSessionStatus.GENERATING,
      currentStep: "requirements_analysis",
      failureCode: null,
      failureMessage: null
    });
    const saveRequirementAnalysis = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.READY_FOR_DESIGN,
      requirementAnalysis: completeAnalysis,
      requirementsAnalyzedAt: new Date("2026-01-01T00:01:00.000Z")
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(failedSession),
        beginRequirementAnalysis,
        saveRequirementAnalysis
      },
      undefined,
      { generateStructured: jest.fn().mockResolvedValue(completeAnalysis) }
    );

    await expect(service.analyzeRequirements(session.id)).resolves.toMatchObject({
      status: DesignSessionStatus.READY_FOR_DESIGN,
      analysis: completeAnalysis
    });
    expect(beginRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      [DesignSessionStatus.DRAFT, DesignSessionStatus.FAILED],
      undefined
    );
  });

  it("does not rerun requirement analysis for failed sessions that already have requirements", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.FAILED,
        requirementAnalysis: completeAnalysis
      })
    });

    await expect(service.analyzeRequirements(session.id)).rejects.toBeInstanceOf(
      ConflictErrorException
    );
  });

  it("moves analyzed sessions directly to ready for design when no clarification is needed", async () => {
    const beginRequirementAnalysis = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.GENERATING,
      currentStep: "requirements_analysis"
    });
    const saveRequirementAnalysis = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.READY_FOR_DESIGN,
      requirementAnalysis: completeAnalysis,
      requirementsAnalyzedAt: new Date("2026-01-01T00:01:00.000Z")
    });
    const service = createService(
      {
        beginRequirementAnalysis,
        saveRequirementAnalysis
      },
      undefined,
      { generateStructured: jest.fn().mockResolvedValue(completeAnalysis) }
    );

    await expect(service.analyzeRequirements(session.id)).resolves.toMatchObject({
      status: DesignSessionStatus.READY_FOR_DESIGN,
      analysis: completeAnalysis
    });
    expect(saveRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      completeAnalysis,
      DesignSessionStatus.READY_FOR_DESIGN
    );
  });

  it("moves sessions to ready when missing information has no answerable clarification questions", async () => {
    const analysisWithMissingContextOnly: RequirementAnalysis = {
      ...completeAnalysis,
      missingInformation: ["Exact third-party integrations can be finalized later."],
      clarificationQuestions: []
    };
    const saveRequirementAnalysis = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.READY_FOR_DESIGN,
      requirementAnalysis: analysisWithMissingContextOnly,
      requirementsAnalyzedAt: new Date("2026-01-01T00:01:00.000Z")
    });
    const service = createService(
      {
        beginRequirementAnalysis: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.GENERATING,
          currentStep: "requirements_analysis"
        }),
        saveRequirementAnalysis
      },
      undefined,
      { generateStructured: jest.fn().mockResolvedValue(analysisWithMissingContextOnly) }
    );

    await expect(service.analyzeRequirements(session.id)).resolves.toMatchObject({
      status: DesignSessionStatus.READY_FOR_DESIGN,
      analysis: analysisWithMissingContextOnly
    });
    expect(saveRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      analysisWithMissingContextOnly,
      DesignSessionStatus.READY_FOR_DESIGN
    );
  });

  it("limits saved clarification questions to three", async () => {
    const verboseAnalysis: RequirementAnalysis = {
      ...analysisNeedingClarification,
      missingInformation: [],
      clarificationQuestions: Array.from({ length: 5 }, (_value, index) => ({
        id: `CQ-${index + 1}`,
        question: `Clarification ${index + 1}?`,
        reason: "This affects the design.",
        options: ["Use the default", "Optimize for scale"]
      }))
    };
    let savedAnalysis: RequirementAnalysis | undefined;
    const saveRequirementAnalysis = jest
      .fn<
        ReturnType<DesignSessionsRepository["saveRequirementAnalysis"]>,
        Parameters<DesignSessionsRepository["saveRequirementAnalysis"]>
      >()
      .mockImplementation((_id: string, analysis: RequirementAnalysis) => {
        savedAnalysis = analysis;
        return Promise.resolve({
          ...session,
          status: DesignSessionStatus.REQUIREMENTS_PENDING,
          requirementAnalysis: {
            ...verboseAnalysis,
            clarificationQuestions: verboseAnalysis.clarificationQuestions.slice(0, 3)
          },
          requirementsAnalyzedAt: new Date("2026-01-01T00:01:00.000Z")
        });
      });
    const service = createService(
      {
        beginRequirementAnalysis: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.GENERATING,
          currentStep: "requirements_analysis"
        }),
        saveRequirementAnalysis
      },
      undefined,
      { generateStructured: jest.fn().mockResolvedValue(verboseAnalysis) }
    );

    const result = await service.analyzeRequirements(session.id);

    expect(result.analysis?.clarificationQuestions.map((question) => question.id)).toEqual([
      "CQ-1",
      "CQ-2",
      "CQ-3"
    ]);
    expect(saveRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      expect.any(Object),
      DesignSessionStatus.REQUIREMENTS_PENDING
    );
    expect(savedAnalysis?.clarificationQuestions).toHaveLength(3);
  });

  it("rejects concurrent requirement analysis", async () => {
    const service = createService({
      beginRequirementAnalysis: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.GENERATING,
        currentStep: "requirements_analysis"
      })
    });

    await expect(service.analyzeRequirements(session.id)).rejects.toBeInstanceOf(
      ConflictErrorException
    );
  });

  it("saves clarification answers and reruns requirement analysis", async () => {
    const pendingSession = {
      ...session,
      status: DesignSessionStatus.REQUIREMENTS_PENDING,
      requirementAnalysis: analysisNeedingClarification
    };
    const saveRequirementAnalysis = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.READY_FOR_DESIGN,
      requirementAnalysis: completeAnalysis,
      requirementsAnalyzedAt: new Date("2026-01-01T00:02:00.000Z")
    });
    const beginRequirementAnalysis = jest.fn().mockResolvedValue({
      ...pendingSession,
      status: DesignSessionStatus.GENERATING,
      currentStep: "requirements_analysis"
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(pendingSession),
        beginRequirementAnalysis,
        saveRequirementAnalysis
      },
      undefined,
      { generateStructured: jest.fn().mockResolvedValue(completeAnalysis) }
    );

    await expect(
      service.submitClarifications(session.id, {
        answers: [
          {
            questionId: "CQ-1",
            answer: "Support 100 concurrent editors per document."
          }
        ]
      })
    ).resolves.toMatchObject({
      status: DesignSessionStatus.READY_FOR_DESIGN,
      analysis: completeAnalysis
    });
    expect(beginRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      DesignSessionStatus.REQUIREMENTS_PENDING,
      [
        expect.objectContaining({
          questionId: "CQ-1",
          question: "How many concurrent editors should a document support?",
          answer: "Support 100 concurrent editors per document."
        })
      ]
    );
  });

  it("ignores stale clarification answers for questions that are no longer pending", async () => {
    const beginRequirementAnalysis = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.GENERATING,
      currentStep: "requirements_analysis"
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.REQUIREMENTS_PENDING,
          requirementAnalysis: analysisNeedingClarification
        }),
        beginRequirementAnalysis,
        saveRequirementAnalysis: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.READY_FOR_DESIGN,
          requirementAnalysis: completeAnalysis,
          requirementsAnalyzedAt: new Date("2026-01-01T00:02:00.000Z")
        })
      },
      undefined,
      { generateStructured: jest.fn().mockResolvedValue(completeAnalysis) }
    );

    await expect(
      service.submitClarifications(session.id, {
        answers: [
          { questionId: "CQ-1", answer: "Support 100 concurrent editors per document." },
          { questionId: "CQ-404", answer: "Stale answer." }
        ]
      })
    ).resolves.toMatchObject({ status: DesignSessionStatus.READY_FOR_DESIGN });
    expect(beginRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      DesignSessionStatus.REQUIREMENTS_PENDING,
      [
        expect.objectContaining({
          questionId: "CQ-1",
          answer: "Support 100 concurrent editors per document."
        })
      ]
    );
  });

  it("rejects clarification submission when no current questions are answered", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.REQUIREMENTS_PENDING,
        requirementAnalysis: analysisNeedingClarification
      })
    });

    await expect(
      service.submitClarifications(session.id, {
        answers: [{ questionId: "CQ-404", answer: "Unknown answer." }]
      })
    ).rejects.toThrow("Clarification answers are required for every pending question");
  });

  it("stores safe failure details when AI analysis fails", async () => {
    const saveRequirementAnalysisFailure = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.FAILED,
      failureCode: "AI_PROVIDER_ERROR",
      failureMessage: "AI provider failed while analyzing requirements"
    });
    const service = createService(
      {
        beginRequirementAnalysis: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.GENERATING,
          currentStep: "requirements_analysis"
        }),
        saveRequirementAnalysisFailure
      },
      undefined,
      {
        generateStructured: jest.fn().mockRejectedValue(
          new AiProviderException({
            code: "AI_PROVIDER_ERROR",
            message: "Provider failed with sensitive internals",
            provider: "gemini",
            operation: "requirements.analysis",
            retryable: false
          })
        )
      }
    );

    try {
      await service.analyzeRequirements(session.id);
      throw new Error("Expected requirement analysis to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppHttpError);
      expect(error).toMatchObject({ code: "REQUIREMENT_ANALYSIS_FAILED" });
    }
    expect(saveRequirementAnalysisFailure).toHaveBeenCalledWith(
      session.id,
      "AI_PROVIDER_ERROR",
      "AI provider failed while analyzing requirements"
    );
  });

  it("uses deterministic requirements when quick-create analysis fails", async () => {
    const quickCreateSession = {
      ...session,
      problemStatement: [
        "Metrics ingestion, time-series storage, alerting, dashboards, and retention.",
        "",
        "Helix quick design setup:",
        "- Starting point: Monitoring system",
        "- Expected scale: Small",
        "- Design priority: Reliability",
        "- Product domain: Enterprise",
        "- Requirement behavior: do not ask clarification questions in this quick-create path; choose reasonable defaults and list them as assumptions."
      ].join("\n")
    };
    const analyzedAt = new Date("2026-01-01T00:01:00.000Z");
    let savedAnalysis: RequirementAnalysis | undefined;
    const saveRequirementAnalysis = jest
      .fn<
        ReturnType<DesignSessionsRepository["saveRequirementAnalysis"]>,
        Parameters<DesignSessionsRepository["saveRequirementAnalysis"]>
      >()
      .mockImplementation((_id: string, analysis: RequirementAnalysis) => {
        savedAnalysis = analysis;
        return Promise.resolve({
          ...quickCreateSession,
          status: DesignSessionStatus.READY_FOR_DESIGN,
          requirementAnalysis: analysis,
          requirementsAnalyzedAt: analyzedAt
        });
      });
    const saveRequirementAnalysisFailure = jest.fn();
    const service = createService(
      {
        beginRequirementAnalysis: jest.fn().mockResolvedValue({
          ...quickCreateSession,
          status: DesignSessionStatus.GENERATING,
          currentStep: "requirements_analysis"
        }),
        saveRequirementAnalysis,
        saveRequirementAnalysisFailure
      },
      undefined,
      {
        generateStructured: jest.fn().mockRejectedValue(
          new AiProviderException({
            code: "AI_PROVIDER_ERROR",
            message: "Provider failed",
            provider: "gemini",
            operation: "requirements.analysis",
            retryable: true
          })
        )
      }
    );

    await expect(service.analyzeRequirements(session.id)).resolves.toMatchObject({
      status: DesignSessionStatus.READY_FOR_DESIGN,
      analyzedAt
    });
    expect(savedAnalysis?.productSummary).toContain("Metrics ingestion");
    expect(savedAnalysis?.clarificationQuestions).toEqual([]);
    expect(savedAnalysis?.scaleInputs.expectedUsers).toBe("10,000 monthly active users");
    expect(saveRequirementAnalysis).toHaveBeenCalledWith(
      session.id,
      expect.any(Object),
      DesignSessionStatus.READY_FOR_DESIGN
    );
    expect(saveRequirementAnalysisFailure).not.toHaveBeenCalled();
  });

  it("calculates and persists capacity for sessions ready for design", async () => {
    const capacityCalculatedAt = new Date("2026-01-01T00:03:00.000Z");
    const calculateCapacity = jest.fn().mockResolvedValue(capacityCalculation);
    const saveCapacityCalculation = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.READY_FOR_DESIGN,
      requirementAnalysis: completeAnalysis,
      capacityCalculation,
      capacityCalculatedAt,
      failureCode: null,
      failureMessage: null
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.READY_FOR_DESIGN,
          requirementAnalysis: completeAnalysis
        }),
        saveCapacityCalculation
      },
      undefined,
      undefined,
      { calculateCapacity }
    );

    await expect(
      service.calculateCapacity(session.id, {
        dailyActiveUserPercentage: 25
      })
    ).resolves.toMatchObject({
      designSessionId: session.id,
      status: DesignSessionStatus.READY_FOR_DESIGN,
      calculation: capacityCalculation,
      calculatedAt: capacityCalculatedAt
    });
    expect(calculateCapacity).toHaveBeenCalledWith({
      monthlyActiveUsers: 1_000_000,
      requestsPerActiveUserPerDay: 24,
      dataCreatedPerUserBytes: 10 * 1024,
      dailyActiveUserPercentage: 25
    });
    expect(saveCapacityCalculation).toHaveBeenCalledWith(session.id, capacityCalculation);
  });

  it("uses baseline capacity defaults when scale inputs are choice labels instead of numbers", async () => {
    const calculateCapacity = jest.fn().mockResolvedValue(capacityCalculation);
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.READY_FOR_DESIGN,
          requirementAnalysis: {
            ...completeAnalysis,
            scaleInputs: {
              ...completeAnalysis.scaleInputs,
              expectedUsers: "Medium (internal operational and engineering staff)",
              requestRate: "Medium ingestion rate suitable for a growing product",
              storage: "90 days of metrics with tiered storage and aggregation"
            }
          }
        }),
        saveCapacityCalculation: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.READY_FOR_DESIGN,
          capacityCalculation,
          capacityCalculatedAt: new Date("2026-01-01T00:03:00.000Z")
        })
      },
      undefined,
      undefined,
      { calculateCapacity }
    );

    await expect(service.calculateCapacity(session.id, {})).resolves.toMatchObject({
      status: DesignSessionStatus.READY_FOR_DESIGN
    });
    expect(calculateCapacity).toHaveBeenCalledWith({
      monthlyActiveUsers: 100_000,
      retentionPeriodDays: 90
    });
  });

  it("rejects capacity calculation before requirements are ready for design", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.REQUIREMENTS_PENDING
      })
    });

    await expect(service.calculateCapacity(session.id, {})).rejects.toBeInstanceOf(
      ConflictErrorException
    );
  });

  it("returns persisted capacity calculation", async () => {
    const capacityCalculatedAt = new Date("2026-01-01T00:03:00.000Z");
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.READY_FOR_DESIGN,
        capacityCalculation,
        capacityCalculatedAt
      })
    });

    await expect(service.getCapacity(session.id)).resolves.toMatchObject({
      designSessionId: session.id,
      status: DesignSessionStatus.READY_FOR_DESIGN,
      calculation: capacityCalculation,
      calculatedAt: capacityCalculatedAt
    });
  });

  it("generates and persists a system design using retrieval context", async () => {
    const designGeneratedAt = new Date("2026-01-01T00:04:00.000Z");
    const beginDesignGeneration = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.GENERATING,
      currentStep: "design_generation",
      requirementAnalysis: completeAnalysis,
      capacityCalculation
    });
    const saveGeneratedDesign = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.COMPLETED,
      requirementAnalysis: completeAnalysis,
      capacityCalculation,
      generatedDesign,
      designGeneratedAt,
      completedAt: designGeneratedAt
    });
    const generateStructured = jest.fn().mockResolvedValue(generatedDesign);
    const retrievalResponse: RetrievalSearchResponse = {
      query: "query",
      results: [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          documentTitle: "Caching Strategies",
          sourceType: KnowledgeSourceType.MARKDOWN,
          sourceUrl: null,
          content: "Cache aside reduces repeated database reads.",
          similarity: 0.91,
          metadata: { headingPath: ["Caching"] }
        }
      ],
      meta: {
        topK: 5,
        minSimilarity: 0.1,
        returned: 1,
        scanned: 1
      }
    };
    const search = jest
      .fn<Promise<RetrievalSearchResponse>, [RetrievalSearchRequest]>()
      .mockResolvedValue(retrievalResponse);
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.READY_FOR_DESIGN,
          requirementAnalysis: completeAnalysis,
          capacityCalculation
        }),
        beginDesignGeneration,
        saveGeneratedDesign
      },
      undefined,
      { generateStructured },
      undefined,
      { search }
    );

    await expect(service.generateDesign(session.id)).resolves.toMatchObject({
      designSessionId: session.id,
      status: DesignSessionStatus.COMPLETED,
      design: generatedDesign,
      generatedAt: designGeneratedAt
    });
    expect(beginDesignGeneration).toHaveBeenCalledWith(session.id);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]?.[0].topK).toBe(5);
    expect(search.mock.calls[0]?.[0].query).toContain("A collaborative document editor for teams.");
    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "system_design.generation",
        modelClass: "reasoning"
      })
    );
    expect(saveGeneratedDesign).toHaveBeenCalledWith(session.id, generatedDesign);
  });

  it("prevents duplicate concurrent design generation", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.GENERATING,
        currentStep: "design_generation"
      })
    });

    await expect(service.generateDesign(session.id)).rejects.toBeInstanceOf(ConflictErrorException);
  });

  it("rejects design generation before the session is ready", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.REQUIREMENTS_PENDING
      })
    });

    await expect(service.generateDesign(session.id)).rejects.toBeInstanceOf(ConflictErrorException);
  });

  it("allows retrying design generation from a failed session", async () => {
    const beginDesignGeneration = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.GENERATING,
      currentStep: "design_generation",
      requirementAnalysis: completeAnalysis,
      capacityCalculation
    });
    const saveGeneratedDesign = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.COMPLETED,
      requirementAnalysis: completeAnalysis,
      capacityCalculation,
      generatedDesign,
      designGeneratedAt: new Date("2026-01-01T00:04:00.000Z")
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.FAILED,
          failureCode: "AI_PROVIDER_ERROR",
          failureMessage: "AI provider failed while generating the system design",
          requirementAnalysis: completeAnalysis,
          capacityCalculation
        }),
        beginDesignGeneration,
        saveGeneratedDesign
      },
      undefined,
      { generateStructured: jest.fn().mockResolvedValue(generatedDesign) }
    );

    await expect(service.generateDesign(session.id)).resolves.toMatchObject({
      status: DesignSessionStatus.COMPLETED
    });
    expect(beginDesignGeneration).toHaveBeenCalledWith(session.id);
  });

  it("stores safe failure details when design generation fails", async () => {
    const saveDesignGenerationFailure = jest.fn().mockResolvedValue({
      ...session,
      status: DesignSessionStatus.FAILED,
      failureCode: "AI_PROVIDER_ERROR",
      failureMessage: "AI provider failed while generating the system design"
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.READY_FOR_DESIGN,
          requirementAnalysis: completeAnalysis,
          capacityCalculation
        }),
        beginDesignGeneration: jest.fn().mockResolvedValue({
          ...session,
          status: DesignSessionStatus.GENERATING,
          currentStep: "design_generation",
          requirementAnalysis: completeAnalysis,
          capacityCalculation
        }),
        saveDesignGenerationFailure
      },
      undefined,
      {
        generateStructured: jest.fn().mockRejectedValue(
          new AiProviderException({
            code: "AI_PROVIDER_ERROR",
            message: "Provider leaked internals",
            provider: "gemini",
            operation: "system_design.generation",
            retryable: false
          })
        )
      }
    );

    try {
      await service.generateDesign(session.id);
      throw new Error("Expected system design generation to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppHttpError);
      expect(error).toMatchObject({ code: "DESIGN_GENERATION_FAILED" });
    }
    expect(saveDesignGenerationFailure).toHaveBeenCalledWith(
      session.id,
      "AI_PROVIDER_ERROR",
      "AI provider failed while generating the system design"
    );
  });

  it("uses deterministic design when quick-create design generation fails", async () => {
    const quickCreateSession = {
      ...session,
      problemStatement: [
        "Metrics ingestion, time-series storage, alerting, dashboards, and retention.",
        "",
        "Helix quick design setup:",
        "- Starting point: Monitoring system",
        "- Expected scale: Medium",
        "- Design priority: Reliability",
        "- Product domain: Enterprise",
        "- Requirement behavior: do not ask clarification questions in this quick-create path; choose reasonable defaults and list them as assumptions."
      ].join("\n")
    };
    const designGeneratedAt = new Date("2026-01-01T00:04:00.000Z");
    let savedDesign: GeneratedSystemDesign | undefined;
    const saveGeneratedDesign = jest
      .fn<
        ReturnType<DesignSessionsRepository["saveGeneratedDesign"]>,
        Parameters<DesignSessionsRepository["saveGeneratedDesign"]>
      >()
      .mockImplementation((_id: string, design: GeneratedSystemDesign) => {
        savedDesign = design;
        return Promise.resolve({
          ...quickCreateSession,
          status: DesignSessionStatus.COMPLETED,
          generatedDesign: design,
          designGeneratedAt,
          completedAt: designGeneratedAt
        });
      });
    const saveDesignGenerationFailure = jest.fn();
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue({
          ...quickCreateSession,
          status: DesignSessionStatus.READY_FOR_DESIGN,
          requirementAnalysis: completeAnalysis,
          capacityCalculation
        }),
        beginDesignGeneration: jest.fn().mockResolvedValue({
          ...quickCreateSession,
          status: DesignSessionStatus.GENERATING,
          currentStep: "design_generation",
          requirementAnalysis: completeAnalysis,
          capacityCalculation
        }),
        saveGeneratedDesign,
        saveDesignGenerationFailure
      },
      undefined,
      {
        generateStructured: jest.fn().mockRejectedValue(
          new AiProviderException({
            code: "AI_PROVIDER_ERROR",
            message: "Provider failed",
            provider: "gemini",
            operation: "system_design.generation",
            retryable: true
          })
        )
      }
    );

    await expect(service.generateDesign(session.id)).resolves.toMatchObject({
      status: DesignSessionStatus.COMPLETED,
      generatedAt: designGeneratedAt
    });
    expect(savedDesign?.architectureSummary).toContain("deterministic defaults");
    expect(savedDesign?.majorComponents.map((component) => component.name)).toContain(
      "Ingestion Gateway"
    );
    expect(savedDesign?.retrievedSourceReferences).toEqual([]);
    expect(saveGeneratedDesign).toHaveBeenCalledWith(session.id, expect.any(Object));
    expect(saveDesignGenerationFailure).not.toHaveBeenCalled();
  });

  it("returns a persisted generated design", async () => {
    const designGeneratedAt = new Date("2026-01-01T00:04:00.000Z");
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        status: DesignSessionStatus.COMPLETED,
        generatedDesign,
        designGeneratedAt
      })
    });

    await expect(service.getDesign(session.id)).resolves.toMatchObject({
      designSessionId: session.id,
      status: DesignSessionStatus.COMPLETED,
      design: generatedDesign,
      generatedAt: designGeneratedAt
    });
  });
});
