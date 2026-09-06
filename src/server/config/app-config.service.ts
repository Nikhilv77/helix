import { EnvironmentConfig } from "./environment.schema";

type AppConfigInput = Omit<
  EnvironmentConfig,
  | "clerkSecretKey"
  | "interviewAuthSecret"
  | "upstashRedisRestUrl"
  | "upstashRedisRestToken"
  | "groqApiKey"
  | "livekitUrl"
  | "livekitApiKey"
  | "livekitApiSecret"
  | "operatorUserIds"
  | "resendApiKey"
  | "notificationEmailEnabled"
  | "notificationFromEmail"
  | "cronSecret"
  | "appOrigin"
  | "deepgramApiKey"
  | "deepgramTtsModel"
> & {
  clerkSecretKey?: EnvironmentConfig["clerkSecretKey"];
  interviewAuthSecret?: EnvironmentConfig["interviewAuthSecret"];
  upstashRedisRestUrl?: EnvironmentConfig["upstashRedisRestUrl"];
  upstashRedisRestToken?: EnvironmentConfig["upstashRedisRestToken"];
  groqApiKey?: EnvironmentConfig["groqApiKey"];
  livekitUrl?: EnvironmentConfig["livekitUrl"];
  livekitApiKey?: EnvironmentConfig["livekitApiKey"];
  livekitApiSecret?: EnvironmentConfig["livekitApiSecret"];
  operatorUserIds?: EnvironmentConfig["operatorUserIds"];
  resendApiKey?: EnvironmentConfig["resendApiKey"];
  notificationEmailEnabled?: EnvironmentConfig["notificationEmailEnabled"];
  notificationFromEmail?: EnvironmentConfig["notificationFromEmail"];
  cronSecret?: EnvironmentConfig["cronSecret"];
  appOrigin?: EnvironmentConfig["appOrigin"];
  deepgramApiKey?: EnvironmentConfig["deepgramApiKey"];
  deepgramTtsModel?: EnvironmentConfig["deepgramTtsModel"];
};

export class AppConfigService {
  constructor(private readonly config: AppConfigInput) {}

  get nodeEnv(): EnvironmentConfig["nodeEnv"] {
    return this.config.nodeEnv;
  }

  get port(): EnvironmentConfig["port"] {
    return this.config.port;
  }

  get databaseUrl(): EnvironmentConfig["databaseUrl"] {
    return this.config.databaseUrl;
  }

  get appName(): EnvironmentConfig["appName"] {
    return this.config.appName;
  }

  get appVersion(): EnvironmentConfig["appVersion"] {
    return this.config.appVersion;
  }

  get corsOrigins(): EnvironmentConfig["corsOrigins"] {
    return this.config.corsOrigins;
  }

  get logLevel(): EnvironmentConfig["logLevel"] {
    return this.config.logLevel;
  }

  get geminiApiKey(): EnvironmentConfig["geminiApiKey"] {
    return this.config.geminiApiKey;
  }

  get geminiFastModel(): EnvironmentConfig["geminiFastModel"] {
    return this.config.geminiFastModel;
  }

  get geminiReasoningModel(): EnvironmentConfig["geminiReasoningModel"] {
    return this.config.geminiReasoningModel;
  }

  get geminiEmbeddingModel(): EnvironmentConfig["geminiEmbeddingModel"] {
    return this.config.geminiEmbeddingModel;
  }

  get geminiEmbeddingModelVersion(): EnvironmentConfig["geminiEmbeddingModelVersion"] {
    return this.config.geminiEmbeddingModelVersion;
  }

  get aiTimeoutMs(): EnvironmentConfig["aiTimeoutMs"] {
    return this.config.aiTimeoutMs;
  }

  get aiMaxRetries(): EnvironmentConfig["aiMaxRetries"] {
    return this.config.aiMaxRetries;
  }

  get knowledgeChunkMaxTokens(): EnvironmentConfig["knowledgeChunkMaxTokens"] {
    return this.config.knowledgeChunkMaxTokens;
  }

  get knowledgeEmbeddingDimensions(): EnvironmentConfig["knowledgeEmbeddingDimensions"] {
    return this.config.knowledgeEmbeddingDimensions;
  }

  get knowledgeEmbeddingBatchSize(): EnvironmentConfig["knowledgeEmbeddingBatchSize"] {
    return this.config.knowledgeEmbeddingBatchSize;
  }

  get retrievalDefaultTopK(): EnvironmentConfig["retrievalDefaultTopK"] {
    return this.config.retrievalDefaultTopK;
  }

  get retrievalMinSimilarity(): EnvironmentConfig["retrievalMinSimilarity"] {
    return this.config.retrievalMinSimilarity;
  }

  get interviewDailyLimit(): EnvironmentConfig["interviewDailyLimit"] {
    return this.config.interviewDailyLimit;
  }

  get upstashRedisRestUrl(): EnvironmentConfig["upstashRedisRestUrl"] {
    return this.config.upstashRedisRestUrl;
  }

  get upstashRedisRestToken(): EnvironmentConfig["upstashRedisRestToken"] {
    return this.config.upstashRedisRestToken;
  }

  /**
   * Prefer a dedicated signing secret. Existing deployments can roll this out
   * without downtime because their server-only Clerk or LiveKit secret remains
   * a secure fallback until INTERVIEW_AUTH_SECRET is configured.
   */
  get interviewAuthSecret(): string | undefined {
    return (
      this.config.interviewAuthSecret ?? this.config.clerkSecretKey ?? this.config.livekitApiSecret
    );
  }

  get groqApiKey(): EnvironmentConfig["groqApiKey"] {
    return this.config.groqApiKey;
  }

  get groqDeciderModel(): EnvironmentConfig["groqDeciderModel"] {
    return this.config.groqDeciderModel;
  }

  get livekitUrl(): EnvironmentConfig["livekitUrl"] {
    return this.config.livekitUrl;
  }

  get livekitApiKey(): EnvironmentConfig["livekitApiKey"] {
    return this.config.livekitApiKey;
  }

  get livekitApiSecret(): EnvironmentConfig["livekitApiSecret"] {
    return this.config.livekitApiSecret;
  }

  get livekitAgentName(): EnvironmentConfig["livekitAgentName"] {
    return this.config.livekitAgentName;
  }

  get deepgramApiKey(): string | undefined {
    return this.config.deepgramApiKey;
  }

  /** Empty means the report queue is closed to everyone — the safe default. */
  get operatorUserIds(): string[] {
    return this.config.operatorUserIds ?? [];
  }

  get resendApiKey(): string | undefined {
    return this.config.resendApiKey;
  }

  get notificationEmailEnabled(): EnvironmentConfig["notificationEmailEnabled"] {
    return this.config.notificationEmailEnabled ?? false;
  }

  get notificationFromEmail(): string | undefined {
    return this.config.notificationFromEmail;
  }

  get cronSecret(): string | undefined {
    return this.config.cronSecret;
  }

  get appOrigin(): string | undefined {
    return this.config.appOrigin;
  }

  get deepgramTtsModel(): string {
    return this.config.deepgramTtsModel ?? "aura-2-asteria-en";
  }

  get judge0Url(): string {
    return this.config.judge0Url;
  }

  get rapidApiKey(): string | undefined {
    return this.config.rapidApiKey;
  }

  get rapidApiHost(): string {
    return this.config.rapidApiHost;
  }

  get clerkSecretKey(): string | undefined {
    return this.config.clerkSecretKey;
  }
}
