import { ApiClientError } from "@/lib/api/api-client";

const RETRYABLE_ANALYSIS_CODES = new Set([
  "RESUME_ANALYSIS_TIMEOUT",
  "RESUME_ANALYSIS_UNAVAILABLE",
  "RESUME_VISUAL_EXTRACTION_UNAVAILABLE"
]);

/** Retry transient resume processing failures, never user errors or rate limits. */
export function shouldAutoRetryResumeAnalysis(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.status !== 429 &&
    RETRYABLE_ANALYSIS_CODES.has(error.code)
  );
}
