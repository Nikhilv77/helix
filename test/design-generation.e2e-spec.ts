import { INestApplication } from "@nestjs/common";
import { DesignSessionStatus, KnowledgeSourceType, ProjectStatus } from "@prisma/client";
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

describe("System design generation e2e", () => {
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

  it("generates and persists a completed design using retrieved knowledge references", async () => {
    const server = getHttpServer(httpServer);
    await seedEmbeddedKnowledge(server);
    const session = await seedGeneratableSession(prisma, DesignSessionStatus.READY_FOR_DESIGN);

    const response = await request(server)
      .post(`/api/v1/design-sessions/${session.id}/generate-design`)
      .expect(201);
    const data = getDataRecord(response.body);
    const design = getRecord(data.design);
    const sourceReferences = getArray(design.retrievedSourceReferences);

    expect(data.status).toBe(DesignSessionStatus.COMPLETED);
    expect(design.architectureSummary).toContain("notification architecture");
    expect(sourceReferences.length).toBeGreaterThan(0);
    expect(getRecord(sourceReferences[0]).documentTitle).toBe("Message Queue Reliability");

    const persistedSession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedSession.status).toBe(DesignSessionStatus.COMPLETED);
    expect(persistedSession.currentStep).toBeNull();
    expect(persistedSession.generatedDesign).not.toBeNull();
    expect(persistedSession.designGeneratedAt).toBeInstanceOf(Date);
    expect(persistedSession.completedAt).toBeInstanceOf(Date);

    const getResponse = await request(server)
      .get(`/api/v1/design-sessions/${session.id}/design`)
      .expect(200);
    expect(getRecord(getDataRecord(getResponse.body).design).architectureSummary).toContain(
      "notification architecture"
    );
  });

  it("rejects duplicate concurrent generation", async () => {
    const server = getHttpServer(httpServer);
    const session = await seedGeneratableSession(prisma, DesignSessionStatus.GENERATING, {
      currentStep: "design_generation"
    });

    const response = await request(server)
      .post(`/api/v1/design-sessions/${session.id}/generate-design`)
      .expect(409);

    expect(getErrorRecord(response.body).code).toBe("DESIGN_GENERATION_IN_PROGRESS");
  });

  it("allows retrying generation from a failed session", async () => {
    const server = getHttpServer(httpServer);
    await seedEmbeddedKnowledge(server);
    const session = await seedGeneratableSession(prisma, DesignSessionStatus.FAILED, {
      failureCode: "AI_PROVIDER_ERROR",
      failureMessage: "AI provider failed while generating the system design"
    });

    const response = await request(server)
      .post(`/api/v1/design-sessions/${session.id}/generate-design`)
      .expect(201);

    expect(getDataRecord(response.body).status).toBe(DesignSessionStatus.COMPLETED);
    const persistedSession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedSession.failureCode).toBeNull();
    expect(persistedSession.status).toBe(DesignSessionStatus.COMPLETED);
  });
});

describe("System design generation failure e2e", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let httpServer: Server | undefined;

  beforeAll(async () => {
    await applyMigrations();
    app = await createE2eApp({
      systemDesignerProvider: createFailingDesignProvider()
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

  it("moves the session to failed with safe failure details when AI generation fails", async () => {
    const session = await seedGeneratableSession(prisma, DesignSessionStatus.READY_FOR_DESIGN);

    const response = await request(getHttpServer(httpServer))
      .post(`/api/v1/design-sessions/${session.id}/generate-design`)
      .expect(503);

    expect(getErrorRecord(response.body).code).toBe("SERVICE_UNAVAILABLE");
    const persistedSession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedSession.status).toBe(DesignSessionStatus.FAILED);
    expect(persistedSession.currentStep).toBeNull();
    expect(persistedSession.failureCode).toBe("AI_PROVIDER_ERROR");
    expect(persistedSession.failureMessage).toBe(
      "AI provider failed while generating the system design"
    );
  });
});

async function seedEmbeddedKnowledge(server: Server): Promise<void> {
  await request(server)
    .post("/api/v1/knowledge/documents")
    .send({
      title: "Message Queue Reliability",
      sourceType: KnowledgeSourceType.MARKDOWN,
      sourceUrl: null,
      content: `# Message Queue Reliability

Message queues decouple producers from consumers for notification systems.

## Retries

Consumers should use idempotency keys, retry transient failures, and route exhausted messages to a dead-letter queue.`
    })
    .expect(201);

  await request(server).post("/api/v1/knowledge/embeddings/rebuild").expect(201);
}

async function seedGeneratableSession(
  prisma: PrismaService,
  status: DesignSessionStatus,
  overrides: {
    currentStep?: string;
    failureCode?: string;
    failureMessage?: string;
  } = {}
) {
  const project = await prisma.project.create({
    data: {
      name: "Notification Platform",
      status: ProjectStatus.ACTIVE
    }
  });

  return prisma.designSession.create({
    data: {
      projectId: project.id,
      title: "Notification system",
      problemStatement: "Design a scalable notification system with retries.",
      status,
      currentStep: overrides.currentStep,
      failureCode: overrides.failureCode,
      failureMessage: overrides.failureMessage,
      requirementAnalysis: {
        productSummary: "A scalable notification platform.",
        functionalRequirements: [
          {
            id: "FR-1",
            requirement: "Users can schedule notifications to recipients.",
            priority: "MUST"
          }
        ],
        nonFunctionalRequirements: [
          {
            id: "NFR-1",
            category: "Reliability",
            requirement: "Delivery retries must handle transient provider failures.",
            target: "Retry failed notifications"
          }
        ],
        assumptions: ["Notifications are sent through external providers."],
        scaleInputs: {
          expectedUsers: "1,000,000 monthly active users",
          requestRate: "24 requests per active user per day",
          storage: "10 KB per monthly active user",
          regions: null,
          availabilityTarget: null,
          latencyTarget: null,
          notes: []
        },
        constraints: [],
        missingInformation: [],
        clarificationQuestions: []
      },
      clarificationAnswers: [],
      requirementsAnalyzedAt: new Date(),
      capacityCalculation: {
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
      },
      capacityCalculatedAt: new Date()
    }
  });
}

function createFailingDesignProvider(): SystemDesignerAIProvider {
  return {
    generateStructured: <T>(request: GenerateStructuredRequest<T>): Promise<T> => {
      if (request.operation === "system_design.generation") {
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
