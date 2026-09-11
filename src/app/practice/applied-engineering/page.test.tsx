import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eligibility: vi.fn(),
  current: vi.fn(),
  historyList: vi.fn(),
  historyRead: vi.fn(),
  recoverCurrentInterview: vi.fn()
}));
vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: () =>
    Promise.resolve({ ownerId: "owner-one", profile: { targetRole: "backend", level: "3-5" } })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    appliedEngineeringEligibilityService: { forProfile: mocks.eligibility },
    appliedEngineeringPracticeService: { current: mocks.current },
    appliedEngineeringHistoryService: { list: mocks.historyList, read: mocks.historyRead },
    appliedEngineeringAssessmentService: {
      recoverCurrentInterview: mocks.recoverCurrentInterview
    }
  })
}));
vi.mock("@/features/practice/applied-engineering/ui/applied-engineering-overview", () => ({
  AppliedEngineeringOverview: ({
    block,
    history
  }: {
    block: { id: string };
    history: { totalBlocks: number };
  }) => <div data-testid="incident" data-block={block.id} data-total={history.totalBlocks} />
}));
vi.mock(
  "@/features/practice/applied-engineering/ui/applied-engineering-technology-welcome",
  () => ({
    AppliedEngineeringTechnologyWelcome: () => <div data-testid="technology-welcome" />
  })
);

import AppliedEngineeringPracticePage from "./page";

describe("AppliedEngineeringPracticePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eligibility.mockResolvedValue({ available: true, message: "Ready", incidents: [] });
    mocks.current.mockResolvedValue(null);
    mocks.historyList.mockResolvedValue([]);
    mocks.recoverCurrentInterview.mockResolvedValue(null);
  });

  it("shows the shared confirmation gate only for an eligible path", async () => {
    render(await AppliedEngineeringPracticePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("technology-welcome")).toBeInTheDocument();
    expect(mocks.recoverCurrentInterview).toHaveBeenCalledWith("owner-one");
  });

  it("loads only the owner's requested history block and derives navigation", async () => {
    mocks.current.mockResolvedValue({ id: "current", ordinal: 2 });
    mocks.historyRead.mockResolvedValue({ id: "old", ordinal: 1 });
    mocks.historyList.mockResolvedValue([
      { id: "current", ordinal: 2, isCurrent: true },
      { id: "old", ordinal: 1, isCurrent: false }
    ]);
    render(
      await AppliedEngineeringPracticePage({ searchParams: Promise.resolve({ block: "old" }) })
    );
    expect(mocks.historyRead).toHaveBeenCalledWith("owner-one", "old");
    expect(screen.getByTestId("incident")).toHaveAttribute("data-block", "old");
    expect(screen.getByTestId("incident")).toHaveAttribute("data-total", "2");
  });
});
