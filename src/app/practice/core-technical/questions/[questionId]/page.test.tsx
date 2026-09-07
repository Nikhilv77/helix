import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

const mocks = vi.hoisted(() => ({
  requireOnboardedProfile: vi.fn(),
  current: vi.fn(),
  historyRead: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: mocks.requireOnboardedProfile
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    coreTechnicalPracticeService: { current: mocks.current },
    coreTechnicalHistoryService: { read: mocks.historyRead }
  })
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: mocks.notFound
}));
vi.mock("@/components/workspace/core-technical/core-technical-question-workspace", () => ({
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOnboardedProfile.mockResolvedValue({ ownerId: "owner-one" });
  });

  it("reads an owned historical question from the URL-selected frozen block", async () => {
    mocks.historyRead.mockResolvedValue(block("historical-block", "question-one", false));

    render(
      await CoreTechnicalQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({ block: "historical-block" })
      })
    );

    expect(mocks.historyRead).toHaveBeenCalledWith("owner-one", "historical-block");
    expect(mocks.current).not.toHaveBeenCalled();
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-question", "question-one");
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-stage", "Trace the runtime");
  });

  it("uses the current server-owned block when the URL has no block selection", async () => {
    mocks.current.mockResolvedValue(block("current-block", "question-one", true));

    render(
      await CoreTechnicalQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({})
      })
    );

    expect(mocks.current).toHaveBeenCalledWith("owner-one");
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-block", "current-block");
  });

  it("uses the same not-found boundary for a missing question or a foreign block", async () => {
    mocks.historyRead.mockResolvedValue(block("owned-block", "different-question", false));
    await expect(
      CoreTechnicalQuestionPage({
        params: Promise.resolve({ questionId: "missing-question" }),
        searchParams: Promise.resolve({ block: "owned-block" })
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    mocks.historyRead.mockRejectedValue(
      new NotFoundErrorException(
        "CORE_TECHNICAL_BLOCK_NOT_FOUND",
        "Core Technical story block not found."
      )
    );
    await expect(
      CoreTechnicalQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({ block: "foreign-block" })
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

function block(id: string, questionId: string, isCurrent: boolean) {
  return {
    id,
    isCurrent,
    story: { stages: [{ order: 1, title: "Trace the runtime" }] },
    questions: [{ id: questionId, order: 1 }]
  };
}
