import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { AiProviderException } from "./ai-provider.exception";
import { FallbackAiService } from "./fallback-ai.service";

const request = {
  operation: "generate-story",
  systemInstruction: "Return structured data.",
  prompt: "Generate the requested story.",
  schema: z.object({ ok: z.boolean() }),
  modelClass: "reasoning" as const
};

function provider(result: unknown) {
  return {
    generateStructured:
      result instanceof Error
        ? vi.fn().mockRejectedValue(result)
        : vi.fn().mockResolvedValue(result)
  };
}

describe("FallbackAiService", () => {
  it("returns the primary structured result without calling fallback", async () => {
    const primary = provider({ ok: true });
    const fallback = provider({ ok: false });
    const service = new FallbackAiService(primary, fallback);

    await expect(service.generateStructured(request)).resolves.toEqual({ ok: true });
    expect(fallback.generateStructured).not.toHaveBeenCalled();
  });

  it("uses fallback after a retryable provider failure", async () => {
    const primary = provider(
      new AiProviderException({
        code: "AI_PROVIDER_ERROR",
        message: "Provider unavailable",
        provider: "primary",
        operation: request.operation,
        retryable: true
      })
    );
    const fallback = provider({ ok: true });
    const service = new FallbackAiService(primary, fallback);

    await expect(service.generateStructured(request)).resolves.toEqual({ ok: true });
    expect(fallback.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "generate-story-fallback" })
    );
  });

  it("keeps using fallback during the primary cooldown", async () => {
    let now = 1_000;
    const primaryFailure = new AiProviderException({
      code: "AI_PROVIDER_ERROR",
      message: "Provider unavailable",
      provider: "primary",
      operation: request.operation,
      retryable: true
    });
    const primary = {
      generateStructured: vi
        .fn()
        .mockRejectedValueOnce(primaryFailure)
        .mockResolvedValue({ ok: true })
    };
    const fallback = provider({ ok: false });
    const service = new FallbackAiService(primary, fallback, 60_000, () => now);

    await expect(service.generateStructured(request)).resolves.toEqual({ ok: false });
    await expect(
      service.generateStructured({ ...request, operation: "generate-question" })
    ).resolves.toEqual({ ok: false });
    expect(primary.generateStructured).toHaveBeenCalledTimes(1);

    now += 60_000;
    await expect(service.generateStructured(request)).resolves.toEqual({ ok: true });
    expect(primary.generateStructured).toHaveBeenCalledTimes(2);
  });

  it("falls back when the primary exhausts retryable invalid responses", async () => {
    const error = new AiProviderException({
      code: "AI_INVALID_RESPONSE",
      message: "Primary output did not match the schema",
      provider: "primary",
      operation: request.operation,
      retryable: true
    });
    const fallback = provider({ ok: true });
    const service = new FallbackAiService(provider(error), fallback);

    await expect(service.generateStructured(request)).resolves.toEqual({ ok: true });
    expect(fallback.generateStructured).toHaveBeenCalledOnce();
  });

  it("does not fall back for cancellation", async () => {
    const error = new AiProviderException({
      code: "AI_CANCELLED",
      message: "Request was cancelled",
      provider: "primary",
      operation: request.operation,
      retryable: true
    });
    const fallback = provider({ ok: true });
    const service = new FallbackAiService(provider(error), fallback);

    await expect(service.generateStructured(request)).rejects.toBe(error);
    expect(fallback.generateStructured).not.toHaveBeenCalled();
  });
});
