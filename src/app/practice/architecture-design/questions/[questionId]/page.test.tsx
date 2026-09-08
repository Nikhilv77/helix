import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  historyRead: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: () => Promise.resolve({ ownerId: "owner-one" })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    architectureDesign: {
      practice: { current: mocks.current },
      history: { read: mocks.historyRead }
    }
  })
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: mocks.notFound
}));
vi.mock(
  "@/components/workspace/architecture-design/architecture-design-question-workspace",
  () => ({
    ArchitectureDesignQuestionWorkspace: ({
      block,
      initialQuestion,
      stageTitle
    }: {
      block: { id: string };
      initialQuestion: { id: string };
      stageTitle: string;
    }) => (
      <div
        data-testid="workspace"
        data-block={block.id}
        data-question={initialQuestion.id}
        data-stage={stageTitle}
      />
    )
  })
);

import ArchitectureDesignQuestionPage from "./page";

describe("ArchitectureDesignQuestionPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads an owned historical question from its frozen scenario", async () => {
    mocks.historyRead.mockResolvedValue(block("old", "question-one"));
    render(
      await ArchitectureDesignQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({ block: "old" })
      })
    );
    expect(mocks.historyRead).toHaveBeenCalledWith("owner-one", "old");
    expect(screen.getByTestId("workspace")).toHaveAttribute(
      "data-stage",
      "Requirements and scale"
    );
  });

  it("uses the same not-found boundary for missing and foreign resources", async () => {
    mocks.historyRead.mockRejectedValue(
      new NotFoundErrorException("ARCHITECTURE_DESIGN_BLOCK_NOT_FOUND", "not found")
    );
    await expect(
      ArchitectureDesignQuestionPage({
        params: Promise.resolve({ questionId: "question-one" }),
        searchParams: Promise.resolve({ block: "foreign" })
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

function block(id: string, questionId: string) {
  return {
    id,
    scenario: { stages: [{ order: 1, title: "Requirements and scale" }] },
    questions: [{ id: questionId, order: 1 }]
  };
}
