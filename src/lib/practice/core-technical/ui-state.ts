import type {
  CoreTechnicalPracticeEntry,
  PracticeProgressStatus
} from "@/lib/practice/practice-roadmap";
import type { CoreTechnicalQuestionFormat } from "@/lib/practice/core-technical/contracts";
import type { CoreTechnicalEligibility } from "@/server/core-technical/eligibility.service";
import type {
  CoreTechnicalHistoryList,
  CoreTechnicalHistorySummary
} from "@/server/core-technical/history.service";
import type { CoreTechnicalPublicBlock } from "@/server/core-technical/practice.service";

export type CoreTechnicalViewState =
  | "unavailable"
  | "confirmation"
  | "practising"
  | "assessment-ready"
  | "assessment-in-progress"
  | "assessment-finalizing"
  | "report";

export type CoreTechnicalQuestionWorkKind = "choice" | "text" | "code";

export type CoreTechnicalHistoryNavigation = {
  selected: CoreTechnicalHistorySummary;
  previousBlockId: string | null;
  nextBlockId: string | null;
  totalBlocks: number;
};

export function coreTechnicalViewState(
  block: CoreTechnicalPublicBlock | null,
  eligibility: Pick<CoreTechnicalEligibility, "available">
): CoreTechnicalViewState {
  if (!block) return eligibility.available ? "confirmation" : "unavailable";
  switch (block.status) {
    case "PRACTISING":
      return "practising";
    case "ASSESSMENT_READY":
      return "assessment-ready";
    case "ASSESSMENT_IN_PROGRESS":
      return block.assessment?.status === "FINALIZING"
        ? "assessment-finalizing"
        : "assessment-in-progress";
    case "ASSESSED":
      return "report";
    default:
      return assertNever(block.status);
  }
}

/** Keeps the eight public formats exhaustive while sharing three durable input controls. */
export function coreTechnicalQuestionWorkKind(
  format: CoreTechnicalQuestionFormat
): CoreTechnicalQuestionWorkKind {
  switch (format) {
    case "mcq":
      return "choice";
    case "predict-explain":
    case "written":
    case "spoken":
    case "artifact-diagnosis":
    case "production-decision":
      return "text";
    case "debug-repair":
    case "micro-implementation":
      return "code";
    default:
      return assertNever(format);
  }
}

/** Keeps question-level estimates consistent on the overview and inside the workspace. */
export function coreTechnicalQuestionMinutes(
  format: CoreTechnicalQuestionFormat,
  blockMinutes: number
): number {
  const baseMinutes: Record<CoreTechnicalQuestionFormat, number> = {
    mcq: 5,
    "predict-explain": 5,
    written: 5,
    spoken: 5,
    "artifact-diagnosis": 5,
    "debug-repair": 8,
    "micro-implementation": 8,
    "production-decision": 4
  };
  return Math.max(3, Math.round(baseMinutes[format] * (blockMinutes / 45)));
}

export function coreTechnicalHistoryNavigation(
  history: CoreTechnicalHistoryList,
  selectedBlockId: string
): CoreTechnicalHistoryNavigation | null {
  const ordered = [...history].sort((left, right) => left.ordinal - right.ordinal);
  const index = ordered.findIndex((item) => item.id === selectedBlockId);
  const selected = ordered[index];
  if (!selected) return null;
  return {
    selected,
    previousBlockId: ordered[index - 1]?.id ?? null,
    nextBlockId: ordered[index + 1]?.id ?? null,
    totalBlocks: ordered.length
  };
}

export function coreTechnicalPracticeEntry(
  eligibility: Pick<CoreTechnicalEligibility, "available">,
  block: CoreTechnicalPublicBlock | null
): CoreTechnicalPracticeEntry | null {
  if (!eligibility.available && !block) return null;
  const terminalCount =
    block?.questions.filter(({ status }) => status === "COMPLETED" || status === "LEARNED")
      .length ?? 0;
  const attemptedCount =
    block?.questions.filter(
      ({ status, latestAttempt }) => status === "LEARNED" || latestAttempt !== null
    ).length ?? 0;
  const status: PracticeProgressStatus = block
    ? block.status === "ASSESSED"
      ? "COMPLETED"
      : terminalCount > 0 || block.status !== "PRACTISING"
        ? "IN_PROGRESS"
        : "ACTIVE"
    : "ACTIVE";
  return {
    key: "core-technical",
    order: 2,
    title: block ? `Core Technical · ${block.story.title}` : "Core Technical · Node.js",
    purpose:
      block?.story.premise ??
      "Trace one realistic Node.js incident through eight connected interview questions.",
    covers: block
      ? block.story.mechanismKeys.slice(0, 4).map(humanize)
      : ["JavaScript", "Node.js 22", "Runtime reasoning", "Production debugging"],
    difficulty: block?.selection.difficulty ?? "adaptive",
    durationMinutes: block?.story.expectedMinutes ?? 45,
    availability: "available",
    status,
    totalQuestions: 8,
    attemptedQuestions: attemptedCount,
    completedQuestions: terminalCount,
    progressPercent: Math.round((terminalCount / 8) * 100),
    href: "/practice/core-technical"
  };
}

export function humanizeCoreTechnicalKey(value: string): string {
  return humanize(value);
}

function humanize(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Core Technical lifecycle state: ${String(value)}`);
}
