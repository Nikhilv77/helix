import { DesignSession, DesignSessionStatus } from "@prisma/client";
import { AiProviderException } from "../ai/ai-provider.exception";
import { AiService } from "../ai/ai.service";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { ArchitectureDiagram } from "./architecture-diagram.schema";
import { DesignSessionDiagramsService } from "./design-session-diagrams.service";
import { DesignSessionsRepository } from "./design-sessions.repository";
import { MermaidFlowchartValidator } from "./mermaid-flowchart.validator";
import { GeneratedSystemDesign } from "./system-design.schema";

describe("DesignSessionDiagramsService", () => {
  const generatedDesign: GeneratedSystemDesign = {
    architectureSummary: "Use APIs, queues, caches, and workers.",
    majorComponents: [
      {
        name: "API",
        responsibilities: ["Accept requests"]
      },
      {
        name: "Worker",
        responsibilities: ["Process queued jobs"]
      }
    ],
    apiRecommendations: [],
    databaseChoices: [
      {
        name: "PostgreSQL",
        recommendation: "Store transactional data in PostgreSQL.",
        reasoning: "Relational constraints fit the domain."
      }
    ],
    cachingStrategy: [
      {
        name: "Cache aside",
        recommendation: "Cache hot reads.",
        reasoning: "Reduces repeated database reads."
      }
    ],
    messagingAndAsyncProcessing: [
      {
        name: "Queue",
        recommendation: "Use a durable message queue.",
        reasoning: "Decouples producers and consumers."
      }
    ],
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
  };
  const session: DesignSession = {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "11111111-1111-4111-8111-111111111111",
    title: "Session",
    problemStatement: "Design a system",
    status: DesignSessionStatus.COMPLETED,
    currentStep: null,
    failureCode: null,
    failureMessage: null,
    requirementAnalysis: null,
    clarificationAnswers: null,
    requirementsAnalyzedAt: null,
    capacityCalculation: null,
    capacityCalculatedAt: null,
    generatedDesign,
    designGeneratedAt: new Date("2026-01-01T00:04:00.000Z"),
    architectureDiagram: null,
    diagramGeneratedAt: null,
    designValidation: null,
    designValidatedAt: null,
    startedAt: null,
    completedAt: new Date("2026-01-01T00:04:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
  const mermaid = `flowchart TD
  Client[Client Apps] --> Api[API Service]
  Api --> Cache[(Cache)]
  Api --> Db[(PostgreSQL)]
  Api --> Queue[Message Queue]
  Queue --> Worker[Worker Pool]`;

  function createService(
    repository: Partial<DesignSessionsRepository>,
    aiService: Partial<AiService> = {
      generateStructured: jest.fn().mockResolvedValue({ mermaid })
    }
  ): DesignSessionDiagramsService {
    return new DesignSessionDiagramsService(
      repository as DesignSessionsRepository,
      aiService as AiService,
      new MermaidFlowchartValidator()
    );
  }

  it("generates, validates, and saves a Mermaid flowchart", async () => {
    const diagramGeneratedAt = new Date("2026-01-01T00:05:00.000Z");
    const saveArchitectureDiagram = jest
      .fn<
        ReturnType<DesignSessionsRepository["saveArchitectureDiagram"]>,
        Parameters<DesignSessionsRepository["saveArchitectureDiagram"]>
      >()
      .mockResolvedValue({
        ...session,
        architectureDiagram: {
          type: "flowchart",
          direction: "TD",
          mermaid,
          generatedAt: diagramGeneratedAt.toISOString()
        },
        diagramGeneratedAt
      });
    const generateStructured = jest.fn().mockResolvedValue({ mermaid });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(session),
        saveArchitectureDiagram
      },
      { generateStructured }
    );

    await expect(service.generateDiagram(session.id)).resolves.toMatchObject({
      designSessionId: session.id,
      diagram: {
        type: "flowchart",
        direction: "TD",
        mermaid
      },
      generatedAt: diagramGeneratedAt
    });
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "architecture_diagram.generation",
        modelClass: "fast"
      })
    );
    expect(saveArchitectureDiagram).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({
        type: "flowchart",
        direction: "TD",
        mermaid
      })
    );
  });

  it("normalizes common safe Mermaid variants before validation", async () => {
    const rawMermaid = `flowchart TD
  CacheMeta[("Scrape & Rate Limit Cache (Redis)")] <--> Gateway[API Gateway]
  StreamEngine -- Raw 0-7d --> TSDB[(TSDB Cluster - NVMe)]`;
    const normalizedMermaid = `flowchart TD
  CacheMeta[(Scrape & Rate Limit Cache (Redis))] --> Gateway[API Gateway]
  StreamEngine -- Raw 0 to 7d --> TSDB[(TSDB Cluster - NVMe)]`;
    const saveArchitectureDiagram = jest.fn().mockResolvedValue({
      ...session,
      architectureDiagram: {
        type: "flowchart",
        direction: "TD",
        mermaid: normalizedMermaid,
        generatedAt: new Date("2026-01-01T00:06:00.000Z").toISOString()
      },
      diagramGeneratedAt: new Date("2026-01-01T00:06:00.000Z")
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(session),
        saveArchitectureDiagram
      },
      {
        generateStructured: jest.fn().mockResolvedValue({ mermaid: rawMermaid })
      }
    );

    await expect(service.generateDiagram(session.id)).resolves.toMatchObject({
      diagram: {
        mermaid: normalizedMermaid
      }
    });
    expect(saveArchitectureDiagram).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({ mermaid: normalizedMermaid })
    );
  });

  it("supports regenerating an existing diagram", async () => {
    const saveArchitectureDiagram = jest.fn().mockResolvedValue({
      ...session,
      architectureDiagram: {
        type: "flowchart",
        direction: "TD",
        mermaid,
        generatedAt: new Date("2026-01-01T00:06:00.000Z").toISOString()
      },
      diagramGeneratedAt: new Date("2026-01-01T00:06:00.000Z")
    });
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        architectureDiagram: {
          type: "flowchart",
          direction: "TD",
          mermaid: `flowchart TD
  Old[Old Diagram] --> Api[API]`,
          generatedAt: new Date("2026-01-01T00:05:00.000Z").toISOString()
        },
        diagramGeneratedAt: new Date("2026-01-01T00:05:00.000Z")
      }),
      saveArchitectureDiagram
    });

    await expect(service.generateDiagram(session.id)).resolves.toMatchObject({
      diagram: {
        mermaid
      }
    });
    expect(saveArchitectureDiagram).toHaveBeenCalledTimes(1);
  });

  it("rejects sessions without a generated design", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({
        ...session,
        generatedDesign: null
      })
    });

    await expect(service.generateDiagram(session.id)).rejects.toBeInstanceOf(
      ConflictErrorException
    );
  });

  it("falls back to a deterministic diagram when AI Mermaid is invalid", async () => {
    let savedDiagram: ArchitectureDiagram | undefined;
    const saveArchitectureDiagram = jest
      .fn<
        ReturnType<DesignSessionsRepository["saveArchitectureDiagram"]>,
        Parameters<DesignSessionsRepository["saveArchitectureDiagram"]>
      >()
      .mockImplementation((_id: string, diagram: ArchitectureDiagram) => {
        savedDiagram = diagram;
        return Promise.resolve({
          ...session,
          architectureDiagram: diagram,
          diagramGeneratedAt: new Date("2026-01-01T00:06:00.000Z")
        });
      });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(session),
        saveArchitectureDiagram
      },
      {
        generateStructured: jest.fn().mockResolvedValue({ mermaid: " " })
      }
    );

    await expect(service.generateDiagram(session.id)).resolves.toMatchObject({
      diagram: {
        type: "flowchart",
        direction: "TD"
      }
    });
    expect(savedDiagram?.mermaid).toContain("subgraph ClientLayer");
  });

  it("does not save invalid Mermaid output verbatim", async () => {
    let savedDiagram: ArchitectureDiagram | undefined;
    const saveArchitectureDiagram = jest
      .fn<
        ReturnType<DesignSessionsRepository["saveArchitectureDiagram"]>,
        Parameters<DesignSessionsRepository["saveArchitectureDiagram"]>
      >()
      .mockImplementation((_id: string, diagram: ArchitectureDiagram) => {
        savedDiagram = diagram;
        return Promise.resolve({
          ...session,
          architectureDiagram: diagram,
          diagramGeneratedAt: new Date("2026-01-01T00:06:00.000Z")
        });
      });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(session),
        saveArchitectureDiagram
      },
      {
        generateStructured: jest.fn().mockResolvedValue({
          mermaid: `sequenceDiagram
  Client->>Api: request`
        })
      }
    );

    const result = await service.generateDiagram(session.id);
    expect(result.diagram?.mermaid).toContain("flowchart TD");
    expect(savedDiagram?.mermaid).not.toContain("sequenceDiagram");
    expect(savedDiagram?.mermaid).toContain("subgraph DataLayer");
  });

  it("uses deterministic fallback when the AI provider fails", async () => {
    let savedDiagram: ArchitectureDiagram | undefined;
    const saveArchitectureDiagram = jest
      .fn<
        ReturnType<DesignSessionsRepository["saveArchitectureDiagram"]>,
        Parameters<DesignSessionsRepository["saveArchitectureDiagram"]>
      >()
      .mockImplementation((_id: string, diagram: ArchitectureDiagram) => {
        savedDiagram = diagram;
        return Promise.resolve({
          ...session,
          architectureDiagram: diagram,
          diagramGeneratedAt: new Date("2026-01-01T00:06:00.000Z")
        });
      });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(session),
        saveArchitectureDiagram
      },
      {
        generateStructured: jest.fn().mockRejectedValue(
          new AiProviderException({
            code: "AI_PROVIDER_ERROR",
            message: "Provider internals",
            provider: "gemini",
            operation: "architecture_diagram.generation",
            retryable: false
          })
        )
      }
    );

    await expect(service.generateDiagram(session.id)).resolves.toMatchObject({
      diagram: {
        type: "flowchart",
        direction: "TD"
      }
    });
    expect(savedDiagram?.mermaid).toContain("flowchart TD");
    expect(savedDiagram?.mermaid).toContain("subgraph ClientLayer");
  });
});
