import { describe, expect, it } from "vitest";
import { signResumePreview, verifyResumePreview } from "./resume-preview-token";

const SECRET = "a-long-test-secret-used-only-for-preview-signatures";
const NOW = Date.UTC(2026, 8, 3, 12);
const preview = {
  resumeFile: { fileName: "resume.pdf", contentFingerprint: `sha256-${"a".repeat(64)}` },
  extraction: { fullName: "Test Candidate", skills: ["TypeScript"] }
};

describe("resume preview signatures", () => {
  it("binds the exact preview and owner until expiry", () => {
    const signed = signResumePreview(preview, "user-a", SECRET, NOW);
    expect(
      verifyResumePreview(
        preview,
        "user-a",
        signed.previewExpiresAt,
        signed.confirmationToken,
        SECRET,
        NOW + 1
      )
    ).toBe(true);
    expect(
      verifyResumePreview(
        { ...preview, extraction: { ...preview.extraction, skills: ["Rust"] } },
        "user-a",
        signed.previewExpiresAt,
        signed.confirmationToken,
        SECRET,
        NOW + 1
      )
    ).toBe(false);
    expect(
      verifyResumePreview(
        preview,
        "user-b",
        signed.previewExpiresAt,
        signed.confirmationToken,
        SECRET,
        NOW + 1
      )
    ).toBe(false);
    expect(
      verifyResumePreview(
        preview,
        "user-a",
        signed.previewExpiresAt,
        signed.confirmationToken,
        SECRET,
        signed.previewExpiresAt + 1
      )
    ).toBe(false);
  });

  it("survives object key reordering during request validation", () => {
    const signed = signResumePreview(preview, "user-a", SECRET, NOW);
    const reordered = {
      extraction: { skills: ["TypeScript"], fullName: "Test Candidate" },
      resumeFile: {
        contentFingerprint: `sha256-${"a".repeat(64)}`,
        fileName: "resume.pdf"
      }
    };

    expect(
      verifyResumePreview(
        reordered,
        "user-a",
        signed.previewExpiresAt,
        signed.confirmationToken,
        SECRET,
        NOW + 1
      )
    ).toBe(true);
  });

  it("allows small clock differences between server instances", () => {
    const signed = signResumePreview(preview, "user-a", SECRET, NOW);

    expect(
      verifyResumePreview(
        preview,
        "user-a",
        signed.previewExpiresAt,
        signed.confirmationToken,
        SECRET,
        NOW - 30_000
      )
    ).toBe(true);
  });
});
