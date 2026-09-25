import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadPageData: vi.fn() }));

vi.mock("@/server/auth/request-user", () => ({
  getUserIdForRequest: async () => "user-1"
}));

vi.mock("@/features/interviews/server/owner", () => ({
  authenticatedOwnerId: () => "owner-1"
}));

vi.mock("@/features/resume-roast/server/resume-roast-page-data", () => ({
  loadResumeRoastPageData: mocks.loadPageData
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }
}));

vi.mock("@/features/resume-roast/ui/resume-roast-workspace", () => ({
  ResumeRoastWorkspace: () => <div>Resume Roast workspace</div>
}));

import ResumeRoastPage from "./page";

describe("ResumeRoastPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("guards the product tab with the completed-onboarding boundary", async () => {
    mocks.loadPageData.mockResolvedValue({ onboardingCompletedAt: null });

    await expect(ResumeRoastPage()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });

  it("renders the workspace after the onboarding guard succeeds", async () => {
    mocks.loadPageData.mockResolvedValue({
      onboardingCompletedAt: 1,
      preparationCompletedAt: 1,
      resume: null,
      state: {
        hasResume: false,
        target: null,
        suggestedTarget: null,
        previousRoast: null,
        history: []
      }
    });

    render(await ResumeRoastPage());

    expect(screen.getByText("Resume Roast workspace")).toBeVisible();
    expect(mocks.loadPageData).toHaveBeenCalledWith("owner-1");
  });
});
