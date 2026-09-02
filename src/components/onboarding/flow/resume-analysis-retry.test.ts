import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api/api-client";
import { shouldAutoRetryResumeAnalysis } from "./resume-analysis-retry";

function apiError(code: string, status: number) {
  return new ApiClientError({ code, status, message: code });
}

describe("shouldAutoRetryResumeAnalysis", () => {
  it("retries transient text and visual analysis failures", () => {
    expect(shouldAutoRetryResumeAnalysis(apiError("RESUME_ANALYSIS_UNAVAILABLE", 503))).toBe(true);
    expect(shouldAutoRetryResumeAnalysis(apiError("RESUME_ANALYSIS_TIMEOUT", 504))).toBe(true);
    expect(shouldAutoRetryResumeAnalysis(apiError("RESUME_VISUAL_EXTRACTION_UNAVAILABLE", 503))).toBe(
      true
    );
  });

  it("never retries a resume upload rate limit", () => {
    expect(shouldAutoRetryResumeAnalysis(apiError("RESUME_UPLOAD_RATE_LIMITED", 429))).toBe(false);
  });

  it("does not retry permanent document failures", () => {
    expect(shouldAutoRetryResumeAnalysis(apiError("RESUME_NOT_VERIFIED", 422))).toBe(false);
    expect(shouldAutoRetryResumeAnalysis(apiError("RESUME_UPLOAD_FAILED", 503))).toBe(false);
  });
});
