import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressStepper } from "./progress-stepper";
import type { DesignSession } from "@/lib/types";

const session: DesignSession = {
  id: "33333333-3333-4333-8333-333333333333",
  projectId: "11111111-1111-4111-8111-111111111111",
  title: "Session",
  problemStatement: "Design notifications",
  status: "COMPLETED",
  currentStep: null,
  failureCode: null,
  failureMessage: null,
  requirementAnalysis: null,
  clarificationAnswers: null,
  requirementsAnalyzedAt: null,
  capacityCalculation: null,
  capacityCalculatedAt: null,
  generatedDesign: null,
  designGeneratedAt: null,
  architectureDiagram: null,
  diagramGeneratedAt: null,
  designValidation: null,
  designValidatedAt: null,
  startedAt: null,
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("ProgressStepper", () => {
  it("renders the product flow labels", () => {
    render(<ProgressStepper session={session} />);

    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Capacity")).toBeInTheDocument();
    expect(screen.getByText("Validation")).toBeInTheDocument();
  });
});
