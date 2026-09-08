import { describe, expect, it } from "vitest";
import type { ArchitectureDesignPublicBlock } from "@/server/architecture-design/practice.service";
import { architectureDesignPracticeEntry } from "./ui-state";

describe("Architecture & Design Practice entry", () => {
  it("keeps Architecture visible but disabled until reviewed content is published", () => {
    expect(
      architectureDesignPracticeEntry(
        { available: false, message: "Two reviewed scenarios are required." },
        null
      )
    ).toMatchObject({
      key: "architecture-design",
      order: 4,
      availability: "unavailable",
      availabilityLabel: "Two reviewed scenarios are required.",
      status: "LOCKED",
      href: null
    });
  });

  it("keeps an existing owner block resumable after catalogue eligibility changes", () => {
    const entry = architectureDesignPracticeEntry({ available: false }, {
      status: "PRACTISING",
      selection: { difficulty: "guided" },
      scenario: {
        title: "Webhook delivery",
        premise: "Design reliable multi-tenant webhook delivery.",
        dimensionKeys: ["requirements-framing", "failure-modeling"],
        expectedMinutes: 50
      },
      questions: [
        { status: "COMPLETED", latestAttempt: {} },
        { status: "LEARNED", latestAttempt: null },
        { status: "PENDING", latestAttempt: null },
        { status: "PENDING", latestAttempt: null }
      ]
    } as unknown as ArchitectureDesignPublicBlock);

    expect(entry).toMatchObject({
      key: "architecture-design",
      order: 4,
      status: "IN_PROGRESS",
      totalQuestions: 4,
      attemptedQuestions: 2,
      completedQuestions: 2,
      progressPercent: 50,
      href: "/practice/architecture-design"
    });
  });
});
