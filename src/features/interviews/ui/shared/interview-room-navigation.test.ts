import { describe, expect, it } from "vitest";
import { sessionRoomHref } from "./interview-room-navigation";

describe("sessionRoomHref", () => {
  it("sends typed Practice checkpoints to their own rooms", () => {
    expect(
      sessionRoomHref("s1", { storyPracticeAssessment: { practice: "architecture-design" } })
    ).toBe("/practice/architecture-design/assessment?session=s1");
    expect(
      sessionRoomHref("s1", { storyPracticeAssessment: { practice: "applied-engineering" } })
    ).toBe("/practice/applied-engineering/assessment?session=s1");
    expect(
      sessionRoomHref("s1", { storyPracticeAssessment: { practice: "core-technical" } })
    ).toBe("/practice/core-technical/assessment?session=s1");
    expect(sessionRoomHref("s1", { dsaBlockAssessment: { kind: "dsa-block-assessment" } })).toBe(
      "/practice/dsa/assessment?session=s1"
    );
  });

  it("keeps interviews and voice story-track checkpoints in the voice room", () => {
    expect(sessionRoomHref("s1")).toBe("/interview/voice?session=s1");
    expect(sessionRoomHref("s1", { storyPracticeAssessment: { practice: "story-track" } })).toBe(
      "/interview/voice?session=s1"
    );
  });
});
