import { describe, expect, it } from "vitest";
import type { Turn } from "@/lib/shared/types";
import { blockAssessmentMoment } from "./block-assessment-speech";

const agent = (extra: Partial<Turn> = {}): Turn => ({
  speaker: "agent",
  text: "Full on-screen guidance.",
  startMs: 0,
  endMs: 0,
  ...extra
});
const user = (extra: Partial<Turn> = {}): Turn => ({
  speaker: "user",
  text: "answer",
  startMs: 0,
  endMs: 0,
  ...extra
});
const review = { done: false, kind: "mcq" as const };
const code = { done: false, kind: "code" as const };

describe("block assessment speech", () => {
  it("opens with the greeting before any answer", () => {
    expect(blockAssessmentMoment([agent()], 0, review)).toBe("opening");
  });

  it("gives the verdict and moves to the next quick check", () => {
    const turns = [agent(), user(), agent({ correct: true })];
    expect(blockAssessmentMoment(turns, 2, review)).toBe("reviewCorrectNext");
    turns[2] = agent({ correct: false });
    expect(blockAssessmentMoment(turns, 2, review)).toBe("reviewIncorrectNext");
  });

  it("hands over to the coding problem after the last quick check", () => {
    const turns = [agent(), user(), agent({ correct: false })];
    expect(blockAssessmentMoment(turns, 2, code)).toBe("reviewIncorrectToCode");
  });

  it("follows a submitted or skipped coding problem", () => {
    expect(blockAssessmentMoment([agent(), user(), agent()], 2, code)).toBe("codeNext");
    expect(blockAssessmentMoment([agent(), user({ skipped: true }), agent()], 2, code)).toBe(
      "codeSkippedNext"
    );
  });

  it("closes when the checkpoint is done", () => {
    expect(blockAssessmentMoment([agent(), user(), agent()], 2, { done: true, kind: null })).toBe(
      "done"
    );
  });

  it("leaves unrecognised turns to be read in full", () => {
    expect(blockAssessmentMoment([agent(), user(), agent()], 2, review)).toBeNull();
    expect(blockAssessmentMoment([agent(), user()], 1, review)).toBeNull();
  });
});
