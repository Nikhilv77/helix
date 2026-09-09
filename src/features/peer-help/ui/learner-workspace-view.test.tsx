import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LearnerWorkspaceView } from "./learner-workspace-view";

describe("LearnerWorkspaceView", () => {
  afterEach(cleanup);

  it("shows the live code selection and latest test state in the helper workspace", () => {
    render(
      <LearnerWorkspaceView
        captured={null}
        snapshot={{
          v: 3,
          streamId: "stream-1",
          seq: 3,
          at: Date.now(),
          receivedAt: Date.now(),
          language: "javascript",
          code: "function solve() {\n  const answer = 42;\n  return answer;\n}",
          testOutput: "Expected 7, received 42",
          failingTests: 2,
          selection: {
            startLineNumber: 2,
            startColumn: 3,
            endLineNumber: 3,
            endColumn: 16
          }
        }}
      />
    );

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Lines 2–3")).toBeTruthy();
    expect(screen.getByText("2 failing")).toBeTruthy();
    expect(screen.getByText("Expected 7, received 42")).toBeTruthy();
    expect(screen.getByLabelText("Candidate code, read only")).toBeTruthy();
  });
});
