import { describe, expect, it } from "vitest";
import { displayName } from "./display-name";

describe("displayName", () => {
  it("title-cases names written in capitals", () => {
    expect(displayName("PRIYA MENON")).toBe("Priya Menon");
    expect(displayName("ANNE-MARIE O'NEIL")).toBe("Anne-Marie O'Neil");
    expect(displayName("JOSÉ ÁLVAREZ")).toBe("José Álvarez");
  });

  it("leaves names that already use lowercase alone", () => {
    expect(displayName("Nikhil Verma")).toBe("Nikhil Verma");
    expect(displayName("mcdonald")).toBe("mcdonald");
    expect(displayName("  ")).toBe("");
  });
});
