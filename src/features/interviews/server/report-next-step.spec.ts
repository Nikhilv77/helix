import { describe, expect, it } from "vitest";
import { readInterviewReportSnapshot } from "./report";

describe("saved report next steps", () => {
  it("rewrites the legacy assessor note in an old snapshot when it is read", () => {
    const snapshot = {
      phase: "done",
      lastTurnEndMs: 60_000,
      report: {
        startedAt: 0,
        competencies: [
          { label: "Communication", nextStep: "Work on this next: Failed to provide a career story or employment history" },
          { label: "Ownership", nextStep: "Make your personal contribution explicit." }
        ],
        summary: {
          nextStep: "Work on this next: Failed to provide a career story or employment history"
        }
      }
    } as never;

    const report = readInterviewReportSnapshot(snapshot, 60_000, 120_000);

    expect(report.summary.nextStep).toBe("Next time, provide a career story or employment history.");
    expect(report.competencies.map((item) => item.nextStep)).toEqual([
      "Next time, provide a career story or employment history.",
      "Make your personal contribution explicit."
    ]);
  });
});
