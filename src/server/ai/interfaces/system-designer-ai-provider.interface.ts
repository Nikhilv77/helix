import type { ZodType, ZodTypeDef } from "zod";

export type AiModelClass = "fast" | "reasoning";

export interface AiInlineAttachment {
  mimeType: string;
  data: string;
}

/**
 * Provider-safe telemetry for one AI attempt. It intentionally contains no
 * prompt, response, candidate text, or credentials, so it can be persisted and
 * exported to production observability without leaking interview content.
 */
export interface AiCallTrace {
  provider: string;
  operation: string;
  model: string;
  modelClass: AiModelClass;
  attempt: number;
  maxAttempts: number;
  durationMs: number;
  outcome: "success" | "failure";
  errorCode?: string;
  retryable?: boolean;
}

export interface GenerateStructuredRequest<T> {
  operation: string;
  systemInstruction: string;
  prompt: string;
  /** Parsed from an unknown provider response, so input and output types differ. */
  schema: ZodType<T, ZodTypeDef, unknown>;
  modelClass: AiModelClass;
  temperature?: number;
  attachments?: AiInlineAttachment[];
  /** Overrides AI_TIMEOUT_MS so a caller with its own deadline can stay inside it. */
  timeoutMs?: number;
  /** Overrides AI_MAX_RETRIES + 1 for this call only. */
  maxAttempts?: number;
  /**
   * Sends a second identical request if the first has not answered within this
   * many milliseconds, and uses whichever succeeds first. For short calls a
   * learner waits on, where a stalled request would otherwise hold the whole
   * timeout. Providers without support ignore it.
   */
  hedgeAfterMs?: number;
  /** Cancels this request without retrying or exposing provider details. */
  signal?: AbortSignal;
  /** Receives metadata only; providers must never include prompt or response content. */
  onTrace?: (trace: AiCallTrace) => void;
}

export interface SystemDesignerAIProvider {
  generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T>;
}
