import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireOnboardedProfile: vi.fn() }));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: mocks.requireOnboardedProfile
}));

vi.mock("@/components/resume-roast/resume-roast-workspace", () => ({
  ResumeRoastWorkspace: () => <div>Resume Roast workspace</div>
}));

import ResumeRoastPage from "./page";

describe("ResumeRoastPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("guards the product tab with the completed-onboarding boundary", async () => {
    mocks.requireOnboardedProfile.mockRejectedValue(new Error("NEXT_REDIRECT:/"));

    await expect(ResumeRoastPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("renders the workspace after the onboarding guard succeeds", async () => {
    mocks.requireOnboardedProfile.mockResolvedValue({
      ownerId: "owner-1",
      profile: { resume: null }
    });

    render(await ResumeRoastPage());

    expect(screen.getByText("Resume Roast workspace")).toBeVisible();
    expect(mocks.requireOnboardedProfile).toHaveBeenCalledOnce();
  });
});
