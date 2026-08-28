import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HelpTestResults } from "./help-test-results";

describe("HelpTestResults", () => {
  it("shows the candidate's individual case result and console output", () => {
    render(
      <HelpTestResults
        running={false}
        error={null}
        workspace={{
          code: "function containsDuplicate() {}",
          language: "javascript",
          testOutput: "checked 1 case",
          failingTests: 0,
          selection: null,
          runStatus: "1/1 tests passed",
          tests: [
            {
              index: 0,
              input: "nums = [1, 2, 3, 1]",
              expectedOutput: "true",
              actualOutput: "true",
              passed: true,
              error: null
            }
          ]
        }}
      />
    );

    expect(screen.getByText("1/1 tests passed")).toBeInTheDocument();
    expect(screen.getByText("Case 1")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("checked 1 case")).toBeInTheDocument();
  });
});
