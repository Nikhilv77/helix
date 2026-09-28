import { nextInterviewSessionAt } from "./load-interviews-home";
import type { InterviewsHomeData } from "@/features/interviews/contracts/interviews-home";

const HOUR = 60 * 60 * 1000;
const now = 100 * HOUR;

function data(quotaStartedAt: number[], limit = 2): InterviewsHomeData {
  return {
    firstName: "",
    quota: { used: quotaStartedAt.length, limit },
    quotaStartedAt,
    sessions: [],
    roadmapSessions: []
  };
}

describe("next interview round time", () => {
  it("is empty while rounds remain today", () => {
    expect(nextInterviewSessionAt(data([now - HOUR]), now)).toBeNull();
  });

  it("opens when the oldest counted start leaves the 24-hour window", () => {
    expect(nextInterviewSessionAt(data([now - 2 * HOUR, now - 20 * HOUR]), now)).toBe(
      now - 20 * HOUR + 24 * HOUR
    );
  });

  it("ignores starts that already left the window", () => {
    expect(nextInterviewSessionAt(data([now - 30 * HOUR, now - HOUR]), now)).toBeNull();
  });
});
