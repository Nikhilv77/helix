import type {
  AppliedEngineeringPracticeEntry,
  PracticeProgressStatus
} from "@/features/practice/shared/domain/practice-roadmap";
import type { AppliedEngineeringEligibility } from "@/features/practice/applied-engineering/server/eligibility.service";
import type {
  AppliedEngineeringHistoryList,
  AppliedEngineeringHistorySummary
} from "@/features/practice/applied-engineering/server/history.service";
import type { AppliedEngineeringPublicBlock } from "@/features/practice/applied-engineering/server/practice.service";

export type AppliedEngineeringHistoryNavigation = {
  selected: AppliedEngineeringHistorySummary;
  previousBlockId: string | null;
  nextBlockId: string | null;
  totalBlocks: number;
};

export function appliedEngineeringHistoryNavigation(
  history: AppliedEngineeringHistoryList,
  selectedBlockId: string
): AppliedEngineeringHistoryNavigation | null {
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

export function appliedEngineeringPracticeEntry(
  eligibility: Pick<AppliedEngineeringEligibility, "available">,
  block: AppliedEngineeringPublicBlock | null
): AppliedEngineeringPracticeEntry | null {
  if (!eligibility.available && !block) return null;
  const completedQuestions =
    block?.questions.filter(({ status }) => status === "COMPLETED" || status === "LEARNED")
      .length ?? 0;
  const attemptedQuestions =
    block?.questions.filter(
      ({ status, latestAttempt }) => status === "LEARNED" || latestAttempt !== null
    ).length ?? 0;
  const status: PracticeProgressStatus = block
    ? block.status === "ASSESSED"
      ? "COMPLETED"
      : completedQuestions > 0 || block.status !== "PRACTISING"
        ? "IN_PROGRESS"
        : "ACTIVE"
    : "ACTIVE";
  return {
    key: "applied-engineering",
    order: 3,
    title: block
      ? `Applied Engineering · ${block.incident.title}`
      : "Applied Engineering · Node.js",
    purpose:
      block?.incident.premise ??
      "Diagnose one realistic production incident through eight connected engineering questions.",
    covers: block
      ? block.incident.productionSignalKeys.slice(0, 4).map(humanizeAppliedEngineeringKey)
      : ["Incident diagnosis", "Production debugging", "Verification", "Safe delivery"],
    difficulty: block?.selection.difficulty ?? "adaptive",
    durationMinutes: block?.incident.expectedMinutes ?? 50,
    availability: "available",
    status,
    totalQuestions: 8,
    attemptedQuestions,
    completedQuestions,
    progressPercent: Math.round((completedQuestions / 8) * 100),
    href: "/practice/applied-engineering"
  };
}

export function humanizeAppliedEngineeringKey(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
