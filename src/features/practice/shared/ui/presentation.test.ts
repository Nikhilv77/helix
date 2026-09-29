import { describe, expect, it } from "vitest";
import { humanizeStoryPracticeKey } from "./presentation";

describe("humanizeStoryPracticeKey", () => {
  it("keeps acronyms and joining words readable", () => {
    expect(humanizeStoryPracticeKey("databases-sql")).toBe("Databases SQL");
    expect(humanizeStoryPracticeKey("api-design")).toBe("API Design");
    expect(humanizeStoryPracticeKey("css-and-layout")).toBe("CSS and Layout");
    expect(humanizeStoryPracticeKey("production-decision")).toBe("Production Decision");
  });
});
