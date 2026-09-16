import { describe, expect, it } from "vitest";
import { technicalProjectsMoveOnUtterance } from "./technical-projects-dialogue";
import type { PlannedQuestion } from "./types";

function question(
  text: string,
  metadata: Pick<PlannedQuestion, "technicalProjectsSection" | "projectAct">
): PlannedQuestion {
  return { text, mustHit: [], probeIfMissing: "What happened next?", ...metadata };
}

describe("technical projects dialogue", () => {
  it("moves through technical checks without revealing a grade", () => {
    const utterance = technicalProjectsMoveOnUtterance(
      {
        phase: "questioning",
        questionIndex: 1,
        plan: [
          question("First scenario", { technicalProjectsSection: "technical-calibration" }),
          question("Second scenario", { technicalProjectsSection: "technical-calibration" })
        ]
      },
      "Noted."
    );

    expect(utterance).toBe("Noted. Let's take the next technical scenario. Second scenario");
    expect(utterance).not.toMatch(/correct|incorrect|answer key/i);
  });

  it("bridges once from calibration into the grounded project", () => {
    const utterance = technicalProjectsMoveOnUtterance(
      {
        phase: "questioning",
        questionIndex: 1,
        plan: [
          question("Final scenario", { technicalProjectsSection: "technical-calibration" }),
          question("Set the project context.", {
            technicalProjectsSection: "project-deep-dive",
            projectAct: "context"
          })
        ]
      },
      "Understood."
    );

    expect(utterance).toContain("That completes the technical calibration.");
    expect(utterance).toContain("Set the project context.");
  });

  it("uses connected pressure-test transitions and a report-oriented close", () => {
    const pressureTest = technicalProjectsMoveOnUtterance(
      {
        phase: "questioning",
        questionIndex: 1,
        plan: [
          question("Trace it.", {
            technicalProjectsSection: "project-deep-dive",
            projectAct: "mechanism"
          }),
          question("What failed?", {
            technicalProjectsSection: "project-deep-dive",
            projectAct: "failure"
          })
        ]
      },
      "Clear."
    );
    const close = technicalProjectsMoveOnUtterance(
      { phase: "done", questionIndex: 2, plan: [] },
      "Thanks."
    );

    expect(pressureTest).toBe("Clear. Now let's pressure-test that path. What failed?");
    expect(close).toContain("That completes the technical and project round.");
    expect(close).toContain("separate the technical calibration");
  });
});
