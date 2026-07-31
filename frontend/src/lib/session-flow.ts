import type { DesignSession } from "./types";

export interface FlowStep {
  id:
    | "project"
    | "session"
    | "requirements"
    | "clarifications"
    | "capacity"
    | "design"
    | "diagram"
    | "validation";
  label: string;
}

export const flowSteps: FlowStep[] = [
  { id: "project", label: "Project" },
  { id: "session", label: "Session" },
  { id: "requirements", label: "Requirements" },
  { id: "clarifications", label: "Clarifications" },
  { id: "capacity", label: "Capacity" },
  { id: "design", label: "Design" },
  { id: "diagram", label: "Diagram" },
  { id: "validation", label: "Validation" }
];

export function getSessionProgressIndex(session: DesignSession): number {
  if (session.designValidation) return 7;
  if (session.architectureDiagram) return 6;
  if (session.generatedDesign) return 5;
  if (session.capacityCalculation) return 4;
  if (session.status === "REQUIREMENTS_PENDING") return 3;
  if (session.requirementAnalysis) return 2;
  return 1;
}

export function canAnalyzeRequirements(session: DesignSession): boolean {
  return (
    session.status === "DRAFT" ||
    (session.status === "FAILED" && !session.requirementAnalysis)
  );
}

export function canSubmitClarifications(session: DesignSession): boolean {
  return session.status === "REQUIREMENTS_PENDING" && Boolean(session.requirementAnalysis);
}

export function canCalculateCapacity(session: DesignSession): boolean {
  return session.status === "READY_FOR_DESIGN";
}

export function canGenerateDesign(session: DesignSession): boolean {
  return (
    (session.status === "READY_FOR_DESIGN" || session.status === "FAILED") &&
    Boolean(session.requirementAnalysis) &&
    Boolean(session.capacityCalculation)
  );
}

export function canGenerateDiagram(session: DesignSession): boolean {
  return Boolean(session.generatedDesign);
}

export function canValidateDesign(session: DesignSession): boolean {
  return Boolean(session.generatedDesign);
}
