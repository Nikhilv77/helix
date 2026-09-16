import { describe, expect, it } from "vitest";
import { voiceUrl } from "./use-maya-voice";

describe("voiceUrl", () => {
  it("requests the streaming delivery path for time-sensitive James speech", () => {
    expect(voiceUrl("The analysis is ready.", "james", "fast")).toContain("delivery=fast");
  });

  it("keeps ordinary James lines on the quality voice path", () => {
    expect(voiceUrl("Which position are you targeting?", "james")).not.toContain("delivery=");
  });
});
