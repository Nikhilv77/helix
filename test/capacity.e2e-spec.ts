import { INestApplication } from "@nestjs/common";
import { DesignSessionStatus, ProjectStatus } from "@prisma/client";
import { Server } from "http";
import request from "supertest";
import { isRecord } from "../backend/src/common/utils/is-record";
import { PrismaService } from "../backend/src/database/prisma.service";
import { applyMigrations, createE2eApp, resetDatabase } from "./e2e-app";

describe("Capacity calculation e2e", () => {
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

  it("runs the standalone capacity calculator tool", async () => {
    const response = await request(getHttpServer(httpServer))
      .post("/api/v1/tools/capacity-calculator")
      .send({
        monthlyActiveUsers: 1_000_000,
        dailyActiveUserPercentage: 25,
        requestsPerActiveUserPerDay: 24,
        readWriteRatio: "80:20",
        averagePayloadSizeBytes: 2048,
        peakTrafficMultiplier: 3,
        dataCreatedPerUserBytes: 10 * 1024,
        retentionPeriodDays: 365
      })
      .expect(201);
    const data = getDataRecord(response.body);
    const results = getRecord(data.results);

    expect(data.toolName).toBe("capacity-calculator");
    expect(getRecord(results.dailyActiveUsers).raw).toBe(250_000);
    expect(getRecord(results.peakRequestsPerSecond).raw).toBeCloseTo(208.3333, 4);
    expect(getRecord(results.monthlyStorageGrowth).display).toBe("9.54 GB");
  });

  it("calculates and persists capacity for a ready design session", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Capacity Project",
        status: ProjectStatus.ACTIVE
      }
    });
    const session = await prisma.designSession.create({
      data: {
        projectId: project.id,
        title: "Notification system",
        problemStatement: "Design a notification system.",
        status: DesignSessionStatus.READY_FOR_DESIGN,
        requirementAnalysis: {
          productSummary: "A notification platform.",
          functionalRequirements: [],
          nonFunctionalRequirements: [],
          assumptions: [],
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
        requirementsAnalyzedAt: new Date()
      }
    });

    const calculateResponse = await request(getHttpServer(httpServer))
      .post(`/api/v1/design-sessions/${session.id}/calculate-capacity`)
      .send({
        dailyActiveUserPercentage: 25,
        readWriteRatio: "75:25",
        peakTrafficMultiplier: 4
      })
      .expect(201);
    const capacityResponse = getDataRecord(calculateResponse.body);
    const calculation = getRecord(capacityResponse.calculation);
    const inputs = getRecord(calculation.inputs);

    expect(capacityResponse.status).toBe(DesignSessionStatus.READY_FOR_DESIGN);
    expect(inputs.monthlyActiveUsers).toBe(1_000_000);
    expect(inputs.requestsPerActiveUserPerDay).toBe(24);
    expect(inputs.dataCreatedPerUserBytes).toBe(10 * 1024);
    expect(inputs.readWriteRatio).toBe("75:25");

    const persistedSession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedSession.capacityCalculation).not.toBeNull();
    expect(persistedSession.capacityCalculatedAt).toBeInstanceOf(Date);

    const getResponse = await request(getHttpServer(httpServer))
      .get(`/api/v1/design-sessions/${session.id}/capacity`)
      .expect(200);
    expect(getRecord(getDataRecord(getResponse.body).calculation).toolName).toBe(
      "capacity-calculator"
    );
  });

  it("rejects session capacity calculation before ready for design", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Pending Project",
        status: ProjectStatus.ACTIVE
      }
    });
    const session = await prisma.designSession.create({
      data: {
        projectId: project.id,
        title: "Pending session",
        problemStatement: "Design a pending system.",
        status: DesignSessionStatus.REQUIREMENTS_PENDING
      }
    });

    const response = await request(getHttpServer(httpServer))
      .post(`/api/v1/design-sessions/${session.id}/calculate-capacity`)
      .send({
        monthlyActiveUsers: 10_000
      })
      .expect(409);

    expect(getErrorRecord(response.body).code).toBe("DESIGN_SESSION_CAPACITY_NOT_CALCULABLE");
  });
});

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

