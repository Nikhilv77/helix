import { AiProviderException } from "./ai-provider.exception";
import type { AiService } from "./ai.service";
import type { GenerateStructuredRequest } from "./interfaces/system-designer-ai-provider.interface";

type StructuredAi = Pick<AiService, "generateStructured">;
const DEFAULT_PRIMARY_COOLDOWN_MS = 60_000;

export interface FallbackAiServiceOptions {
  /** Clamp only the primary attempt without shrinking the fallback's budget. */
  primaryTimeoutMs?: number;
  /** Clamp the fallback attempt so failover still has a predictable deadline. */
  fallbackTimeoutMs?: number;
  /** Disable a third request when a latency-sensitive operation has already failed over. */
  recoverPrimaryAfterFallbackFailure?: boolean;
}

export class FallbackAiService {
  private primaryRetryAfter = 0;

  constructor(
    private readonly primary: StructuredAi,
    private readonly fallback: StructuredAi,
    private readonly primaryCooldownMs = DEFAULT_PRIMARY_COOLDOWN_MS,
    private readonly now: () => number = Date.now,
    private readonly options: FallbackAiServiceOptions = {}
  ) {}

  async generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    if (this.now() < this.primaryRetryAfter) {
      return this.generateDuringPrimaryCooldown(request);
    }

    try {
      return await this.primary.generateStructured(
        this.withTimeout(request, this.options.primaryTimeoutMs)
      );
    } catch (error) {
      if (
        !(error instanceof AiProviderException) ||
        !error.retryable ||
        error.code === "AI_CANCELLED"
      ) {
        throw error;
      }
      this.primaryRetryAfter = this.now() + this.primaryCooldownMs;
      try {
        return await this.generateWithFallback(request);
      } catch (fallbackError) {
        if (!this.canRecoverPrimary(fallbackError)) {
          // The fallback could not cover the primary outage. Do not pin the
          // next independent request to that same failed fallback for the
          // remainder of the primary cooldown.
          this.primaryRetryAfter = 0;
          throw fallbackError;
        }
        return this.generateWithPrimaryRecovery(request);
      }
    }
  }

  private async generateDuringPrimaryCooldown<T>(
    request: GenerateStructuredRequest<T>
  ): Promise<T> {
    try {
      return await this.generateWithFallback(request);
    } catch (fallbackError) {
      if (!this.canRecoverPrimary(fallbackError)) {
        this.primaryRetryAfter = 0;
        throw fallbackError;
      }
      return this.generateWithPrimaryRecovery(request);
    }
  }

  private generateWithFallback<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    return this.fallback.generateStructured({
      ...this.withTimeout(request, this.options.fallbackTimeoutMs),
      operation: request.operation + "-fallback"
    });
  }

  private async generateWithPrimaryRecovery<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    const result = await this.primary.generateStructured({
      ...this.withTimeout(request, this.options.primaryTimeoutMs),
      operation: request.operation + "-primary-recovery"
    });
    this.primaryRetryAfter = 0;
    return result;
  }

  private shouldRecoverPrimary(error: unknown): boolean {
    return (
      error instanceof AiProviderException && !error.retryable && error.code !== "AI_CANCELLED"
    );
  }

  private canRecoverPrimary(error: unknown): boolean {
    return (
      this.options.recoverPrimaryAfterFallbackFailure !== false && this.shouldRecoverPrimary(error)
    );
  }

  private withTimeout<T>(
    request: GenerateStructuredRequest<T>,
    timeoutMs: number | undefined
  ): GenerateStructuredRequest<T> {
    if (timeoutMs === undefined) return request;
    return {
      ...request,
      timeoutMs: Math.min(request.timeoutMs ?? timeoutMs, timeoutMs)
    };
  }
}
