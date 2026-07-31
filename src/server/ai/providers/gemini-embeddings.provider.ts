import type { EmbedContentParameters } from "@google/genai";
import { Logger } from "../../common/logger";
import { isRecord } from "../../common/utils/is-record";
import { AppConfigService } from "../../config/app-config.service";
import { AiProviderException } from "../ai-provider.exception";
import type {
  EmbeddingsProvider,
  GenerateEmbeddingsRequest,
  GenerateEmbeddingsResult
} from "../interfaces/embeddings-provider.interface";
import type { GeminiGenerateContentClient } from "./gemini-provider.types";

const PROVIDER_NAME = "gemini";
const TRANSIENT_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);

export class GeminiEmbeddingsProvider implements EmbeddingsProvider {
  private readonly logger = new Logger(GeminiEmbeddingsProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly client: GeminiGenerateContentClient
  ) {}

  async generateEmbeddings(request: GenerateEmbeddingsRequest): Promise<GenerateEmbeddingsResult> {
    const maxAttempts = this.config.aiMaxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      this.logRequestMetadata(request, attempt, maxAttempts);

      try {
        const response = await this.withTimeout(
          () => this.embedContent(request),
          request.operation
        );
        const embeddings = this.readEmbeddings(response, request.operation, request.texts.length);

        this.logger.log(
          JSON.stringify({
            event: "ai.embeddings.success",
            provider: PROVIDER_NAME,
            operation: request.operation,
            model: this.config.geminiEmbeddingModel,
            modelVersion: this.config.geminiEmbeddingModelVersion,
            textCount: request.texts.length,
            attempt,
            durationMs: Date.now() - startedAt
          })
        );

        return {
          embeddings,
          model: this.config.geminiEmbeddingModel,
          modelVersion: this.config.geminiEmbeddingModelVersion
        };
      } catch (error) {
        const mappedError = this.mapError(error, request.operation);
        const shouldRetry = mappedError.retryable && attempt < maxAttempts;

        this.logger.warn(
          JSON.stringify({
            event: shouldRetry ? "ai.embeddings.retry" : "ai.embeddings.failure",
            provider: PROVIDER_NAME,
            operation: request.operation,
            model: this.config.geminiEmbeddingModel,
            modelVersion: this.config.geminiEmbeddingModelVersion,
            textCount: request.texts.length,
            attempt,
            durationMs: Date.now() - startedAt,
            code: mappedError.code,
            retryable: mappedError.retryable
          })
        );

        if (!shouldRetry) {
          throw mappedError;
        }
      }
    }

    throw new AiProviderException({
      code: "AI_PROVIDER_ERROR",
      message: "AI embedding provider request failed",
      provider: PROVIDER_NAME,
      operation: request.operation,
      retryable: false
    });
  }

  private embedContent(request: GenerateEmbeddingsRequest) {
    const params: EmbedContentParameters = {
      model: this.config.geminiEmbeddingModel,
      contents: request.texts,
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: this.config.knowledgeEmbeddingDimensions
      }
    };

    return this.client.models.embedContent(params);
  }

  private readEmbeddings(response: unknown, operation: string, expectedCount: number): number[][] {
    if (!isRecord(response) || !Array.isArray(response.embeddings)) {
      throw this.invalidEmbeddingResponse(operation);
    }

    const embeddings: number[][] = response.embeddings.map((embedding) => {
      if (!isRecord(embedding) || !Array.isArray(embedding.values)) {
        throw this.invalidEmbeddingResponse(operation);
      }

      const values: number[] = [];
      for (const value of embedding.values) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw this.invalidEmbeddingResponse(operation);
        }

        values.push(value);
      }

      return values;
    });

    if (embeddings.length !== expectedCount || embeddings.some((embedding) => embedding.length === 0)) {
      throw this.invalidEmbeddingResponse(operation);
    }

    return embeddings;
  }

  private async withTimeout<T>(operation: () => Promise<T>, requestOperation: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new AiProviderException({
                code: "AI_TIMEOUT",
                message: "AI embedding provider request timed out",
                provider: PROVIDER_NAME,
                operation: requestOperation,
                retryable: true
              })
            );
          }, this.config.aiTimeoutMs);
        })
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private mapError(error: unknown, operation: string): AiProviderException {
    if (error instanceof AiProviderException) {
      return error;
    }

    return new AiProviderException({
      code: "AI_PROVIDER_ERROR",
      message: "AI embedding provider request failed",
      provider: PROVIDER_NAME,
      operation,
      retryable: this.isTransientError(error),
      cause: error
    });
  }

  private invalidEmbeddingResponse(operation: string): AiProviderException {
    return new AiProviderException({
      code: "AI_INVALID_EMBEDDING_RESPONSE",
      message: "AI embedding provider returned an invalid response",
      provider: PROVIDER_NAME,
      operation,
      retryable: false
    });
  }

  private isTransientError(error: unknown): boolean {
    if (!isRecord(error)) {
      return false;
    }

    const status = this.readStatusCode(error);
    if (status && TRANSIENT_STATUS_CODES.has(status)) {
      return true;
    }

    const code = typeof error.code === "string" ? error.code : undefined;
    if (code && ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"].includes(code)) {
      return true;
    }

    const message = error.message;
    return typeof message === "string" && /timeout|temporar|rate limit|unavailable/i.test(message);
  }

  private readStatusCode(error: Record<string, unknown>): number | undefined {
    const status = error.status ?? error.statusCode;

    if (typeof status === "number") {
      return status;
    }

    if (typeof status === "string") {
      const parsedStatus = Number(status);
      return Number.isInteger(parsedStatus) ? parsedStatus : undefined;
    }

    return undefined;
  }

  private logRequestMetadata(
    request: GenerateEmbeddingsRequest,
    attempt: number,
    maxAttempts: number
  ): void {
    this.logger.log(
      JSON.stringify({
        event: "ai.embeddings.request",
        provider: PROVIDER_NAME,
        operation: request.operation,
        model: this.config.geminiEmbeddingModel,
        modelVersion: this.config.geminiEmbeddingModelVersion,
        textCount: request.texts.length,
        attempt,
        maxAttempts,
        timeoutMs: this.config.aiTimeoutMs
      })
    );
  }
}
