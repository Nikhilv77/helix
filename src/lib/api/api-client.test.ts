import { describe, expect, it, vi } from "vitest";
import { ApiClientError, withTurnRetries } from "./api-client";

const noWait = () => Promise.resolve();

function apiError(status: number, code: string, details: Record<string, unknown> = {}) {
  return new ApiClientError({ status, code, message: code, details });
}

describe("interview turn retries", () => {
  it("retries a dropped request and returns the replayed turn", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ utterance: "Next question." });

    await expect(withTurnRetries(attempt, noWait)).resolves.toEqual({
      utterance: "Next question."
    });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("retries server errors and a turn that is still being saved", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(apiError(504, "REQUEST_FAILED"))
      .mockRejectedValueOnce(apiError(409, "ANSWER_IN_PROGRESS", { retryable: true }))
      .mockResolvedValueOnce("saved");

    await expect(withTurnRetries(attempt, noWait)).resolves.toBe("saved");
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("does not retry a conflict or a validation error", async () => {
    for (const error of [
      apiError(409, "SESSION_VERSION_CONFLICT", { retryable: false }),
      apiError(400, "BAD_REQUEST")
    ]) {
      const attempt = vi.fn().mockRejectedValue(error);
      await expect(withTurnRetries(attempt, noWait)).rejects.toBe(error);
      expect(attempt).toHaveBeenCalledTimes(1);
    }
  });

  it("gives up after the last retry", async () => {
    const attempt = vi.fn().mockRejectedValue(apiError(503, "REQUEST_FAILED"));
    await expect(withTurnRetries(attempt, noWait)).rejects.toMatchObject({ status: 503 });
    expect(attempt).toHaveBeenCalledTimes(4);
  });
});
