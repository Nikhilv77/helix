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
    PRACTICE_NON_DSA_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    GROQ_API_KEY: z.string().optional(),
    GROQ_DECIDER_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
    /// Slack or Discord webhook that Milestone A routes help requests to. Unset
    /// means requests are only recorded and logged.
    HELP_REQUEST_WEBHOOK_URL: z.string().url().optional(),
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
    // Kept as "helix-…" through the Trailgrad rename: this name is registered
    // with LiveKit by the Python worker, and the two must change in the same
    // deploy or new calls dispatch to an agent that is not listening. Rename it
    // together with `agent_name` in agent/config.py when you next ship both.
    LIVEKIT_AGENT_NAME: z.string().min(1).default("helix-interviewer-v2"),
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
    practiceNonDsaEnabled: env.PRACTICE_NON_DSA_ENABLED,
    upstashRedisRestUrl: env.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: env.UPSTASH_REDIS_REST_TOKEN,
    groqApiKey: env.GROQ_API_KEY,
    groqDeciderModel: env.GROQ_DECIDER_MODEL,
    helpRequestWebhookUrl: env.HELP_REQUEST_WEBHOOK_URL,
    operatorUserIds: env.OPERATOR_USER_IDS,
    resendApiKey: env.RESEND_API_KEY,
    notificationEmailEnabled: env.NOTIFICATION_EMAIL_ENABLED,
    notificationFromEmail: env.NOTIFICATION_FROM_EMAIL,
    cronSecret: env.CRON_SECRET,
    appOrigin: env.NEXT_PUBLIC_APP_URL,
    livekitUrl: env.LIVEKIT_URL,
    livekitApiKey: env.LIVEKIT_API_KEY,
    livekitApiSecret: env.LIVEKIT_API_SECRET,
    livekitAgentName: env.LIVEKIT_AGENT_NAME,
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
