import { describe, expect, it } from "vitest";
import {
  formatResumeIdentitySummary,
  RESUME_IDENTITY_SUMMARY_FALLBACK
} from "./resume-identity-copy";

describe("formatResumeIdentitySummary", () => {
  it("keeps a personalized resume heading within fifteen words", () => {
    const summary =
      "AI Engineer with 2.5 years of experience building production RAG systems, evaluation pipelines, and FastAPI services.";

    expect(formatResumeIdentitySummary(summary)).toBe(
      "AI Engineer with 2.5 years of experience building production RAG systems, evaluation pipelines, and FastAPI…"
    );
  });

  it("normalizes whitespace from extracted resume copy", () => {
    expect(formatResumeIdentitySummary("AI Engineer\n  building   retrieval systems.")).toBe(
      "AI Engineer building retrieval systems."
    );
  });

  it("caps a long model summary at fifteen words", () => {
    const result = formatResumeIdentitySummary(
      "Experienced AI engineer who owns production retrieval systems, evaluation pipelines, model serving, observability, mentoring, architecture, and delivery."
    );

    expect(result).toBe(
      "Experienced AI engineer who owns production retrieval systems, evaluation pipelines, model serving, observability, mentoring, architecture…"
    );
    expect(result.replace("…", "").split(" ")).toHaveLength(15);
  });

  it("falls back only when no extracted context exists", () => {
    expect(formatResumeIdentitySummary("   ")).toBe(RESUME_IDENTITY_SUMMARY_FALLBACK);
  });
});
