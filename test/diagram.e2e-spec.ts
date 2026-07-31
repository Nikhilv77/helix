import { INestApplication } from "@nestjs/common";
import { DesignSessionStatus, ProjectStatus } from "@prisma/client";
import { Server } from "http";
import request from "supertest";
import { isRecord } from "../src/common/utils/is-record";
import { PrismaService } from "../src/database/prisma.service";
import { applyMigrations, createE2eApp, resetDatabase } from "./e2e-app";

describe("Architecture diagram generation e2e", () => {
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

  it("generates, persists, regenerates, and retrieves a Mermaid flowchart", async () => {
    const server = getHttpServer(httpServer);
    const session = await seedCompletedDesignSession(prisma);

    const generateResponse = await request(server)
      .post(`/api/v1/design-sessions/${session.id}/generate-diagram`)
      .expect(201);
    const generated = getDataRecord(generateResponse.body);
    const diagram = getRecord(generated.diagram);

    expect(generated.designSessionId).toBe(session.id);
    expect(diagram.type).toBe("flowchart");
    expect(diagram.direction).toBe("TD");
    expect(diagram.mermaid).toContain("flowchart TD");
    expect(diagram.mermaid).toContain("Message Queue");

    const persistedSession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedSession.architectureDiagram).not.toBeNull();
    expect(persistedSession.diagramGeneratedAt).toBeInstanceOf(Date);

    const regenerateResponse = await request(server)
      .post(`/api/v1/design-sessions/${session.id}/generate-diagram`)
      .expect(201);
    expect(getRecord(getDataRecord(regenerateResponse.body).diagram).mermaid).toContain(
      "flowchart TD"
    );

    const getResponse = await request(server)
      .get(`/api/v1/design-sessions/${session.id}/diagram`)
      .expect(200);
    expect(getRecord(getDataRecord(getResponse.body).diagram).mermaid).toContain("flowchart TD");
  });

  it("rejects diagram generation before a system design exists", async () => {
    const project = await prisma.project.create({
      data: {
        name: "No Design Project",
        status: ProjectStatus.ACTIVE
      }
    });
    const session = await prisma.designSession.create({
      data: {
        projectId: project.id,
        title: "No design",
        problemStatement: "Design a system.",
        status: DesignSessionStatus.READY_FOR_DESIGN
      }
    });

    const response = await request(getHttpServer(httpServer))
      .post(`/api/v1/design-sessions/${session.id}/generate-diagram`)
      .expect(409);

    expect(getErrorRecord(response.body).code).toBe("GENERATED_DESIGN_REQUIRED");
  });
});

async function seedCompletedDesignSession(prisma: PrismaService) {
  const project = await prisma.project.create({
    data: {
      name: "Diagram Project",
      status: ProjectStatus.ACTIVE
    }
  });

  return prisma.designSession.create({
    data: {
      projectId: project.id,
      title: "Notification system",
      problemStatement: "Design a scalable notification system.",
      status: DesignSessionStatus.COMPLETED,
      generatedDesign: {
        architectureSummary:
          "Use APIs, caches, databases, queues, workers, and external notification providers.",
        majorComponents: [
          {
            name: "Notification API",
            responsibilities: ["Accept requests", "Validate templates"]
          },
          {
            name: "Worker Pool",
            responsibilities: ["Process queued jobs", "Retry failures"]
          }
        ],
        apiRecommendations: [],
        databaseChoices: [
          {
            name: "PostgreSQL",
            recommendation: "Use PostgreSQL for templates and delivery state.",
            reasoning: "Relational constraints fit auditability."
          }
        ],
        cachingStrategy: [
          {
            name: "Cache aside",
            recommendation: "Cache templates and preferences.",
            reasoning: "These are common reads."
          }
        ],
        messagingAndAsyncProcessing: [
          {
            name: "Message Queue",
            recommendation: "Use a durable queue for delivery jobs.",
            reasoning: "Queues decouple producers and workers."
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
      },
      designGeneratedAt: new Date(),
      completedAt: new Date()
    }
  });
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

