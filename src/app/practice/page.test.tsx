import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";

const mocks = vi.hoisted(() => ({
  requireOnboardedProfile: vi.fn(),
  home: vi.fn(),
  logError: vi.fn()
}));

vi.mock("@/server/auth/onboarding-guard", () => ({
  requireOnboardedProfile: mocks.requireOnboardedProfile
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({ practiceRoadmapService: { home: mocks.home } })
}));

vi.mock("@/server/common/logger", () => ({
  Logger: class {
    error = mocks.logError;
  }
}));

import PracticePage from "./page";

describe("PracticePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not reach the Practice generator when the onboarding guard rejects access", async () => {
    mocks.requireOnboardedProfile.mockRejectedValue(new Error("NEXT_REDIRECT:/"));

    await expect(PracticePage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mocks.home).not.toHaveBeenCalled();
  });

  it("shows a recoverable error state without claiming saved progress was lost", async () => {
    mocks.requireOnboardedProfile.mockResolvedValue({
      userId: "user-1",
      ownerId: "owner-1",
      profile: { resume: { fullName: "Asha Verma" } } as CandidateProfile
    });
    mocks.home.mockRejectedValue(new Error("temporary database error"));

    render(await PracticePage());

    expect(screen.getByRole("alert").textContent).toContain(
      "We couldn’t prepare your practice path"
    );
    expect(screen.getByRole("alert").textContent).toContain("Your saved progress is safe");
    expect(mocks.home).toHaveBeenCalledWith("owner-1");
    expect(mocks.logError).toHaveBeenCalledWith({
      event: "practice.roadmap_generation_failed",
      ownerId: "owner-1",
      reason: "temporary database error"
    });
  });
});
