import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({
  requireOnboardedProfile: vi.fn(),
  eligibility: vi.fn(),
  current: vi.fn(),
  historyList: vi.fn(),
  historyRead: vi.fn()
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: mocks.requireOnboardedProfile
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    coreTechnicalEligibilityService: { forProfile: mocks.eligibility },
    coreTechnicalPracticeService: { current: mocks.current },
    coreTechnicalHistoryService: { list: mocks.historyList, read: mocks.historyRead }
  })
}));
vi.mock("@/features/practice/core-technical/ui/core-technical-overview", () => ({
  CoreTechnicalOverview: (props: {
    block: { id: string };
    history: { totalBlocks: number };
    storyLibrary: unknown[];
    storyHistory: unknown[];
  }) => (
    <div
      data-testid="story"
      data-block={props.block.id}
      data-total={props.history.totalBlocks}
      data-library={props.storyLibrary.length}
      data-history={props.storyHistory.length}
    />
  )
}));
vi.mock("@/features/practice/core-technical/ui/core-technical-technology-welcome", () => ({
  CoreTechnicalTechnologyWelcome: () => <div data-testid="preparation" />
}));

import CoreTechnicalPracticePage from "./page";

describe("CoreTechnicalPracticePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOnboardedProfile.mockResolvedValue({
      ownerId: "owner-one",
      profile: {
        targetRole: "backend",
        level: "3-5",
        headline: "Platform engineer"
      } as CandidateProfile
    });
    mocks.eligibility.mockResolvedValue({ available: true, message: "Ready", stories: [] });
    mocks.current.mockResolvedValue(null);
    mocks.historyList.mockResolvedValue([]);
  });

  it("shows confirmation only for a server-approved path", async () => {
    render(await CoreTechnicalPracticePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("preparation")).toBeInTheDocument();
  });

  it("shows a bounded unavailable state when launch eligibility fails", async () => {
    mocks.eligibility.mockResolvedValue({
      available: false,
      message: "The reviewed Node.js practice path is not available yet.",
      stories: []
    });

    render(await CoreTechnicalPracticePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "The reviewed Node.js practice path is not available yet."
    );
    expect(screen.queryByTestId("preparation")).toBeNull();
  });

  it("reads a URL-selected owned history block and derives ordinal navigation", async () => {
    const current = { id: "block-two", ordinal: 2 };
    const selected = { id: "block-one", ordinal: 1 };
    mocks.current.mockResolvedValue(current);
    mocks.historyRead.mockResolvedValue(selected);
    mocks.historyList.mockResolvedValue([
      { id: "block-two", ordinal: 2, isCurrent: true },
      { id: "block-one", ordinal: 1, isCurrent: false }
    ]);
    mocks.eligibility.mockResolvedValue({
      available: true,
      message: "Ready",
      stories: [{ key: "story-one" }, { key: "story-two" }]
    });

    render(
      await CoreTechnicalPracticePage({
        searchParams: Promise.resolve({ block: "block-one" })
      })
    );

    expect(mocks.historyRead).toHaveBeenCalledWith("owner-one", "block-one");
    expect(screen.getByTestId("story")).toHaveAttribute("data-block", "block-one");
    expect(screen.getByTestId("story")).toHaveAttribute("data-total", "2");
    expect(screen.getByTestId("story")).toHaveAttribute("data-library", "2");
    expect(screen.getByTestId("story")).toHaveAttribute("data-history", "2");
  });
});
