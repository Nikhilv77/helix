import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CapacityMetrics } from "./capacity-metrics";
import type { CapacityCalculation } from "@/lib/types";

const calculation: CapacityCalculation = {
  toolName: "capacity-calculator",
  inputs: {},
  results: {
    dailyActiveUsers: { raw: 250000, display: "250k", unit: "users" },
    averageRequestsPerSecond: { raw: 69.44, display: "69.44", unit: "rps" },
    peakRequestsPerSecond: { raw: 208.33, display: "208.33", unit: "rps" },
    readQps: { raw: 166.66, display: "166.66", unit: "qps" },
    writeQps: { raw: 41.67, display: "41.67", unit: "qps" },
    dailyBandwidth: { raw: 100, display: "100", unit: "GB" },
    monthlyBandwidth: { raw: 3000, display: "3", unit: "TB" },
    monthlyStorageGrowth: { raw: 500, display: "500", unit: "GB" },
    retainedStorageEstimate: { raw: 6000, display: "6", unit: "TB" }
  },
  assumptions: ["Reads dominate traffic."],
  warnings: ["Validate payload size with production traces."]
};

describe("CapacityMetrics", () => {
  it("renders readable capacity cards and warnings", () => {
    render(<CapacityMetrics calculation={calculation} />);

    expect(screen.getByText("Daily active users")).toBeInTheDocument();
    expect(screen.getByText("250k")).toBeInTheDocument();
    expect(screen.getByText("Average RPS")).toBeInTheDocument();
    expect(screen.getByText("Validate payload size with production traces.")).toBeInTheDocument();
  });

  it("renders an empty state before calculation", () => {
    render(<CapacityMetrics calculation={null} />);

    expect(screen.getByText(/Run the capacity calculator/i)).toBeInTheDocument();
  });
});
