import { presentHelpInboxRequest, type HelpInboxRow } from "./help-inbox-presenter";

function row(overrides: Partial<HelpInboxRow> = {}): HelpInboxRow {
  return {
    id: "request-1",
    questionSlug: "two-sum",
    language: "typescript",
    status: "OPEN",
    summary: JSON.stringify({
      headline: "The duplicate case still fails.",
      understands: ["They can scan the input."],
      blockedOn: "The repeated-value case does not return a pair.",
      estimatedMinutes: 6,
      opener: "What changes when both values are the same?"
    }),
    context: {
      code: "export function solve() { return []; }",
      testOutput: "Expected [0, 1], received []",
      failingTests: 1,
      hintsUsed: 2,
      timeSpentMs: 300_000
    },
    createdAt: new Date("2026-08-26T12:00:00Z"),
    ...overrides
  };
}

describe("help inbox presentation", () => {
  it("never exposes source or raw test output in an open request preview", () => {
    const presented = presentHelpInboxRequest(row(), false);

    expect(presented.headline).toBe("The duplicate case still fails.");
    expect(presented.capturedWorkspace).toBeNull();
    expect(JSON.stringify(presented)).not.toContain("export function solve");
    expect(JSON.stringify(presented)).not.toContain("Expected [0, 1]");
  });

  it("includes the captured read-only workspace after the helper owns the request", () => {
    const presented = presentHelpInboxRequest(row({ status: "CLAIMED" }), true);

    expect(presented.capturedWorkspace).toEqual({
      code: "export function solve() { return []; }",
      language: "typescript",
      testOutput: "Expected [0, 1], received []",
      failingTests: 1,
      selection: null,
      runStatus: null,
      tests: null
    });
  });

  it("renders old or malformed rows safely", () => {
    const presented = presentHelpInboxRequest(
      row({ questionSlug: "missing-question", summary: "not-json", context: null }),
      true
    );

    expect(presented.title).toBe("missing-question");
    expect(presented.headline).toBeNull();
    expect(presented.hintsUsed).toBe(0);
    expect(presented.capturedWorkspace).toEqual({
      code: "",
      language: "typescript",
      testOutput: null,
      failingTests: null,
      selection: null,
      runStatus: null,
      tests: null
    });
  });
});
