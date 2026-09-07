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
type StructuredOutputMode = "strict" | "best-effort" | "json-object";

const convertZodToJsonSchema = zodToJsonSchema as (
  schema: unknown,
  options: { $refStrategy: "none" }
) => unknown;

/**
 * Groq via its OpenAI-compatible endpoint — plain fetch, no SDK.
 *
 * Used for the per-turn decision, where time-to-first-token sits directly in
 * the voice latency budget. Requests start with constrained decoding and make
 * one best-effort schema request when Groq reports a constrained-generation
 * validation failure. Zod remains the final, fail-closed boundary.
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

    if (request.signal?.aborted) throw this.cancelledError(request.operation);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (request.signal?.aborted) throw this.cancelledError(request.operation);
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
        let parsed: T;
        try {
          parsed = request.schema.parse(JSON.parse(content));
        } catch (error) {
          throw new AiProviderException({
            code: "AI_INVALID_RESPONSE",
            message: "Groq returned output that did not match the expected schema",
            provider: PROVIDER_NAME,
            operation: request.operation,
            retryable: true,
            cause: error
          });
        }

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
            retryable: mapped.retryable,
            retryAfterMs: mapped.retryAfterMs
          })
        );

        if (!shouldRetry) throw mapped;
        if (mapped.code === "AI_PROVIDER_ERROR") {
          await waitForRetry(
            Math.min(30_000, mapped.retryAfterMs ?? 1_000 * attempt),
            request.signal
          );
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

  private async requestCompletion<T>(request: GenerateStructuredRequest<T>): Promise<string> {
    const controller = new AbortController();
    let callerAborted = false;
    let timedOut = false;
    const onCallerAbort = () => {
      callerAborted = true;
      controller.abort();
    };
    if (request.signal?.aborted) throw this.cancelledError(request.operation);
    request.signal?.addEventListener("abort", onCallerAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, request.timeoutMs ?? this.config.aiTimeoutMs);

    try {
      let response: Response;
      try {
        response = await this.sendRequest(request, controller.signal, "strict");
      } catch (error) {
        if (callerAborted || request.signal?.aborted) throw this.cancelledError(request.operation);
        if (timedOut) throw this.timeoutError(request.operation);
        throw error;
      }
      if (callerAborted || request.signal?.aborted) throw this.cancelledError(request.operation);
      if (timedOut) throw this.timeoutError(request.operation);

      if (!response.ok) {
        const failure = await this.readFailure(response);
        if (response.status === 400 && failure.code === "json_validate_failed") {
          response = await this.sendRequest(request, controller.signal, "best-effort");
        }
      }

      if (!response.ok) {
        const failure = await this.readFailure(response);
        if (response.status === 400 && failure.code === "json_validate_failed") {
          response = await this.sendRequest(request, controller.signal, "json-object");
        }
      }

      if (!response.ok) {
        const failure = await this.readFailure(response);
        throw new AiProviderException({
          code: "AI_PROVIDER_ERROR",
          message:
            `Groq request failed with status ${response.status}` +
            (failure.reason ? ` (${failure.reason})` : ""),
          provider: PROVIDER_NAME,
          operation: request.operation,
          retryable:
            TRANSIENT_STATUS_CODES.has(response.status) ||
            failure.reason === "structured-output-validation" ||
            failure.reason === "json-generation",
          retryAfterMs: failure.retryAfterMs
        });
      }

      const payload: unknown = await response.json();
      if (callerAborted || request.signal?.aborted) throw this.cancelledError(request.operation);
      if (timedOut) throw this.timeoutError(request.operation);
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
    } catch (error) {
      if (error instanceof AiProviderException) throw error;
      if (callerAborted || request.signal?.aborted) throw this.cancelledError(request.operation);
      if (timedOut) throw this.timeoutError(request.operation);
      throw error;
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  private sendRequest<T>(
    request: GenerateStructuredRequest<T>,
    signal: AbortSignal,
    mode: StructuredOutputMode
  ): Promise<Response> {
    const responseFormat =
      mode === "json-object"
        ? { type: "json_object" }
        : {
            type: "json_schema",
            json_schema: {
              name: request.operation.replace(/[^a-zA-Z0-9_]/g, "_"),
              strict: mode === "strict",
              schema: toStrictJsonSchema(
                convertZodToJsonSchema(request.schema, { $refStrategy: "none" })
              )
            }
          };

    return fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      signal,
      body: JSON.stringify({
        model: this.model,
        temperature: request.temperature ?? DEFAULT_TEMPERATURE,
        messages: [
          { role: "system", content: request.systemInstruction },
          { role: "user", content: request.prompt }
        ],
        response_format: responseFormat
      })
    });
  }

  private async readFailure(
    response: Response
  ): Promise<{ code?: string; reason?: string; retryAfterMs?: number }> {
    try {
      const text = await response.text();
      const parsed: unknown = JSON.parse(text);
      const error = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : {};
      const code = typeof error.code === "string" ? error.code : undefined;
      const message = typeof error.message === "string" ? error.message : "";
      const retryAfterMs = parseRetryAfterMs(response.headers, message);
      if (code === "json_validate_failed") {
        return { code, reason: "structured-output-validation", retryAfterMs };
      }
      if (/schema/i.test(text)) return { code, reason: "invalid-schema", retryAfterMs };
      if (/context|token|prompt|too large/i.test(text)) {
        return { code, reason: "request-size", retryAfterMs };
      }
      if (/model|unsupported/i.test(text)) {
        return { code, reason: "model-compatibility", retryAfterMs };
      }
      if (/rate|quota/i.test(text)) return { code, reason: "rate-limit", retryAfterMs };
      if (/json/i.test(text) && /fail|invalid|generate|validate/i.test(text)) {
        return { code, reason: "json-generation", retryAfterMs };
      }
      return { code, reason: "invalid-request", retryAfterMs };
    } catch {
      return {};
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

  private timeoutError(operation: string): AiProviderException {
    return new AiProviderException({
      code: "AI_TIMEOUT",
      message: "AI provider request timed out",
      provider: PROVIDER_NAME,
      operation,
      retryable: true
    });
  }

  private cancelledError(operation: string): AiProviderException {
    return new AiProviderException({
      code: "AI_CANCELLED",
      message: "AI provider request was cancelled",
      provider: PROVIDER_NAME,
      operation,
      retryable: false
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

function waitForRetry(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function parseRetryAfterMs(headers: Headers, message: string): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  }

  const tokenReset = headers.get("x-ratelimit-reset-tokens");
  const tokenResetMs = tokenReset ? parseDurationMs(tokenReset) : undefined;
  if (tokenResetMs !== undefined) return tokenResetMs;

  const messageMatch = message.match(/try again in\s+([\d.]+)\s*(ms|s|m)/i);
  return messageMatch ? parseDurationMs(messageMatch[1]! + messageMatch[2]!) : undefined;
}

function parseDurationMs(value: string): number | undefined {
  const match = value.trim().match(/^([\d.]+)\s*(ms|s|m)$/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return undefined;

  const unit = match[2]!.toLowerCase();
  const multiplier = unit === "m" ? 60_000 : unit === "s" ? 1_000 : 1;
  return Math.ceil(amount * multiplier);
}
