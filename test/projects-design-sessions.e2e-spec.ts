import { INestApplication } from "@nestjs/common";
import { DesignSessionStatus, ProjectStatus } from "@prisma/client";
import { Server } from "http";
import request from "supertest";
import { isRecord } from "../src/common/utils/is-record";
import { PrismaService } from "../src/database/prisma.service";
import { applyMigrations, createE2eApp, resetDatabase } from "./e2e-app";

describe("Projects and design sessions e2e", () => {
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

  it("creates, lists, updates, archives, restores, and deletes projects", async () => {
    const server = getHttpServer(httpServer);
    const createResponse = await request(server)
      .post("/api/v1/projects")
      .send({
        name: "  Payment Platform  ",
        description: "  Handles checkout design work.  "
      })
      .expect(201);
    const createdProject = getDataRecord(createResponse.body);
    const projectId = getString(createdProject.id);

    expect(createdProject.name).toBe("Payment Platform");
    expect(createdProject.description).toBe("Handles checkout design work.");
    expect(createdProject.status).toBe(ProjectStatus.ACTIVE);

    await prisma.project.create({
      data: {
        name: "Archived Search Fixture",
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date()
      }
    });

    const listResponse = await request(server)
      .get("/api/v1/projects")
      .query({
        status: ProjectStatus.ACTIVE,
        search: "pay",
        sortBy: "name",
        sortOrder: "asc",
        page: 1,
        limit: 10
      })
      .expect(200);
    const listedProjects = getDataArray(listResponse.body);
    const listMeta = getMetaRecord(listResponse.body);

    expect(listedProjects).toHaveLength(1);
    expect(getRecord(listedProjects[0]).id).toBe(projectId);
    expect(getRecord(listMeta.pagination).total).toBe(1);

    const getResponse = await request(server).get(`/api/v1/projects/${projectId}`).expect(200);
    expect(getDataRecord(getResponse.body).id).toBe(projectId);

    const updateResponse = await request(server)
      .patch(`/api/v1/projects/${projectId}`)
      .send({ name: "  Payments V2  " })
      .expect(200);
    expect(getDataRecord(updateResponse.body).name).toBe("Payments V2");

    const archiveResponse = await request(server)
      .post(`/api/v1/projects/${projectId}/archive`)
      .expect(201);
    const archivedProject = getDataRecord(archiveResponse.body);
    expect(archivedProject.status).toBe(ProjectStatus.ARCHIVED);
    expect(typeof archivedProject.archivedAt).toBe("string");

    const archiveConflictResponse = await request(server)
      .post(`/api/v1/projects/${projectId}/archive`)
      .expect(409);
    expect(getErrorRecord(archiveConflictResponse.body).code).toBe("PROJECT_ALREADY_ARCHIVED");

    const restoreResponse = await request(server)
      .post(`/api/v1/projects/${projectId}/restore`)
      .expect(201);
    expect(getDataRecord(restoreResponse.body).status).toBe(ProjectStatus.ACTIVE);

    await request(server).delete(`/api/v1/projects/${projectId}`).expect(200);

    const missingResponse = await request(server).get(`/api/v1/projects/${projectId}`).expect(404);
    expect(getErrorRecord(missingResponse.body).code).toBe("PROJECT_NOT_FOUND");
  });

  it("enforces design-session project and status rules", async () => {
    const server = getHttpServer(httpServer);
    const activeProject = await prisma.project.create({
      data: {
        name: "Active Project",
        status: ProjectStatus.ACTIVE
      }
    });
    const archivedProject = await prisma.project.create({
      data: {
        name: "Archived Project",
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date()
      }
    });

    const createResponse = await request(server)
      .post(`/api/v1/projects/${activeProject.id}/design-sessions`)
      .send({
        title: "  First draft  ",
        problemStatement: "  Design a collaborative document editor.  "
      })
      .expect(201);
    const createdSession = getDataRecord(createResponse.body);
    const sessionId = getString(createdSession.id);

    expect(createdSession.title).toBe("First draft");
    expect(createdSession.problemStatement).toBe("Design a collaborative document editor.");
    expect(createdSession.status).toBe(DesignSessionStatus.DRAFT);

    const archivedCreateResponse = await request(server)
      .post(`/api/v1/projects/${archivedProject.id}/design-sessions`)
      .send({
        title: "Blocked",
        problemStatement: "Cannot create this."
      })
      .expect(409);
    expect(getErrorRecord(archivedCreateResponse.body).code).toBe("PROJECT_ARCHIVED");

    const listResponse = await request(server)
      .get(`/api/v1/projects/${activeProject.id}/design-sessions`)
      .expect(200);
    expect(getDataArray(listResponse.body)).toHaveLength(1);

    const patchResponse = await request(server)
      .patch(`/api/v1/design-sessions/${sessionId}`)
      .send({ title: "  Revised draft  " })
      .expect(200);
    expect(getDataRecord(patchResponse.body).title).toBe("Revised draft");

    await prisma.designSession.update({
      where: { id: sessionId },
      data: { status: DesignSessionStatus.COMPLETED, completedAt: new Date() }
    });

    const editConflictResponse = await request(server)
      .patch(`/api/v1/design-sessions/${sessionId}`)
      .send({ title: "Should fail" })
      .expect(409);
    expect(getErrorRecord(editConflictResponse.body).code).toBe("DESIGN_SESSION_NOT_EDITABLE");

    const deleteConflictResponse = await request(server)
      .delete(`/api/v1/design-sessions/${sessionId}`)
      .expect(409);
    expect(getErrorRecord(deleteConflictResponse.body).code).toBe("DESIGN_SESSION_NOT_DELETABLE");

    const failedSession = await prisma.designSession.create({
      data: {
        projectId: activeProject.id,
        title: "Failed session",
        problemStatement: "This failed during a later workflow.",
        status: DesignSessionStatus.FAILED,
        failureCode: "E2E_FAILURE",
        failureMessage: "Created by e2e test."
      }
    });

    await request(server).delete(`/api/v1/design-sessions/${failedSession.id}`).expect(200);

    const missingResponse = await request(server)
      .get(`/api/v1/design-sessions/${failedSession.id}`)
      .expect(404);
    expect(getErrorRecord(missingResponse.body).code).toBe("DESIGN_SESSION_NOT_FOUND");
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

function getDataArray(body: unknown): unknown[] {
  const envelope = getRecord(body);

  if (!Array.isArray(envelope.data)) {
    throw new Error("Expected response data to be an array");
  }

  return envelope.data;
}

function getMetaRecord(body: unknown): Record<string, unknown> {
  const envelope = getRecord(body);
  return getRecord(envelope.meta);
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

function getString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected value to be a string");
  }

  return value;
}
