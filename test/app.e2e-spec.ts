import { INestApplication } from "@nestjs/common";
import { Server } from "http";
import request from "supertest";
import { isRecord } from "../backend/src/common/utils/is-record";
import { PrismaService } from "../backend/src/database/prisma.service";
import { applyMigrations, createE2eApp, resetDatabase } from "./e2e-app";

describe("App e2e", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;

  beforeAll(async () => {
    await applyMigrations();
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("GET /api/v1/health", async () => {
    const httpServer = getHttpServer(app);
    const response = await request(httpServer).get("/api/v1/health").expect(200);
    const body: unknown = response.body;

    expect(isRecord(body)).toBe(true);
    if (!isRecord(body)) {
      throw new Error("Expected response body to be an object");
    }

    const data = body.data;
    expect(body.success).toBe(true);
    expect(body.meta).toEqual({});
    expect(typeof body.timestamp).toBe("string");
    expect(isRecord(data)).toBe(true);
    if (!isRecord(data)) {
      throw new Error("Expected response data to be an object");
    }

    expect(data.status).toBe("ok");
    expect(data.database).toEqual({ status: "up" });
    expect(data.appName).toBe("AI System Design Copilot");
    expect(data.appVersion).toBe("0.1.0");
    expect(data.environment).toBe("test");
  });
});

function getHttpServer(app: INestApplication | undefined): Server {
  if (!app) {
    throw new Error("Expected e2e app to be initialized");
  }

  return app.getHttpServer() as Server;
}
