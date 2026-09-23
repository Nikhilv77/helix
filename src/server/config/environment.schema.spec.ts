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
      geminiLiveInterviewsEnabled: true,
      geminiLiveModel: "gemini-3.1-flash-live-preview",
      geminiLiveTranscriptionModel: "gemini-3.5-transcribe-live",
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
      interviewAuthenticatedRetentionDays: 365,
      interviewAnonymousRetentionDays: 30,
      interviewOperationalRetentionDays: 30,
      interviewRetentionBatchSize: 250,
      interviewMetricsSampleLimit: 5000,
      // Defaults to an empty list rather than undefined: the report queue is
      // closed to everyone until somebody is explicitly named.
      operatorUserIds: [],
      interviewOperationsAdminUserId: undefined,
      resendApiKey: undefined,
      notificationEmailEnabled: false,
      notificationFromEmail: undefined,
      cronSecret: undefined,
      appOrigin: undefined,
      livekitUrl: undefined,
      livekitApiKey: undefined,
      livekitApiSecret: undefined,
      deepgramApiKey: undefined,
      deepgramTtsModel: "aura-2-asteria-en",
      judge0Url: "https://judge0-ce.p.rapidapi.com",
      rapidApiKey: undefined,
      rapidApiHost: "judge0-ce.p.rapidapi.com"
    });
    expect(config.notificationEmailEnabled).toBe(false);
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

  it("parses bounded interview retention and dashboard controls", () => {
    const config = validateEnvironment({
      ...validEnvironment,
      INTERVIEW_AUTHENTICATED_RETENTION_DAYS: "730",
      INTERVIEW_ANONYMOUS_RETENTION_DAYS: "14",
      INTERVIEW_OPERATIONAL_RETENTION_DAYS: "7",
      INTERVIEW_RETENTION_BATCH_SIZE: "100",
      INTERVIEW_METRICS_SAMPLE_LIMIT: "2000"
    });

    expect(config).toMatchObject({
      interviewAuthenticatedRetentionDays: 730,
      interviewAnonymousRetentionDays: 14,
      interviewOperationalRetentionDays: 7,
      interviewRetentionBatchSize: 100,
      interviewMetricsSampleLimit: 2000
    });
  });

  it("parses the single interview operations admin Clerk user id", () => {
    const config = validateEnvironment({
      ...validEnvironment,
      INTERVIEW_OPERATIONS_ADMIN_USER_ID: " user_admin "
    });

    expect(config.interviewOperationsAdminUserId).toBe("user_admin");
  });

  it("rejects an unbounded anonymous interview retention window", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        INTERVIEW_ANONYMOUS_RETENTION_DAYS: "366"
      })
    ).toThrow("INTERVIEW_ANONYMOUS_RETENTION_DAYS");
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
