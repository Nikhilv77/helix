import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

const mocks = vi.hoisted(() => ({ current: vi.fn(), historyRead: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/server/auth/onboarding-guard", () => ({ requireOnboardedProfile: () => Promise.resolve({ ownerId: "owner-one" }) }));
vi.mock("@/server/app-container", () => ({ getAppContainer: () => ({
  appliedEngineeringPracticeService: { current: mocks.current },
  appliedEngineeringHistoryService: { read: mocks.historyRead }
}) }));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), notFound: mocks.notFound }));
vi.mock("@/features/practice/applied-engineering/ui/applied-engineering-question-workspace", () => ({
  AppliedEngineeringQuestionWorkspace: ({ block, initialQuestion, stageTitle }: { block: { id: string }; initialQuestion: { id: string }; stageTitle: string }) => <div data-testid="workspace" data-block={block.id} data-question={initialQuestion.id} data-stage={stageTitle} />
}));

import AppliedEngineeringQuestionPage from "./page";

describe("AppliedEngineeringQuestionPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads an owned historical question from the selected frozen incident", async () => {
    mocks.historyRead.mockResolvedValue(block("old", "question-one"));
    render(await AppliedEngineeringQuestionPage({ params: Promise.resolve({ questionId: "question-one" }), searchParams: Promise.resolve({ block: "old" }) }));
    expect(mocks.historyRead).toHaveBeenCalledWith("owner-one", "old");
    expect(screen.getByTestId("workspace")).toHaveAttribute("data-stage", "Find the bottleneck");
  });

  it("uses the same not-found boundary for missing and foreign resources", async () => {
    mocks.historyRead.mockRejectedValue(new NotFoundErrorException("APPLIED_ENGINEERING_BLOCK_NOT_FOUND", "not found"));
    await expect(AppliedEngineeringQuestionPage({ params: Promise.resolve({ questionId: "question-one" }), searchParams: Promise.resolve({ block: "foreign" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

function block(id: string, questionId: string) {
  return { id, incident: { stages: [{ order: 1, title: "Find the bottleneck" }] }, questions: [{ id: questionId, order: 1 }] };
}
