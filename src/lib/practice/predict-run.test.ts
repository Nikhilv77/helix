import { describe, expect, it } from "vitest";
import {
  normalizePredictedOutput,
  parsePredictRunAnswerKey,
  predictionMatches,
  predictRunSnippet
} from "./predict-run";

describe("normalizePredictedOutput", () => {
  it("ignores trailing whitespace, blank lines and CRLF", () => {
    expect(normalizePredictedOutput("1\r\n  5 \n\n3\n")).toBe("1\n5\n3");
  });

  it("keeps line order, which is the thing being tested", () => {
    expect(normalizePredictedOutput("1\n5\n3")).not.toBe(normalizePredictedOutput("1\n3\n5"));
  });
});

describe("predictionMatches", () => {
  it("accepts a correct prediction formatted loosely", () => {
    expect(predictionMatches("  1\n\n5\n3  ", "1\n5\n3")).toBe(true);
  });

  it("rejects the right values in the wrong order", () => {
    expect(predictionMatches("1\n3\n5", "1\n5\n3")).toBe(false);
  });

  it("rejects a missing line", () => {
    expect(predictionMatches("1\n5", "1\n5\n3")).toBe(false);
  });

  it("treats an empty prediction as wrong, not as a match for empty output", () => {
    expect(predictionMatches("", "1")).toBe(false);
  });
});

describe("parsePredictRunAnswerKey", () => {
  const valid = { code: "console.log(1)", language: "javascript", expectedStdout: "1" };

  it("accepts a well-formed key", () => {
    expect(parsePredictRunAnswerKey(valid)).toEqual(valid);
  });

  it("accepts an empty expected output — some snippets legitimately print nothing", () => {
    expect(parsePredictRunAnswerKey({ ...valid, expectedStdout: "" })).not.toBeNull();
  });

  it.each([
    ["null", null],
    ["a non-object", "nope"],
    ["a missing code field", { language: "javascript", expectedStdout: "1" }],
    ["blank code", { ...valid, code: "   " }],
    ["a missing language", { code: "x", expectedStdout: "1" }],
    ["a missing expected output", { code: "x", language: "javascript" }]
  ])("rejects %s", (_label, input) => {
    expect(parsePredictRunAnswerKey(input)).toBeNull();
  });
});

describe("predictRunSnippet", () => {
  it("never carries the expected output to the client", () => {
    const snippet = predictRunSnippet({
      code: "console.log(1)",
      language: "javascript",
      expectedStdout: "1"
    });
    expect(snippet).toEqual({ code: "console.log(1)", language: "javascript" });
    expect(JSON.stringify(snippet)).not.toContain("expectedStdout");
  });

  it("returns null for a malformed key rather than a partial snippet", () => {
    expect(predictRunSnippet({ code: "x" })).toBeNull();
  });
});
