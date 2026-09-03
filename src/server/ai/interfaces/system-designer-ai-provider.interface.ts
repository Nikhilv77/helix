import type { ZodType, ZodTypeDef } from "zod";

export type AiModelClass = "fast" | "reasoning";

export interface AiInlineAttachment {
  mimeType: string;
  data: string;
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
  /** Cancels this request without retrying or exposing provider details. */
  signal?: AbortSignal;
}

export interface SystemDesignerAIProvider {
  generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T>;
}
