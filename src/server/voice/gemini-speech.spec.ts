import { describe, expect, it } from "vitest";
import { geminiQuotaRetryAfterMs } from "./gemini-speech";

const dailyRefusal = new Error(
  '{"error":{"code":429,"message":"You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 10. Please retry in 3.13s.","status":"RESOURCE_EXHAUSTED","details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}'
);

describe("geminiQuotaRetryAfterMs", () => {
  it("waits until midnight Pacific time for a daily quota", () => {
    // 10:00 PDT is 17:00 UTC, fourteen hours before the reset.
    const now = new Date("2026-09-26T17:00:00.000Z");
    expect(geminiQuotaRetryAfterMs(dailyRefusal, now)).toBe(14 * 60 * 60 * 1_000);
  });

  it("uses the suggested delay for a short-window quota", () => {
    const perMinute = new Error(
      '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Please retry in 3.13s.","details":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel"}]}}'
    );
    expect(geminiQuotaRetryAfterMs(perMinute)).toBe(3_130);
  });

  it("recognises a typed 429 without a message body", () => {
    expect(geminiQuotaRetryAfterMs(Object.assign(new Error("Too many"), { status: 429 }))).toBe(
      60_000
    );
  });

  it("ignores failures that are not quota refusals", () => {
    expect(geminiQuotaRetryAfterMs(new Error("socket hang up"))).toBeNull();
    expect(geminiQuotaRetryAfterMs(Object.assign(new Error("Bad"), { status: 400 }))).toBeNull();
  });
});
