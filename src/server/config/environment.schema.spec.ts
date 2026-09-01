import { AppConfigService } from "./app-config.service";
import { validateEnvironment } from "./environment.schema";

describe("validateEnvironment", () => {
  const validEnvironment = {
    NODE_ENV: "test",
    PORT: "3001",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_system_design?schema=public",
    APP_NAME: "AI System Design Copilot",
    APP_VERSION: "0.1.0",
    CORS_ORIGINS: "http://localhost:3000, https://example.com",
    LOG_LEVEL: "info",
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_FAST_MODEL: "gemini-fast-test",
    GEMINI_REASONING_MODEL: "gemini-reasoning-test",
    GEMINI_EMBEDDING_MODEL: "gemini-embedding-test",
    GEMINI_EMBEDDING_MODEL_VERSION: "test-version",
    AI_TIMEOUT_MS: "5000",
    AI_MAX_RETRIES: "1",
    KNOWLEDGE_CHUNK_MAX_TOKENS: "500",
    KNOWLEDGE_EMBEDDING_DIMENSIONS: "32",
    KNOWLEDGE_EMBEDDING_BATCH_SIZE: "4",
    RETRIEVAL_DEFAULT_TOP_K: "7",
    RETRIEVAL_MIN_SIMILARITY: "0.35"
  };

  it("returns a typed configuration object for valid input", () => {
    const config = validateEnvironment(validEnvironment);

    expect(config).toEqual({
      nodeEnv: "test",
      port: 3001,
      databaseUrl: validEnvironment.DATABASE_URL,
      appName: "AI System Design Copilot",
      appVersion: "0.1.0",
      corsOrigins: ["http://localhost:3000", "https://example.com"],
      logLevel: "info",
      geminiApiKey: "test-gemini-key",
      geminiFastModel: "gemini-fast-test",
      geminiReasoningModel: "gemini-reasoning-test",
      geminiEmbeddingModel: "gemini-embedding-test",
      geminiEmbeddingModelVersion: "test-version",
      aiTimeoutMs: 5000,
      aiMaxRetries: 1,
      knowledgeChunkMaxTokens: 500,
      knowledgeEmbeddingDimensions: 32,
      knowledgeEmbeddingBatchSize: 4,
      retrievalDefaultTopK: 7,
      retrievalMinSimilarity: 0.35,
      clerkSecretKey: undefined,
      interviewAuthSecret: undefined,
      upstashRedisRestUrl: undefined,
      upstashRedisRestToken: undefined,
      groqDeciderModel: "openai/gpt-oss-20b",
      groqApiKey: undefined,
      interviewDailyLimit: 2,
      practiceNonDsaEnabled: true,
      // Defaults to an empty list rather than undefined: the report queue is
      // closed to everyone until somebody is explicitly named.
      operatorUserIds: [],
      resendApiKey: undefined,
      notificationEmailEnabled: false,
      notificationFromEmail: undefined,
      cronSecret: undefined,
      appOrigin: undefined,
      livekitUrl: undefined,
      livekitApiKey: undefined,
      livekitApiSecret: undefined,
      livekitAgentName: "helix-interviewer-v2",
      deepgramApiKey: undefined,
      deepgramTtsModel: "aura-2-asteria-en",
      judge0Url: "https://judge0-ce.p.rapidapi.com",
      rapidApiKey: undefined,
      rapidApiHost: "judge0-ce.p.rapidapi.com"
    });
    expect(config.notificationEmailEnabled).toBe(false);
    expect(config.practiceNonDsaEnabled).toBe(true);
  });

  it("keeps non-DSA Practice enabled by default while allowing an emergency opt-out", () => {
    expect(
      validateEnvironment({ ...validEnvironment, PRACTICE_NON_DSA_ENABLED: "false" })
        .practiceNonDsaEnabled
    ).toBe(false);
  });

  it("keeps the application-config fallback aligned with the published workspaces", () => {
    const parsed = validateEnvironment(validEnvironment);
    expect(
      new AppConfigService({ ...parsed, practiceNonDsaEnabled: undefined }).practiceNonDsaEnabled
    ).toBe(true);
  });

  it("enables notification email only through an explicit launch switch", () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        NOTIFICATION_EMAIL_ENABLED: "true",
        RESEND_API_KEY: "re_test",
        NOTIFICATION_FROM_EMAIL: "Trailgrad <hello@trailgrad.com>",
        NEXT_PUBLIC_APP_URL: "https://app.trailgrad.com"
      }).notificationEmailEnabled
    ).toBe(true);
  });

  it("refuses to enable email without its sender and actionable app origin", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NOTIFICATION_EMAIL_ENABLED: "true",
        RESEND_API_KEY: "re_test"
      })
    ).toThrow("NOTIFICATION_FROM_EMAIL is required when NOTIFICATION_EMAIL_ENABLED=true");
  });

  it("throws a clear error when DATABASE_URL is missing", () => {
    const environmentWithoutDatabaseUrl: Record<string, string> = { ...validEnvironment };
    delete environmentWithoutDatabaseUrl.DATABASE_URL;

    expect(() => validateEnvironment(environmentWithoutDatabaseUrl)).toThrow(
      "Invalid environment configuration: DATABASE_URL: DATABASE_URL is required"
    );
  });

  it("rejects invalid CORS origins", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CORS_ORIGINS: "http://localhost:3000,ftp://example.com"
      })
    ).toThrow("CORS_ORIGINS must be a comma-separated list of HTTP(S) origins or *");
  });

  it("requires both Upstash Redis REST credentials when either is configured", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io"
      })
    ).toThrow("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together");
  });
});
