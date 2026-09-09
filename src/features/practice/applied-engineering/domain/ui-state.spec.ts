import { describe, expect, it } from "vitest";
import type { AppliedEngineeringEligibility } from "@/features/practice/applied-engineering/server/eligibility.service";
import type { AppliedEngineeringHistoryList } from "@/features/practice/applied-engineering/server/history.service";
import type { AppliedEngineeringPublicBlock } from "@/features/practice/applied-engineering/server/practice.service";
import {
  appliedEngineeringHistoryNavigation,
  appliedEngineeringPracticeEntry
} from "./ui-state";

describe("Applied Engineering UI state", () => {
  it("projects a resumable incident into the order-three Practice entry", () => {
    const entry = appliedEngineeringPracticeEntry(
      { available: false } as AppliedEngineeringEligibility,
      {
        status: "PRACTISING",
        incident: {
          title: "Retry storm",
          premise: "A production retry storm overloads a downstream dependency.",
          productionSignalKeys: ["retry-safety", "bounded-work"],
          expectedMinutes: 50
        },
        selection: { difficulty: "standard" },
        questions: [
          { status: "COMPLETED", latestAttempt: { id: "attempt" } },
          { status: "LEARNED", latestAttempt: null },
          ...Array.from({ length: 6 }, () => ({ status: "ACTIVE", latestAttempt: null }))
        ]
      } as unknown as AppliedEngineeringPublicBlock
    );

    expect(entry).toMatchObject({
      key: "applied-engineering",
      order: 3,
      completedQuestions: 2,
      attemptedQuestions: 2,
      progressPercent: 25,
      href: "/practice/applied-engineering"
    });
  });

  it("derives stable previous and next incident history links", () => {
    const history = [
      { id: "third", ordinal: 3, isCurrent: true },
      { id: "first", ordinal: 1, isCurrent: false },
      { id: "second", ordinal: 2, isCurrent: false }
    ] as AppliedEngineeringHistoryList;

    expect(appliedEngineeringHistoryNavigation(history, "second")).toMatchObject({
      previousBlockId: "first",
      nextBlockId: "third",
      totalBlocks: 3
    });
  });
});
