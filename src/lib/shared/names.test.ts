import { describe, expect, it } from "vitest";
import { displayFirstName } from "./names";

describe("displayFirstName", () => {
  it("softens an all-caps or all-lowercase resume name", () => {
    expect(displayFirstName("PRIYA MENON")).toBe("Priya");
    expect(displayFirstName("ishan sharma")).toBe("Ishan");
  });

  it("keeps a name written in mixed case", () => {
    expect(displayFirstName("  McKenzie Lee ")).toBe("McKenzie");
  });

  it("returns an empty string when there is no name", () => {
    expect(displayFirstName(undefined)).toBe("");
    expect(displayFirstName("   ")).toBe("");
  });
});
