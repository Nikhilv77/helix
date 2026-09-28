import { afterEach, describe, expect, it } from "vitest";
import type { ResumeExtractionResponse } from "@/lib/shared/types";
import { clearOnboardingDraft, readOnboardingDraft, writeOnboardingDraft } from "./onboarding-draft";

const NOW = Date.UTC(2026, 8, 28, 12);

function result(previewExpiresAt: number) {
  return { previewExpiresAt, confirmationToken: "a".repeat(64) } as unknown as ResumeExtractionResponse;
}

describe("onboarding draft", () => {
  afterEach(() => clearOnboardingDraft());

  it("resumes the review with the choices and the unexpired preview", () => {
    writeOnboardingDraft({
      step: "evidence",
      teacherId: "james",
      level: "3-5",
      result: result(NOW + 60 * 60_000)
    });
    expect(readOnboardingDraft(NOW)).toMatchObject({
      step: "evidence",
      teacherId: "james",
      level: "3-5",
      result: { previewExpiresAt: NOW + 60 * 60_000 }
    });
  });

  it("falls back to the upload step when the preview is about to expire", () => {
    writeOnboardingDraft({
      step: "readiness",
      teacherId: "maya",
      level: "fresher",
      result: result(NOW + 60_000)
    });
    expect(readOnboardingDraft(NOW)).toEqual({
      step: "resume",
      teacherId: "maya",
      level: "fresher",
      result: null
    });
  });

  it("forgets everything once cleared, and ignores unreadable data", () => {
    writeOnboardingDraft({ step: "level", teacherId: "maya", level: null, result: null });
    clearOnboardingDraft();
    expect(readOnboardingDraft(NOW)).toBeNull();

    window.sessionStorage.setItem("trailgrad:onboarding-draft", "{not json");
    expect(readOnboardingDraft(NOW)).toBeNull();
  });
});
