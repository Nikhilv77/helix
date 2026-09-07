import { AiProviderException } from "./ai-provider.exception";
import type { AiService } from "./ai.service";
import type { GenerateStructuredRequest } from "./interfaces/system-designer-ai-provider.interface";

type StructuredAi = Pick<AiService, "generateStructured">;
const DEFAULT_PRIMARY_COOLDOWN_MS = 60_000;

export class FallbackAiService {
  private primaryRetryAfter = 0;

  constructor(
    private readonly primary: StructuredAi,
    private readonly fallback: StructuredAi,
    private readonly primaryCooldownMs = DEFAULT_PRIMARY_COOLDOWN_MS,
    private readonly now: () => number = Date.now
  ) {}

  async generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    if (this.now() < this.primaryRetryAfter) {
      return this.generateDuringPrimaryCooldown(request);
    }

    try {
      return await this.primary.generateStructured(request);
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
        if (!this.shouldRecoverPrimary(fallbackError)) throw fallbackError;
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
      if (!this.shouldRecoverPrimary(fallbackError)) throw fallbackError;
      return this.generateWithPrimaryRecovery(request);
    }
  }

  private generateWithFallback<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    return this.fallback.generateStructured({
      ...request,
      operation: request.operation + "-fallback"
    });
  }

  private async generateWithPrimaryRecovery<T>(
    request: GenerateStructuredRequest<T>
  ): Promise<T> {
    const result = await this.primary.generateStructured({
      ...request,
      operation: request.operation + "-primary-recovery"
    });
    this.primaryRetryAfter = 0;
    return result;
  }

  private shouldRecoverPrimary(error: unknown): boolean {
    return (
      error instanceof AiProviderException &&
      !error.retryable &&
      error.code !== "AI_CANCELLED"
    );
  }
}
