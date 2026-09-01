import { describe, expect, it } from "vitest";
import type { CandidateResume } from "@/lib/shared/types";
import {
  MIN_RESUME_CONFIDENCE,
  buildSlots,
  renderPrompt,
  type PersonalizationContext
} from "./prompt-personalization";

function resume(overrides: Partial<CandidateResume> = {}): CandidateResume {
  return {
    fileName: "cv.pdf",
    uploadedAt: 0,
    confidence: 0.9,
    fullName: "A Candidate",
    skills: [],
    warnings: [],
    experience: [
      {
        organization: "Acme Retail",
        role: "Engineer",
        period: "2023",
        location: "Remote",
        summary: "",
        achievements: [],
        skills: ["React", "Node"]
      }
    ],
    education: [],
    projects: [
      { name: "Commerce API", summary: "", outcome: "", skills: ["React"] }
    ],
    achievements: [],
    practiceQuestions: [],
    roadmap: [],
    document: {} as CandidateResume["document"],
    evidence: {} as CandidateResume["evidence"],
    interviewKit: null,
    ...overrides
  };
}

function context(overrides: Partial<PersonalizationContext> = {}): PersonalizationContext {
  return {
    resume: resume(),
    resumeConfidence: 0.9,
    targetCompany: "Flipkart",
    level: "3-5",
    editorLanguage: "javascript",
    ...overrides
  };
}

const QUESTION = {
  prompt: "A list re-renders on every keystroke. Find the cause.",
  promptTemplate: "A {{framework}} list in {{projectName}} re-renders on every keystroke."
};

describe("buildSlots", () => {
  it("picks the most frequent skill across experience and projects", () => {
    // React appears in both entries, Node only once.
    expect(buildSlots(context()).framework).toBe("React");
  });

  it("resolves ties deterministically so a prompt does not change between views", () => {
    const tied = resume({
      experience: [
        {
          organization: "Acme",
          role: "Engineer",
          period: "",
          location: "",
          summary: "",
          achievements: [],
          skills: ["Vue", "Svelte"]
        }
      ],
      projects: []
    });
    const first = buildSlots(context({ resume: tied })).framework;
    const second = buildSlots(context({ resume: tied })).framework;
    expect(first).toBe(second);
  });

  it("returns null slots rather than empty strings when the resume is absent", () => {
    const slots = buildSlots(context({ resume: null }));
    expect(slots.framework).toBeNull();
    expect(slots.projectName).toBeNull();
    expect(slots.employer).toBeNull();
  });
});

describe("renderPrompt", () => {
  it("fills every slot when the resume supports it", () => {
    expect(renderPrompt(QUESTION, context())).toBe(
      "A React list in Commerce API re-renders on every keystroke."
    );
  });

  it("returns the generic prompt when there is no template", () => {
    expect(renderPrompt({ prompt: QUESTION.prompt }, context())).toBe(QUESTION.prompt);
  });

  it("falls back entirely rather than rendering a half-filled template", () => {
    const noProjects = resume({ projects: [] });
    expect(renderPrompt(QUESTION, context({ resume: noProjects }))).toBe(QUESTION.prompt);
  });

  it("does not personalize below the confidence threshold", () => {
    const low = context({ resumeConfidence: MIN_RESUME_CONFIDENCE - 0.01 });
    expect(renderPrompt(QUESTION, low)).toBe(QUESTION.prompt);
  });

  it("does not personalize when confidence is unknown", () => {
    expect(renderPrompt(QUESTION, context({ resumeConfidence: null }))).toBe(QUESTION.prompt);
  });

  it("falls back on an unknown slot name instead of leaving a gap", () => {
    const bad = { prompt: QUESTION.prompt, promptTemplate: "Tell me about {{favouriteColour}}." };
    expect(renderPrompt(bad, context())).toBe(QUESTION.prompt);
  });

  it("never leaves an unrendered slot in the output", () => {
    const output = renderPrompt(QUESTION, context());
    expect(output).not.toMatch(/\{\{|\}\}/);
  });

  it("falls back on the legacy single-brace syntax rather than printing it", () => {
    // 20 questions in the bank predate this resolver and use {resume.x} style
    // slots. Rendering those verbatim would show a placeholder to a candidate.
    const legacy = {
      prompt: "Explain the event loop.",
      promptTemplate: "In {resume.projectOrRole}, where did async behavior matter?"
    };
    expect(renderPrompt(legacy, context())).toBe(legacy.prompt);
  });

  it("falls back on a mixed template rather than half-rendering it", () => {
    const mixed = {
      prompt: "Generic.",
      promptTemplate: "A {{framework}} app at {targetRole} scale."
    };
    expect(renderPrompt(mixed, context())).toBe(mixed.prompt);
  });

  it("is stable across calls for the same input", () => {
    expect(renderPrompt(QUESTION, context())).toBe(renderPrompt(QUESTION, context()));
  });
});
