import { describe, expect, it } from "vitest";
import {
  resumeEditorLanguage,
  resumeExecutionLanguage,
  resumeSyntaxLanguage
} from "./resume-live-workspace";

describe("resume code language mapping", () => {
  it("uses TypeScript syntax and execution without widening DSA editor languages", () => {
    expect(resumeEditorLanguage("TypeScript")).toBe("javascript");
    expect(resumeSyntaxLanguage("TypeScript")).toBe("typescript");
    expect(resumeExecutionLanguage("TypeScript")).toBe("typescript");
  });

  it("keeps ordinary supported languages unchanged", () => {
    expect(resumeEditorLanguage("Python")).toBe("python");
    expect(resumeSyntaxLanguage("Python")).toBe("python");
    expect(resumeExecutionLanguage("Python")).toBe("python");
  });

  it("falls back safely for a language the runner does not support", () => {
    expect(resumeEditorLanguage("Go")).toBe("javascript");
    expect(resumeSyntaxLanguage("Go")).toBe("javascript");
    expect(resumeExecutionLanguage("Go")).toBe("javascript");
  });
});
