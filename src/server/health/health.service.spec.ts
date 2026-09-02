import { AppConfigService } from "../config/app-config.service";
import { PrismaService } from "../database/prisma.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  const config = new AppConfigService({
    nodeEnv: "test",
    port: 3000,
    databaseUrl: "postgresql://postgres:postgres@localhost:5432/ai_system_design",
    appName: "AI System Design Copilot",
    appVersion: "0.1.0",
    corsOrigins: [],
    logLevel: "info",
    geminiApiKey: "test-gemini-key",
    geminiFastModel: "gemini-fast-test",
    geminiReasoningModel: "gemini-reasoning-test",
    geminiEmbeddingModel: "gemini-embedding-test",
    geminiEmbeddingModelVersion: "test-version",
    aiTimeoutMs: 1000,
    aiMaxRetries: 0,
    knowledgeChunkMaxTokens: 500,
    knowledgeEmbeddingDimensions: 32,
    knowledgeEmbeddingBatchSize: 4,
    retrievalDefaultTopK: 5,
    retrievalMinSimilarity: 0.2,
    interviewDailyLimit: 2,
    groqDeciderModel: "test-groq-model",
    livekitAgentName: "test-agent",
    judge0Url: "https://judge0.example.com",
    rapidApiKey: undefined,
    rapidApiHost: "judge0.example.com"
  });

  it("returns ok when the database responds", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }])
    } as unknown as PrismaService;
    const service = new HealthService(config, prisma);

    await expect(service.getHealth()).resolves.toMatchObject({
      status: "ok",
      database: {
        status: "up"
      },
      appName: "AI System Design Copilot",
      appVersion: "0.1.0",
      environment: "test"
    });
  });

  it("returns unhealthy when the database query fails", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error("connection failed"))
    } as unknown as PrismaService;
    const service = new HealthService(config, prisma);

    await expect(service.getHealth()).resolves.toMatchObject({
      status: "unhealthy",
      database: {
        status: "down"
      }
    });
  });
});
