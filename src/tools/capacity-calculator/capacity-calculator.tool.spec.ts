import { CapacityCalculatorTool } from "./capacity-calculator.tool";

describe("CapacityCalculatorTool", () => {
  const tool = new CapacityCalculatorTool();

  it("calculates deterministic traffic, bandwidth, and storage estimates", () => {
    const result = tool.calculate({
      monthlyActiveUsers: 1_000_000,
      dailyActiveUserPercentage: 25,
      requestsPerActiveUserPerDay: 24,
      readWriteRatio: "80:20",
      averagePayloadSizeBytes: 2048,
      peakTrafficMultiplier: 3,
      dataCreatedPerUserBytes: 10 * 1024,
      retentionPeriodDays: 365
    });

    expect(result.results.dailyActiveUsers.raw).toBe(250_000);
    expect(result.results.averageRequestsPerSecond.raw).toBeCloseTo(69.4444, 4);
    expect(result.results.peakRequestsPerSecond.raw).toBeCloseTo(208.3333, 4);
    expect(result.results.readQps.raw).toBeCloseTo(166.6667, 4);
    expect(result.results.writeQps.raw).toBeCloseTo(41.6667, 4);
    expect(result.results.dailyBandwidth.raw).toBe(12_288_000_000);
    expect(result.results.monthlyBandwidth.raw).toBe(368_640_000_000);
    expect(result.results.monthlyStorageGrowth.raw).toBe(10_240_000_000);
    expect(result.results.retainedStorageEstimate.raw).toBeCloseTo(124_586_666_666.6667, 2);
    expect(result.results.dailyBandwidth.display).toBe("11.44 GB");
    expect(result.assumptions).toContain(
      "A month is treated as 30 days for bandwidth and storage estimates."
    );
  });

  it("handles zero-traffic edge cases with warnings", () => {
    const result = tool.calculate({
      monthlyActiveUsers: 0,
      dailyActiveUserPercentage: 20,
      requestsPerActiveUserPerDay: 0,
      readWriteRatio: "100:0",
      averagePayloadSizeBytes: 2048,
      peakTrafficMultiplier: 1,
      dataCreatedPerUserBytes: 0,
      retentionPeriodDays: 0
    });

    expect(result.results.averageRequestsPerSecond.raw).toBe(0);
    expect(result.results.writeQps.raw).toBe(0);
    expect(result.warnings).toEqual([
      "Traffic inputs produce zero daily active users.",
      "Requests per active user is zero, so request-rate estimates are zero.",
      "The read/write ratio has no write share, so write QPS is zero."
    ]);
  });

  it("validates input before execution", () => {
    expect(() =>
      tool.execute({
        monthlyActiveUsers: 1000,
        dailyActiveUserPercentage: 150
      })
    ).toThrow();
  });
});
