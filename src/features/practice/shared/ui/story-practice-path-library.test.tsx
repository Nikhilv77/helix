import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE } from "@/features/practice/applied-engineering/ui/applied-engineering-experience";
import { ARCHITECTURE_DESIGN_OVERVIEW_EXPERIENCE } from "@/features/practice/architecture-design/ui/architecture-design-experience";
import { StoryPracticePathLibrary } from "./story-practice-overview";
import type { StoryPracticeBlockView, StoryPracticeHistorySummaryView } from "./view-contracts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const entry = (key: string) => ({
  key,
  version: 1,
  title: key,
  difficulties: ["guided" as const],
  topicKeys: ["topic"],
  mechanismKeys: [],
  questions: [1, 2].map((order) => ({ order, title: `${key} question ${order}`, format: "written" }))
});

function summary(
  id: string,
  key: string,
  ordinal: number,
  isCurrent: boolean
): StoryPracticeHistorySummaryView {
  return {
    id,
    ordinal,
    isCurrent,
    status: "PRACTISING",
    story: {
      key,
      title: key,
      primaryTopicKey: "topic",
      secondaryTopicKeys: [],
      difficulty: "guided",
      stages: [{ order: 1 }, { order: 2 }]
    },
    completedQuestionCount: 0,
    learnedQuestionCount: 0,
    questions: [1, 2].map((order) => ({ id: `${id}-q${order}`, order, status: "ACTIVE" as const })),
    assessment: null
  };
}

describe.each([
  ["Architecture & Design", ARCHITECTURE_DESIGN_OVERVIEW_EXPERIENCE],
  ["Applied Engineering", APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE]
])("%s path library", (_label, experience) => {
  it("links the questions of a started path that is not the current block", () => {
    render(
      <StoryPracticePathLibrary
        entries={[entry("current-path"), entry("started-path"), entry("new-path")]}
        history={[summary("b1", "current-path", 1, true), summary("b2", "started-path", 2, false)]}
        selectedBlockId="b1"
        selectedBlock={
          {
            id: "b1",
            questions: [],
            story: { stages: [], expectedMinutes: 40 },
            selection: { difficulty: "guided" }
          } as unknown as StoryPracticeBlockView
        }
        experience={experience}
      />
    );

    expect(screen.getByRole("link", { name: /started-path question 1/ })).toHaveAttribute(
      "href",
      `${experience.routeBase}/questions/b2-q1?block=b2`
    );
    // An unstarted path is prepared on click instead.
    expect(screen.getByRole("button", { name: /new-path question 1/ })).toBeEnabled();
  });
});
