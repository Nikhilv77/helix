import type { PrismaService } from "../database/prisma.service";
import { HelperEligibilityService } from "./helper-eligibility";

function serviceReturning(rows: unknown[][]) {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  const prisma = {
    $queryRawUnsafe: async (query: string, ...values: unknown[]) => {
      calls.push({ query, values });
      return rows.shift() ?? [];
    }
  } as unknown as PrismaService;

  return { service: new HelperEligibilityService(prisma), calls };
}

describe("helper eligibility adapter", () => {
  it("reads one normalized evidence score from the database policy", async () => {
    const { service, calls } = serviceReturning([[{ score: 0.72 }]]);

    await expect(service.score("helper-1", "lru-cache", "java")).resolves.toBe(0.72);
    expect(calls[0]!.values).toEqual(["helper-1", "lru-cache", "java"]);
  });

  it("bounds invalid database output rather than granting accidental eligibility", async () => {
    const { service } = serviceReturning([[{ score: Number.NaN }], [{ score: 4 }]]);

    await expect(service.score("helper-1", "lru-cache", "java")).resolves.toBe(0);
    await expect(service.score("helper-1", "lru-cache", "java")).resolves.toBe(1);
  });

  it("scores an inbox candidate window in one database call", async () => {
    const { service, calls } = serviceReturning([
      [
        { id: "request-1", score: 0.95 },
        { id: "request-2", score: 0 }
      ]
    ]);

    const scores = await service.scoresForRequests("helper-1", [
      { id: "request-1", questionSlug: "lru-cache", language: "java" },
      { id: "request-2", questionSlug: "two-sum", language: "python" }
    ]);

    expect([...scores]).toEqual([
      ["request-1", 0.95],
      ["request-2", 0]
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values[0]).toBe("helper-1");
  });
});
