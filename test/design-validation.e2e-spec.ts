import { INestApplication } from "@nestjs/common";
import { DesignSessionStatus, ProjectStatus } from "@prisma/client";
import { Server } from "http";
import request from "supertest";
import { AiProviderException } from "../src/ai/ai-provider.exception";
import {
  GenerateStructuredRequest,
  SystemDesignerAIProvider
} from "../src/ai/interfaces/system-designer-ai-provider.interface";
import { isRecord } from "../src/common/utils/is-record";
import { PrismaService } from "../src/database/prisma.service";
import { applyMigrations, createE2eApp, resetDatabase } from "./e2e-app";

describe("Design validation e2e", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let httpServer: Server | undefined;

  beforeAll(async () => {
    await applyMigrations();
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    httpServer = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("validates, persists, reruns, and retrieves a completed design validation", async () => {
    const session = await seedCompletedDesignSession(prisma);

    const response = await request(getHttpServer(httpServer))
      .post(`/api/v1/design-sessions/${session.id}/validate-design`)
      .expect(201);
    const data = getDataRecord(response.body);
    const validation = getRecord(data.validation);

    expect(data.designSessionId).toBe(session.id);
    expect(typeof validation.overallScore).toBe("number");
    expect(getArray(validation.categoryScores)).toHaveLength(10);
    expect(getArray(validation.warnings).length).toBeGreaterThan(0);

    const persistedSession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedSession.designValidation).not.toBeNull();
    expect(persistedSession.designValidatedAt).toBeInstanceOf(Date);

    const rerunResponse = await request(getHttpServer(httpServer))
      .post(`/api/v1/design-sessions/${session.id}/validate-design`)
      .expect(201);
    expect(getRecord(getDataRecord(rerunResponse.body).validation).overallScore).toBe(
      validation.overallScore
    );

    const getResponse = await request(getHttpServer(httpServer))
      .get(`/api/v1/design-sessions/${session.id}/validation`)
      .expect(200);
    expect(getRecord(getDataRecord(getResponse.body).validation).overallScore).toBe(
      validation.overallScore
    );
  });

  it("rejects validation when no generated design exists", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Missing Design",
        status: ProjectStatus.ACTIVE
      }
    });
    const session = await prisma.designSession.create({
      data: {
        projectId: project.id,
        title: "Missing design",
        problemStatement: "Design a system.",
        status: DesignSessionStatus.READY_FOR_DESIGN
      }
    });

    const response = await request(getHttpServer(httpServer))
      .post(`/api/v1/design-sessions/${session.id}/validate-design`)
      .expect(409);

    expect(getErrorRecord(response.body).code).toBe("GENERATED_DESIGN_REQUIRED");
  });
});

describe("Design validation failure e2e", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let httpServer: Server | undefined;

  beforeAll(async () => {
    await applyMigrations();
    app = await createE2eApp({
      systemDesignerProvider: createFailingValidationProvider()
    });
    prisma = app.get(PrismaService);
    httpServer = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("does not persist validation when the AI review fails", async () => {
    const session = await seedCompletedDesignSession(prisma);

    const response = await request(getHttpServer(httpServer))
      .post(`/api/v1/design-sessions/${session.id}/validate-design`)
      .expect(503);

    expect(getErrorRecord(response.body).code).toBe("SERVICE_UNAVAILABLE");
    const persistedSession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedSession.designValidation).toBeNull();
    expect(persistedSession.designValidatedAt).toBeNull();
  });
});

async function seedCompletedDesignSession(prisma: PrismaService) {
  const project = await prisma.project.create({
    data: {
      name: "Validation Project",
      status: ProjectStatus.ACTIVE
    }
  });

  return prisma.designSession.create({
    data: {
      projectId: project.id,
      title: "Notification system",
      problemStatement: "Design a scalable notification system.",
      status: DesignSessionStatus.COMPLETED,
      requirementAnalysis: {
        productSummary: "A scalable notification platform.",
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
      },
      requirementsAnalyzedAt: new Date(),
      generatedDesign: {
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
      },
      designGeneratedAt: new Date(),
      completedAt: new Date()
    }
  });
}

function createFailingValidationProvider(): SystemDesignerAIProvider {
  return {
    generateStructured: <T>(request: GenerateStructuredRequest<T>): Promise<T> => {
      if (request.operation === "design_validation.review") {
        return Promise.reject(
          new AiProviderException({
            code: "AI_PROVIDER_ERROR",
            message: "Simulated provider internals",
            provider: "gemini",
            operation: request.operation,
            retryable: false
          })
        );
      }

      return Promise.reject(new Error("Unexpected operation"));
    }
  };
}

function getHttpServer(server: Server | undefined): Server {
  if (!server) {
    throw new Error("Expected HTTP server to be initialized");
  }

  return server;
}

function getDataRecord(body: unknown): Record<string, unknown> {
  const envelope = getRecord(body);
  return getRecord(envelope.data);
}

function getErrorRecord(body: unknown): Record<string, unknown> {
  const envelope = getRecord(body);
  return getRecord(envelope.error);
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected value to be an object");
  }

  return value;
}

function getArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected value to be an array");
  }

  return value;
}

