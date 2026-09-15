import { describe, expect, it } from "vitest";
import {
  LIVE_CANDIDATE_TURN_COMMIT_GRACE_MS,
  LIVE_DECISION_DEADLINE_MS,
  LIVE_END_OF_SPEECH_SILENCE_MS,
  LIVE_EVALUATION_DEADLINE_MS
} from "./voice-turn-timing";

describe("live interview turn timing", () => {
  it("keeps silence and server work inside a conversational latency budget", () => {
    expect(LIVE_END_OF_SPEECH_SILENCE_MS).toBe(900);
    expect(LIVE_DECISION_DEADLINE_MS).toBeLessThan(2_000);
    expect(LIVE_EVALUATION_DEADLINE_MS).toBeLessThanOrEqual(LIVE_DECISION_DEADLINE_MS);
    expect(
      LIVE_END_OF_SPEECH_SILENCE_MS + LIVE_CANDIDATE_TURN_COMMIT_GRACE_MS
    ).toBeGreaterThanOrEqual(1_800);
    expect(
      LIVE_END_OF_SPEECH_SILENCE_MS +
        LIVE_CANDIDATE_TURN_COMMIT_GRACE_MS +
        LIVE_DECISION_DEADLINE_MS
    ).toBeLessThanOrEqual(4_000);
  });
});
