import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValidationPanel } from "./validation-panel";
import type { DesignValidation } from "@/lib/types";

const validation: DesignValidation = {
  overallScore: 82,
  categoryScores: [
    {
      category: "Reliability",
      score: 78,
      summary: "Retries are covered but recovery needs detail."
    },
    {
      category: "Security",
      score: 86,
      summary: "Authentication boundaries are clear."
    }
  ],
  criticalIssues: [],
  warnings: [
    {
      category: "Disaster recovery",
      message: "Recovery objectives are not explicit.",
      recommendation: "Add RPO and RTO targets."
    }
  ],
  missingAreas: [],
  improvementSuggestions: [],
  strengths: [
    {
      category: "Scalability",
      message: "The design isolates worker scaling."
    }
  ],
  unresolvedAssumptions: ["Traffic burst shape remains unknown."],
  validatedAt: "2026-01-01T00:00:00.000Z"
};

describe("ValidationPanel", () => {
  it("renders scores, findings, strengths, and assumptions", () => {
    render(<ValidationPanel validation={validation} />);

    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("Reliability")).toBeInTheDocument();
    expect(screen.getByText("Recovery objectives are not explicit.")).toBeInTheDocument();
    expect(screen.getByText("The design isolates worker scaling.")).toBeInTheDocument();
    expect(screen.getByText("Traffic burst shape remains unknown.")).toBeInTheDocument();
  });
});
