import type {
  ArchitectureDesignPracticeEntry,
  PracticeProgressStatus
} from "@/lib/practice/practice-roadmap";
import type { ArchitectureDesignEligibility } from "@/server/architecture-design/eligibility.service";
import type {
  ArchitectureDesignHistoryList,
  ArchitectureDesignHistorySummary
} from "@/server/architecture-design/history.service";
import type { ArchitectureDesignPublicBlock } from "@/server/architecture-design/practice.service";

export type ArchitectureDesignHistoryNavigation = {
  selected: ArchitectureDesignHistorySummary;
  previousBlockId: string | null;
  nextBlockId: string | null;
  totalBlocks: number;
};

export function architectureDesignHistoryNavigation(
  history: ArchitectureDesignHistoryList,
  selectedBlockId: string
): ArchitectureDesignHistoryNavigation | null {
  const ordered = [...history].sort((left, right) => left.ordinal - right.ordinal);
  const index = ordered.findIndex(({ id }) => id === selectedBlockId);
  const selected = ordered[index];
  if (!selected) return null;
  return {
    selected,
    previousBlockId: ordered[index - 1]?.id ?? null,
    nextBlockId: ordered[index + 1]?.id ?? null,
    totalBlocks: ordered.length
  };
}

export function architectureDesignPracticeEntry(
  eligibility: Pick<ArchitectureDesignEligibility, "available"> &
    Partial<Pick<ArchitectureDesignEligibility, "message">>,
  block: ArchitectureDesignPublicBlock | null
): ArchitectureDesignPracticeEntry {
  const available = eligibility.available || Boolean(block);
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
    : available
      ? "ACTIVE"
      : "LOCKED";
  return {
    key: "architecture-design",
    order: 4,
    title: block ? `Architecture & Design · ${block.scenario.title}` : "Architecture & Design",
    purpose:
      block?.scenario.premise ??
      "Design one role-aligned system through requirements, scale, boundaries, failure, and evolution.",
    covers: block
      ? block.scenario.dimensionKeys.slice(0, 4).map(humanizeArchitectureDesignKey)
      : ["Requirements", "Data flow", "Reliability", "Trade-offs"],
    difficulty: block?.selection.difficulty ?? "adaptive",
    durationMinutes: block?.scenario.expectedMinutes ?? 45,
    availability: available ? "available" : "unavailable",
    availabilityLabel: available
      ? null
      : (eligibility.message ??
        "The reviewed Architecture & Design scenario path is not available yet."),
    status,
    totalQuestions: 4,
    attemptedQuestions,
    completedQuestions,
    progressPercent: Math.round((completedQuestions / 4) * 100),
    href: available ? "/practice/architecture-design" : null
  };
}

export function humanizeArchitectureDesignKey(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
