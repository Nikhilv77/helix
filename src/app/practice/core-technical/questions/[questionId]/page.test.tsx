import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ questionWorkspace: vi.fn() }));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedOwner: () => Promise.resolve({ ownerId: "owner-one" })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    coreTechnicalPracticeService: { questionWorkspace: mocks.questionWorkspace }
  })
}));
vi.mock("@/features/practice/core-technical/ui/core-technical-question-workspace", () => ({
  CoreTechnicalQuestionWorkspace: (props: {
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
}));

import CoreTechnicalQuestionPage from "./page";

describe("CoreTechnicalQuestionPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the question from the URL-selected block for the signed-in owner", async () => {
    mocks.questionWorkspace.mockResolvedValue(workspace("historical-block", "question-one"));

    render(
      await CoreTechnicalQuestionPage({
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
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-stage", "Trace the runtime");
  });

  it("lets the service choose the current block when the URL has none", async () => {
    mocks.questionWorkspace.mockResolvedValue(workspace("current-block", "question-one"));

    render(
      await CoreTechnicalQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(mocks.questionWorkspace).toHaveBeenCalledWith("owner-one", "question-one", null);
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-block", "current-block");
  });

  it("returns to Core Technical for a missing question or a foreign block", async () => {
    mocks.questionWorkspace.mockResolvedValue(null);

    await expect(
      CoreTechnicalQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({ block: "foreign-block" })
      })
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});

function workspace(blockId: string, questionId: string) {
  return {
    block: { id: blockId, story: { stages: [{ order: 1, title: "Trace the runtime" }] } },
    question: { id: questionId, order: 1 }
  };
}
