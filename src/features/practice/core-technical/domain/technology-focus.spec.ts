import { describe, expect, it } from "vitest";
import { coreTechnicalFrameworkFor, coreTechnicalTechnologyOptions } from "./technology-focus";

describe("Core Technical technology focus", () => {
  it("puts supported resume technologies first and keeps a Node.js fallback", () => {
    expect(coreTechnicalTechnologyOptions(["PostgreSQL", "TypeScript", "NestJS"])).toEqual([
      expect.objectContaining({ value: "typescript", resumeMatched: true }),
      expect.objectContaining({ value: "nestjs", resumeMatched: true }),
      expect.objectContaining({ value: "nodejs", resumeMatched: false })
    ]);
  });

  it("does not advertise technologies the generation domain cannot validate", () => {
    const options = coreTechnicalTechnologyOptions(["Python", "Django", "PostgreSQL"]);
    expect(options.map((option) => option.value)).toEqual(["nodejs"]);
  });

  it("maps framework choices without pretending language choices are frameworks", () => {
    expect(coreTechnicalFrameworkFor("express")).toBe("express");
    expect(coreTechnicalFrameworkFor("typescript")).toBeNull();
  });
});
