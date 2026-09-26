import { describe, expect, it } from "vitest";
import { ALL_TEACHER_LINES, pickLine, TEACHER_LINES } from "./teacher-lines";

describe("teacher lines", () => {
  it("contains only fixed, speakable text that can be pre-recorded", () => {
    expect(ALL_TEACHER_LINES.length).toBeGreaterThan(50);
    for (const line of ALL_TEACHER_LINES) {
      expect(line.trim().length).toBeGreaterThan(10);
      // A placeholder or number would mean the line depends on learner data.
      expect(line, line).not.toMatch(/\$\{|\{\w+\}|\d/);
    }
  });

  it("offers more than one phrasing for the moments learners hear repeatedly", () => {
    for (const variants of [
      TEACHER_LINES.interviewDebrief,
      ...Object.values(TEACHER_LINES.reportSummary),
      ...Object.values(TEACHER_LINES.interviewLaunch),
      TEACHER_LINES.progress.streak
    ]) {
      expect(variants.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("picks only from the given phrasings", () => {
    const variants = TEACHER_LINES.reportSummary.strong;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(variants).toContain(pickLine(variants));
    }
  });
});
