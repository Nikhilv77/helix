import type { GenerateContentParameters } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Logger } from "../../common/logger";
import { isRecord } from "../../common/utils/is-record";
import { AppConfigService } from "../../config/app-config.service";
import { AiProviderException } from "../ai-provider.exception";
import { toStrictJsonSchema } from "../strict-json-schema";
import type {
  GenerateStructuredRequest,
  SystemDesignerAIProvider
} from "../interfaces/system-designer-ai-provider.interface";
import type {
  GeminiGenerateContentClient,
  GeminiGenerateContentResponse
} from "./gemini-provider.types";

const PROVIDER_NAME = "gemini";
const DEFAULT_TEMPERATURE = 0.2;
const TRANSIENT_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
const convertZodToJsonSchema = zodToJsonSchema as (
  schema: unknown,
  options: { $refStrategy: "none" }
) => unknown;

/**
 * Gemini rejects a response schema outright — 400 INVALID_ARGUMENT, before it
 * reads a single token — once the combined weight of validation keywords
 * crosses an undocumented budget. The resume extraction schema sat past it, so
 * every upload failed. The same pruning the Groq path already needs keeps the
 * shape intact while dropping the bounds; Zod still enforces them on the way
 * back.
 */
export function toGeminiResponseSchema(schema: unknown): unknown {
  return toStrictJsonSchema(convertZodToJsonSchema(schema, { $refStrategy: "none" }));
}

export class GeminiProvider implements SystemDesignerAIProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly client: GeminiGenerateContentClient
  ) {}

  async generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    const model = this.selectModel(request.modelClass);
    const maxAttempts = request.maxAttempts ?? this.config.aiMaxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      this.logRequestMetadata(request, model, attempt, maxAttempts);

      try {
        const response = await this.withTimeout(
          () => this.generateContent(request, model),
          request.operation,
          request.timeoutMs ?? this.config.aiTimeoutMs
        );
        const result = this.parseAndValidateResponse(response, request);

        this.logger.log(
          JSON.stringify({
            event: "ai.provider.success",
            provider: PROVIDER_NAME,
            operation: request.operation,
            modelClass: request.modelClass,
            model,
            attempt,
            durationMs: Date.now() - startedAt
          })
        );

        return result;
      } catch (error) {
        const mappedError = this.mapError(error, request.operation);
        const shouldRetry = mappedError.retryable && attempt < maxAttempts;

        this.logger.warn(
          JSON.stringify({
            event: shouldRetry ? "ai.provider.retry" : "ai.provider.failure",
            provider: PROVIDER_NAME,
            operation: request.operation,
            modelClass: request.modelClass,
            model,
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
      message: "AI provider request failed",
      provider: PROVIDER_NAME,
      operation: request.operation,
      retryable: false
    });
  }

  private selectModel(modelClass: GenerateStructuredRequest<unknown>["modelClass"]): string {
    return modelClass === "fast" ? this.config.geminiFastModel : this.config.geminiReasoningModel;
  }

  private generateContent<T>(
    request: GenerateStructuredRequest<T>,
    model: string
  ): Promise<GeminiGenerateContentResponse> {
    const contents = request.attachments?.length
      ? [
          {
            role: "user",
            parts: [
              ...request.attachments.map((attachment) => ({
                inlineData: {
                  mimeType: attachment.mimeType,
                  data: attachment.data
                }
              })),
              { text: request.prompt }
            ]
          }
        ]
      : request.prompt;
    const params: GenerateContentParameters = {
      model,
      contents,
      config: {
        systemInstruction: request.systemInstruction,
        temperature: request.temperature ?? DEFAULT_TEMPERATURE,
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiResponseSchema(request.schema)
      }
    };

    return this.client.models.generateContent(params);
  }

  private parseAndValidateResponse<T>(
    response: GeminiGenerateContentResponse,
    request: GenerateStructuredRequest<T>
  ): T {
    const responseText = response.text;

    if (!responseText) {
      throw this.invalidResponseError(request.operation, "AI provider returned an empty response");
    }

    const parsed = this.parseJson(responseText, request.operation);
    const validation = request.schema.safeParse(parsed);

    if (!validation.success) {
      throw this.invalidResponseError(
        request.operation,
        "AI provider returned output that did not match the expected schema",
        validation.error
      );
    }

    return validation.data;
  }

  private parseJson(text: string, operation: string): unknown {
    const trimmedText = text.trim();
    const fencedJsonMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmedText);
    const jsonText = fencedJsonMatch?.[1] ?? trimmedText;

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      throw this.invalidResponseError(operation, "AI provider returned invalid JSON", error);
    }
  }

  private async withTimeout<T>(
    operation: () => Promise<T>,
    requestOperation: string,
    timeoutMs: number
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new AiProviderException({
                code: "AI_TIMEOUT",
                message: "AI provider request timed out",
                provider: PROVIDER_NAME,
                operation: requestOperation,
                retryable: true
              })
            );
          }, timeoutMs);
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
      message: "AI provider request failed",
      provider: PROVIDER_NAME,
      operation,
      retryable: this.isTransientError(error),
      cause: error
    });
  }

  private invalidResponseError(
    operation: string,
    message: string,
    cause?: unknown
  ): AiProviderException {
    return new AiProviderException({
      code: "AI_INVALID_RESPONSE",
      message,
      provider: PROVIDER_NAME,
      operation,
      retryable: false,
      cause
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

  private logRequestMetadata<T>(
    request: GenerateStructuredRequest<T>,
    model: string,
    attempt: number,
    maxAttempts: number
  ): void {
    this.logger.log(
      JSON.stringify({
        event: "ai.provider.request",
        provider: PROVIDER_NAME,
        operation: request.operation,
        modelClass: request.modelClass,
        model,
        attempt,
        maxAttempts,
        timeoutMs: request.timeoutMs ?? this.config.aiTimeoutMs,
        attachmentCount: request.attachments?.length ?? 0,
        temperature: request.temperature ?? DEFAULT_TEMPERATURE
      })
    );
  }
}
