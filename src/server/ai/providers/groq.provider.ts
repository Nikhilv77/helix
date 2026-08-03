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

const PROVIDER_NAME = "groq";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TEMPERATURE = 0.2;
const TRANSIENT_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);

const convertZodToJsonSchema = zodToJsonSchema as (
  schema: unknown,
  options: { $refStrategy: "none" }
) => unknown;

/**
 * Groq via its OpenAI-compatible endpoint — plain fetch, no SDK.
 *
 * Used for the per-turn decision, where time-to-first-token sits directly in
 * the voice latency budget. `strict: true` turns on constrained decoding, so
 * malformed JSON is impossible rather than merely retried.
 */
export class GroqProvider implements SystemDesignerAIProvider {
  private readonly logger = new Logger(GroqProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    const maxAttempts = request.maxAttempts ?? this.config.aiMaxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = Date.now();

      this.logger.log(
        JSON.stringify({
          event: "ai.provider.request",
          provider: PROVIDER_NAME,
          operation: request.operation,
          model: this.model,
          attempt,
          maxAttempts,
          timeoutMs: request.timeoutMs ?? this.config.aiTimeoutMs
        })
      );

      try {
        const content = await this.requestCompletion(request);
        const parsed = request.schema.parse(JSON.parse(content));

        this.logger.log(
          JSON.stringify({
            event: "ai.provider.success",
            provider: PROVIDER_NAME,
            operation: request.operation,
            model: this.model,
            attempt,
            durationMs: Date.now() - startedAt
          })
        );

        return parsed;
      } catch (error) {
        const mapped = this.mapError(error, request.operation);
        const shouldRetry = mapped.retryable && attempt < maxAttempts;

        this.logger.warn(
          JSON.stringify({
            event: shouldRetry ? "ai.provider.retry" : "ai.provider.failure",
            provider: PROVIDER_NAME,
            operation: request.operation,
            model: this.model,
            attempt,
            durationMs: Date.now() - startedAt,
            code: mapped.code,
            retryable: mapped.retryable
          })
        );

        if (!shouldRetry) throw mapped;
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

  private async requestCompletion<T>(request: GenerateStructuredRequest<T>): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? this.config.aiTimeoutMs
    );

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          temperature: request.temperature ?? DEFAULT_TEMPERATURE,
          messages: [
            { role: "system", content: request.systemInstruction },
            { role: "user", content: request.prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.operation.replace(/[^a-zA-Z0-9_]/g, "_"),
              strict: true,
              schema: toStrictJsonSchema(
                convertZodToJsonSchema(request.schema, { $refStrategy: "none" })
              )
            }
          }
        })
      });

      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 500);
        throw new AiProviderException({
          code: "AI_PROVIDER_ERROR",
          message: `Groq responded with ${response.status}${detail ? `: ${detail}` : ""}`,
          provider: PROVIDER_NAME,
          operation: request.operation,
          retryable: TRANSIENT_STATUS_CODES.has(response.status)
        });
      }

      const payload: unknown = await response.json();
      const content = extractContent(payload);

      if (!content) {
        throw new AiProviderException({
          code: "AI_INVALID_RESPONSE",
          message: "Groq returned an empty response",
          provider: PROVIDER_NAME,
          operation: request.operation,
          retryable: true
        });
      }

      return content;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Never surfaces prompts, keys, or provider internals. */
  private mapError(error: unknown, operation: string): AiProviderException {
    if (error instanceof AiProviderException) return error;

    const aborted = error instanceof Error && error.name === "AbortError";

    return new AiProviderException({
      code: aborted ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR",
      message: aborted ? "AI provider request timed out" : "AI provider request failed",
      provider: PROVIDER_NAME,
      operation,
      retryable: aborted
    });
  }
}

function extractContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;

  const first = payload.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return null;

  const content = first.message.content;
  return typeof content === "string" && content.length > 0 ? content : null;
}
