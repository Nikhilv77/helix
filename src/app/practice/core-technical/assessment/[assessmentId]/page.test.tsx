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
vi.mock("@/features/practice/core-technical/ui/core-technical-assessment", () => ({
  CoreTechnicalAssessment: (props: {
    block: { id: string };
    terminalCount: number;
    dedicatedRoom: boolean;
  }) => (
    <div
      data-testid="assessment-room"
      data-block={props.block.id}
      data-terminal={props.terminalCount}
      data-dedicated={props.dedicatedRoom}
    />
  )
}));

import CoreTechnicalAssessmentRoomPage from "./page";

describe("CoreTechnicalAssessmentRoomPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOnboardedProfile.mockResolvedValue({ ownerId: "owner-one" });
  });

  it("loads the owner-scoped block into the dedicated assessment room", async () => {
    mocks.historyRead.mockResolvedValue(block("block-one", "assessment-one"));

    render(
      await CoreTechnicalAssessmentRoomPage({
        params: Promise.resolve({ assessmentId: "assessment-one" }),
        searchParams: Promise.resolve({ block: "block-one" })
      })
    );

    expect(mocks.historyRead).toHaveBeenCalledWith("owner-one", "block-one");
    expect(screen.getByTestId("assessment-room")).toHaveAttribute("data-block", "block-one");
    expect(screen.getByTestId("assessment-room")).toHaveAttribute("data-terminal", "2");
    expect(screen.getByTestId("assessment-room")).toHaveAttribute("data-dedicated", "true");
  });

  it("fails closed when the assessment does not belong to the selected block", async () => {
    mocks.historyRead.mockResolvedValue(block("block-one", "another-assessment"));

    await expect(
      CoreTechnicalAssessmentRoomPage({
        params: Promise.resolve({ assessmentId: "assessment-one" }),
        searchParams: Promise.resolve({ block: "block-one" })
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    mocks.historyRead.mockRejectedValue(
      new NotFoundErrorException(
        "CORE_TECHNICAL_BLOCK_NOT_FOUND",
        "Core Technical practice path not found."
      )
    );
    await expect(
      CoreTechnicalAssessmentRoomPage({
        params: Promise.resolve({ assessmentId: "assessment-one" }),
        searchParams: Promise.resolve({ block: "foreign-block" })
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

function block(id: string, assessmentId: string) {
  return {
    id,
    assessment: { id: assessmentId },
    questions: [
      { status: "COMPLETED" },
      { status: "LEARNED" },
      { status: "ACTIVE" }
    ]
  };
}
