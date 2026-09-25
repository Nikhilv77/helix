import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ questionWorkspace: vi.fn() }));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedOwner: () => Promise.resolve({ ownerId: "owner-one" })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    appliedEngineeringPracticeService: { questionWorkspace: mocks.questionWorkspace }
  })
}));
vi.mock(
  "@/features/practice/applied-engineering/ui/applied-engineering-question-workspace",
  () => ({
    AppliedEngineeringQuestionWorkspace: (props: {
      block: { id: string };
      initialQuestion: { id: string };
      stageTitle: string;
    }) => (
      <div
        data-testid="workspace"
        data-block={props.block.id}
        data-question={props.initialQuestion.id}
        data-stage={props.stageTitle}
      />
    )
  })
);

import AppliedEngineeringQuestionPage from "./page";

describe("AppliedEngineeringQuestionPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the question from the URL-selected block for the signed-in owner", async () => {
    mocks.questionWorkspace.mockResolvedValue(workspace("historical-block", "question-one"));

    render(
      await AppliedEngineeringQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({ block: "historical-block" })
      })
    );

    expect(mocks.questionWorkspace).toHaveBeenCalledWith(
      "owner-one",
      "question-one",
      "historical-block"
    );
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-block", "historical-block");
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-stage", "Find the bottleneck");
  });

  it("lets the service choose the current block when the URL has none", async () => {
    mocks.questionWorkspace.mockResolvedValue(workspace("current-block", "question-one"));

    render(
      await AppliedEngineeringQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(mocks.questionWorkspace).toHaveBeenCalledWith("owner-one", "question-one", null);
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-block", "current-block");
  });

  it("returns to Applied Engineering for a missing question or a foreign block", async () => {
    mocks.questionWorkspace.mockResolvedValue(null);

    await expect(
      AppliedEngineeringQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({ block: "foreign-block" })
      })
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});

function workspace(blockId: string, questionId: string) {
  return {
    block: { id: blockId, story: { stages: [{ order: 1, title: "Find the bottleneck" }] } },
    question: { id: questionId, order: 1 }
  };
}
