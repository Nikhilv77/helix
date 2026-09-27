import { describe, expect, it } from "vitest";
import { SELECTABLE_TEACHERS } from "@/lib/avatars/personas";
import { staticVoiceUrl } from "@/lib/avatars/static-voice";
import { overviewTourLine } from "./overview-tour";

describe("overviewTourLine", () => {
  it("walks through the Overview cards in page order without naming anyone", () => {
    const line = overviewTourLine();
    expect(line.startsWith("Hi, welcome to Trailgrad.")).toBe(true);
    const positions = ["home base", "sharpen first", "Weekly rhythm", "Next focus"].map((phrase) =>
      line.indexOf(phrase)
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("is pre-recorded for every selectable teacher, so it never uses live speech", () => {
    for (const teacher of SELECTABLE_TEACHERS) {
      expect(staticVoiceUrl(overviewTourLine(), teacher.id), teacher.id).toBeTruthy();
    }
  });
});
