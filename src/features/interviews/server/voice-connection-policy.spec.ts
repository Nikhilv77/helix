import { describe, expect, it } from "vitest";
import { voiceConnectionLifetimeMs } from "./voice-connection-policy";
import type { InterviewSetup } from "./types";

const setup: InterviewSetup = {
  role: "frontend",
  level: "3-5",
  roundType: "technical",
  intensity: "realistic",
  context: ""
};

describe("voice connection lifetime", () => {
  it("expires an ordinary interview against its original deadline", () => {
    expect(
      voiceConnectionLifetimeMs(
        { phase: "questioning", setup, startedAt: 1_000 },
        1_000 + 15 * 60_000 + 1
      )
    ).toBe(-1);
  });

  it("gives an incomplete DSA block assessment a fresh bounded lease when resumed", () => {
    const blockSetup: InterviewSetup = {
      ...setup,
      durationMinutes: 40,
      dsaBlockAssessment: {
        kind: "dsa-block-assessment",
        blockId: "11111111-1111-4111-8111-111111111111",
        assessmentId: "22222222-2222-4222-8222-222222222222",
        snapshotVersion: 2,
        rubricVersion: 1
      }
    };

    expect(
      voiceConnectionLifetimeMs(
        { phase: "questioning", setup: blockSetup, startedAt: 1_000 },
        1_000 + 3 * 60 * 60_000
      )
    ).toBe(40 * 60_000);
  });
});
