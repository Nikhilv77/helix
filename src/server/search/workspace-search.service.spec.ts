import { normalizeQuery, searchStaticItems, trigramSimilarity } from "./workspace-search.service";

describe("workspace search ranking", () => {
  it("normalizes whitespace and enforces the server query bound", () => {
    expect(normalizeQuery("   system   design  ")).toBe("system design");
    expect(normalizeQuery("x".repeat(120))).toHaveLength(80);
  });

  it("ranks exact destinations above descriptive keyword matches", () => {
    const results = searchStaticItems("reports");

    expect(results[0]).toMatchObject({ title: "Reports", href: "/reports", group: "Pages" });
    expect(results[0]!.score).toBe(8);
    expect(results.slice(1).every((result) => result.score < results[0]!.score)).toBe(true);
  });

  it("finds a workspace destination through a realistic typo", () => {
    expect(searchStaticItems("practce")[0]).toMatchObject({ title: "Practice" });
    expect(trigramSimilarity("practice", "practce")).toBeGreaterThan(0.5);
  });

  it("does not return unrelated destinations", () => {
    expect(searchStaticItems("zzqxnotaword")).toEqual([]);
  });
});
