import { EnvironmentConfig } from "./environment.schema";

type AppConfigInput = Omit<EnvironmentConfig, "clerkSecretKey"> & {
  clerkSecretKey?: EnvironmentConfig["clerkSecretKey"];
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

  get clerkSecretKey(): string | undefined {
    return this.config.clerkSecretKey;
  }
}
