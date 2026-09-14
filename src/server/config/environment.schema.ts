import { z } from "zod";

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isValidCorsOrigin(origin: string): boolean {
  if (origin === "*") {
    return true;
  }

  try {
    const url = new URL(origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const environmentSchema = z
  .object({
    NODE_ENV: nodeEnvironmentSchema.default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string({
        required_error: "DATABASE_URL is required"
      })
      .min(1, "DATABASE_URL is required")
      .url("DATABASE_URL must be a valid PostgreSQL connection URL")
      .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
        message: "DATABASE_URL must use the PostgreSQL protocol"
      }),
    APP_NAME: z.string().min(1).default("Trailgrad"),
    APP_VERSION: z.string().min(1).default("0.1.0"),
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform(parseCorsOrigins)
      .refine((origins) => origins.every(isValidCorsOrigin), {
        message: "CORS_ORIGINS must be a comma-separated list of HTTP(S) origins or *"
      }),
    LOG_LEVEL: logLevelSchema.default("info"),
    GEMINI_API_KEY: z
      .string({
        required_error: "GEMINI_API_KEY is required"
      })
      .min(1, "GEMINI_API_KEY is required"),
    GEMINI_FAST_MODEL: z
      .string({
        required_error: "GEMINI_FAST_MODEL is required"
      })
      .min(1, "GEMINI_FAST_MODEL is required"),
    GEMINI_REASONING_MODEL: z
      .string({
        required_error: "GEMINI_REASONING_MODEL is required"
      })
      .min(1, "GEMINI_REASONING_MODEL is required"),
    GEMINI_EMBEDDING_MODEL: z
      .string({
        required_error: "GEMINI_EMBEDDING_MODEL is required"
      })
      .min(1, "GEMINI_EMBEDDING_MODEL is required"),
    GEMINI_EMBEDDING_MODEL_VERSION: z.string().min(1).default("v1"),
    // Gemini Live is deliberately scoped to conversational resume and
    // behavioral rounds. Keep a kill switch because the Live API is preview.
    GEMINI_LIVE_INTERVIEWS_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    GEMINI_LIVE_MODEL: z.string().min(1).default("gemini-3.1-flash-live-preview"),
    GEMINI_LIVE_TRANSCRIPTION_MODEL: z.string().min(1).default("gemini-3.5-transcribe-live"),
    AI_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(30000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    KNOWLEDGE_CHUNK_MAX_TOKENS: z.coerce.number().int().min(100).max(4000).default(800),
    KNOWLEDGE_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(1).max(4096).default(768),
    KNOWLEDGE_EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(16),
    RETRIEVAL_DEFAULT_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
    RETRIEVAL_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.2),
    CLERK_SECRET_KEY: z.string().optional(),
    // Signs anonymous interview ownership cookies and the short-lived
    // capability passed to the remote voice worker. A dedicated value keeps
    // interview authorization independent from any third-party credential.
    INTERVIEW_AUTH_SECRET: z.string().min(32).optional(),
    INTERVIEW_DAILY_LIMIT: z.coerce.number().int().min(1).max(100).default(2),
    // Interview transcripts and reports contain candidate-provided personal
    // data. Retention is explicit, bounded, and independently configurable for
    // signed-in and anonymous sessions.
    INTERVIEW_AUTHENTICATED_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
    INTERVIEW_ANONYMOUS_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    // Terminal idempotency and evaluation-recovery rows are operational data,
    // not candidate history. Pending work is never removed by this policy.
    INTERVIEW_OPERATIONAL_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    INTERVIEW_RETENTION_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(250),
    INTERVIEW_METRICS_SAMPLE_LIMIT: z.coerce.number().int().min(100).max(20000).default(5000),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    GROQ_API_KEY: z.string().optional(),
    GROQ_DECIDER_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
    /// Clerk user ids allowed to read the help report queue, comma-separated.
    /// Empty means nobody — the queue is closed until somebody is named.
    OPERATOR_USER_IDS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      ),
    /// Single Clerk user id allowed to read interview production operations.
    /// This is deliberately separate from the multi-user moderation allowlist.
    INTERVIEW_OPERATIONS_ADMIN_USER_ID: z
      .string()
      .trim()
      .default("")
      .transform((value) => value || undefined),
    /// Resend API key. Unset means notifications are recorded in-app only.
    RESEND_API_KEY: z.string().optional(),
    /// Deliberate launch switch. Credentials may be present while email remains
    /// dormant until the product is ready to use the channel.
    NOTIFICATION_EMAIL_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /// Verified sender, e.g. "Trailgrad <hello@trailgrad.com>".
    NOTIFICATION_FROM_EMAIL: z.string().optional(),
    /// Protects scheduler endpoints. Vercel supplies it as a Bearer token.
    CRON_SECRET: z.string().min(16).optional(),
    /// Absolute origin used to build links inside emails. Shares the variable the
    /// app already uses for canonical URLs rather than introducing a second one.
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    LIVEKIT_URL: z.string().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),
    DEEPGRAM_API_KEY: z.string().optional(),
    // Maya's voice. Matches TRAILGRAD_TTS_MODEL in the agent so the coach in the
    // workspace and the interviewer in the room sound like the same person.
    DEEPGRAM_TTS_MODEL: z.string().min(1).default("aura-2-asteria-en"),
    JUDGE0_URL: z.string().url().default("https://judge0-ce.p.rapidapi.com"),
    RAPIDAPI_KEY: z.string().optional(),
    RAPIDAPI_HOST: z.string().min(1).default("judge0-ce.p.rapidapi.com")
  })
  .superRefine((env, context) => {
    if (Boolean(env.UPSTASH_REDIS_REST_URL) !== Boolean(env.UPSTASH_REDIS_REST_TOKEN)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["UPSTASH_REDIS_REST_URL"],
        message: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together"
      });
    }

    if (env.NOTIFICATION_EMAIL_ENABLED) {
      const required = [
        ["RESEND_API_KEY", env.RESEND_API_KEY],
        ["NOTIFICATION_FROM_EMAIL", env.NOTIFICATION_FROM_EMAIL],
        ["NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL]
      ] as const;

      for (const [variable, value] of required) {
        if (value) continue;
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [variable],
          message: `${variable} is required when NOTIFICATION_EMAIL_ENABLED=true`
        });
      }
    }
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    appName: env.APP_NAME,
    appVersion: env.APP_VERSION,
    corsOrigins: env.CORS_ORIGINS,
    logLevel: env.LOG_LEVEL,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiFastModel: env.GEMINI_FAST_MODEL,
    geminiReasoningModel: env.GEMINI_REASONING_MODEL,
    geminiEmbeddingModel: env.GEMINI_EMBEDDING_MODEL,
    geminiEmbeddingModelVersion: env.GEMINI_EMBEDDING_MODEL_VERSION,
    geminiLiveInterviewsEnabled: env.GEMINI_LIVE_INTERVIEWS_ENABLED,
    geminiLiveModel: env.GEMINI_LIVE_MODEL,
    geminiLiveTranscriptionModel: env.GEMINI_LIVE_TRANSCRIPTION_MODEL,
    aiTimeoutMs: env.AI_TIMEOUT_MS,
    aiMaxRetries: env.AI_MAX_RETRIES,
    knowledgeChunkMaxTokens: env.KNOWLEDGE_CHUNK_MAX_TOKENS,
    knowledgeEmbeddingDimensions: env.KNOWLEDGE_EMBEDDING_DIMENSIONS,
    knowledgeEmbeddingBatchSize: env.KNOWLEDGE_EMBEDDING_BATCH_SIZE,
    retrievalDefaultTopK: env.RETRIEVAL_DEFAULT_TOP_K,
    retrievalMinSimilarity: env.RETRIEVAL_MIN_SIMILARITY,
    clerkSecretKey: env.CLERK_SECRET_KEY,
    interviewAuthSecret: env.INTERVIEW_AUTH_SECRET,
    interviewDailyLimit: env.INTERVIEW_DAILY_LIMIT,
    interviewAuthenticatedRetentionDays: env.INTERVIEW_AUTHENTICATED_RETENTION_DAYS,
    interviewAnonymousRetentionDays: env.INTERVIEW_ANONYMOUS_RETENTION_DAYS,
    interviewOperationalRetentionDays: env.INTERVIEW_OPERATIONAL_RETENTION_DAYS,
    interviewRetentionBatchSize: env.INTERVIEW_RETENTION_BATCH_SIZE,
    interviewMetricsSampleLimit: env.INTERVIEW_METRICS_SAMPLE_LIMIT,
    upstashRedisRestUrl: env.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: env.UPSTASH_REDIS_REST_TOKEN,
    groqApiKey: env.GROQ_API_KEY,
    groqDeciderModel: env.GROQ_DECIDER_MODEL,
    operatorUserIds: env.OPERATOR_USER_IDS,
    interviewOperationsAdminUserId: env.INTERVIEW_OPERATIONS_ADMIN_USER_ID,
    resendApiKey: env.RESEND_API_KEY,
    notificationEmailEnabled: env.NOTIFICATION_EMAIL_ENABLED,
    notificationFromEmail: env.NOTIFICATION_FROM_EMAIL,
    cronSecret: env.CRON_SECRET,
    appOrigin: env.NEXT_PUBLIC_APP_URL,
    livekitUrl: env.LIVEKIT_URL,
    livekitApiKey: env.LIVEKIT_API_KEY,
    livekitApiSecret: env.LIVEKIT_API_SECRET,
    deepgramApiKey: env.DEEPGRAM_API_KEY,
    deepgramTtsModel: env.DEEPGRAM_TTS_MODEL,
    judge0Url: env.JUDGE0_URL,
    rapidApiKey: env.RAPIDAPI_KEY,
    rapidApiHost: env.RAPIDAPI_HOST
  }));

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, string | undefined>): EnvironmentConfig {
  const result = environmentSchema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map((issue) => {
    const variableName = issue.path.join(".") || "environment";
    return `${variableName}: ${issue.message}`;
  });

  throw new Error(`Invalid environment configuration: ${issues.join("; ")}`);
}
