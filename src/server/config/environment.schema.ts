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
    APP_NAME: z.string().min(1).default("Helix"),
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
    INTERVIEW_DAILY_LIMIT: z.coerce.number().int().min(1).max(100).default(2),
    GROQ_API_KEY: z.string().optional(),
    GROQ_DECIDER_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
    LIVEKIT_URL: z.string().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),
    LIVEKIT_AGENT_NAME: z.string().min(1).default("helix-interviewer-v2"),
    DEEPGRAM_API_KEY: z.string().optional(),
    // Maya's voice. Matches HELIX_TTS_MODEL in the agent so the coach in the
    // workspace and the interviewer in the room sound like the same person.
    DEEPGRAM_TTS_MODEL: z.string().min(1).default("aura-2-asteria-en")
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
    interviewDailyLimit: env.INTERVIEW_DAILY_LIMIT,
    groqApiKey: env.GROQ_API_KEY,
    groqDeciderModel: env.GROQ_DECIDER_MODEL,
    livekitUrl: env.LIVEKIT_URL,
    livekitApiKey: env.LIVEKIT_API_KEY,
    livekitApiSecret: env.LIVEKIT_API_SECRET,
    livekitAgentName: env.LIVEKIT_AGENT_NAME,
    deepgramApiKey: env.DEEPGRAM_API_KEY,
    deepgramTtsModel: env.DEEPGRAM_TTS_MODEL
  }));

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: NodeJS.ProcessEnv): EnvironmentConfig {
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
