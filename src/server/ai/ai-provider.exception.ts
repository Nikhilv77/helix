export type AiProviderErrorCode =
  | "AI_INVALID_EMBEDDING_RESPONSE"
  | "AI_INVALID_RESPONSE"
  | "AI_PROVIDER_ERROR"
  | "AI_TIMEOUT"
  | "AI_CANCELLED";

interface AiProviderExceptionOptions {
  code: AiProviderErrorCode;
  message: string;
  provider: string;
  operation: string;
  retryable: boolean;
  cause?: unknown;
}

export class AiProviderException extends Error {
  readonly code: AiProviderErrorCode;
  readonly provider: string;
  readonly operation: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(options: AiProviderExceptionOptions) {
    super(options.message);
    this.name = AiProviderException.name;
    this.code = options.code;
    this.provider = options.provider;
    this.operation = options.operation;
    this.retryable = options.retryable;
    this.cause = options.cause;
  }
}
