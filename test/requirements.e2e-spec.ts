import { INestApplication } from "@nestjs/common";
import { DesignSessionStatus, ProjectStatus } from "@prisma/client";
import { Server } from "http";
import request from "supertest";
import { isRecord } from "../backend/src/common/utils/is-record";
import { PrismaService } from "../backend/src/database/prisma.service";
import { applyMigrations, createE2eApp, resetDatabase } from "./e2e-app";

describe("Requirement analysis e2e", () => {
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

  it("analyzes draft requirements, accepts clarification answers, and moves ready for design", async () => {
    const server = getHttpServer(httpServer);
    const project = await prisma.project.create({
      data: {
        name: "Docs Platform",
        status: ProjectStatus.ACTIVE
      }
    });
    const session = await prisma.designSession.create({
      data: {
        projectId: project.id,
        title: "Collaborative editor",
        problemStatement: "Design a collaborative document editor for teams."
      }
    });

    const analyzeResponse = await request(server)
      .post(`/api/v1/design-sessions/${session.id}/analyze-requirements`)
      .expect(201);
    const pendingRequirements = getDataRecord(analyzeResponse.body);
    const pendingAnalysis = getRecord(pendingRequirements.analysis);
    const pendingQuestions = getArray(pendingAnalysis.clarificationQuestions);

    expect(pendingRequirements.status).toBe(DesignSessionStatus.REQUIREMENTS_PENDING);
    expect(pendingAnalysis.productSummary).toBe("A collaborative document editor for teams.");
    expect(pendingQuestions).toHaveLength(1);
    expect(getRecord(pendingQuestions[0]).id).toBe("CQ-1");

    const persistedPendingSession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedPendingSession.status).toBe(DesignSessionStatus.REQUIREMENTS_PENDING);
    expect(persistedPendingSession.failureCode).toBeNull();

    const getPendingResponse = await request(server)
      .get(`/api/v1/design-sessions/${session.id}/requirements`)
      .expect(200);
    expect(getRecord(getDataRecord(getPendingResponse.body).analysis).productSummary).toBe(
      "A collaborative document editor for teams."
    );

    const clarificationResponse = await request(server)
      .post(`/api/v1/design-sessions/${session.id}/clarifications`)
      .send({
        answers: [
          {
            questionId: "CQ-1",
            answer: "Support 100 concurrent editors per document."
          }
        ]
      })
      .expect(201);
    const readyRequirements = getDataRecord(clarificationResponse.body);
    const readyAnalysis = getRecord(readyRequirements.analysis);

    expect(readyRequirements.status).toBe(DesignSessionStatus.READY_FOR_DESIGN);
    expect(getArray(readyAnalysis.clarificationQuestions)).toHaveLength(0);
    expect(getArray(readyAnalysis.missingInformation)).toHaveLength(0);
    expect(getArray(readyRequirements.clarificationAnswers)).toHaveLength(1);

    const persistedReadySession = await prisma.designSession.findUniqueOrThrow({
      where: { id: session.id }
    });
    expect(persistedReadySession.status).toBe(DesignSessionStatus.READY_FOR_DESIGN);
    expect(persistedReadySession.requirementAnalysis).not.toBeNull();
    expect(persistedReadySession.clarificationAnswers).not.toBeNull();
  });

  it("rejects requirement analysis for non-draft and already-running sessions", async () => {
    const server = getHttpServer(httpServer);
    const project = await prisma.project.create({
      data: {
        name: "Status Project",
        status: ProjectStatus.ACTIVE
      }
    });
    const readySession = await prisma.designSession.create({
      data: {
        projectId: project.id,
        title: "Ready session",
        problemStatement: "Design a ready system.",
        status: DesignSessionStatus.READY_FOR_DESIGN
      }
    });
    const runningSession = await prisma.designSession.create({
      data: {
        projectId: project.id,
        title: "Running session",
        problemStatement: "Design a running system.",
        status: DesignSessionStatus.GENERATING,
        currentStep: "requirements_analysis"
      }
    });

    const readyResponse = await request(server)
      .post(`/api/v1/design-sessions/${readySession.id}/analyze-requirements`)
      .expect(409);
    expect(getErrorRecord(readyResponse.body).code).toBe(
      "DESIGN_SESSION_REQUIREMENTS_NOT_ANALYZABLE"
    );

    const runningResponse = await request(server)
      .post(`/api/v1/design-sessions/${runningSession.id}/analyze-requirements`)
      .expect(409);
    expect(getErrorRecord(runningResponse.body).code).toBe("REQUIREMENT_ANALYSIS_IN_PROGRESS");
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

function getArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected value to be an array");
  }

  return value;
}

