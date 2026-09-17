import { describe, expect, it } from "vitest";
import type { DsaRunResult } from "../types";
import { codeRunAcknowledgement } from "./voice-interview";

function result(overrides: Partial<DsaRunResult> = {}): DsaRunResult {
  return {
    status: "Accepted",
    accepted: true,
    stdout: "",
    stderr: "",
    compileOutput: "",
    time: "0.01",
    memory: 512,
    tests: [],
    ...overrides
  };
}

describe("codeRunAcknowledgement", () => {
  it("reports supplied test progress without claiming hidden correctness", () => {
    const acknowledgement = codeRunAcknowledgement(
      result({
        accepted: false,
        tests: [
          {
            index: 0,
            input: "a",
            expectedOutput: "true",
            actualOutput: "true",
            passed: true,
            error: null
          },
          {
            index: 1,
            input: "b",
            expectedOutput: "false",
            actualOutput: "true",
            passed: false,
            error: null
          }
        ]
      })
    );

    expect(acknowledgement).toContain("1 of 2 supplied tests passed");
    expect(acknowledgement).not.toMatch(/correct|solved/i);
  });

  it("distinguishes compilation errors from successful untested execution", () => {
    expect(
      codeRunAcknowledgement(result({ accepted: false, compileOutput: "SyntaxError" }))
    ).toContain("did not compile");
    expect(codeRunAcknowledgement(result())).toContain("ran successfully");
  });
});
