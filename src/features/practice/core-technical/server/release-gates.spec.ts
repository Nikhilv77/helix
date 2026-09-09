import type { CandidateProfile } from "@/lib/shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getAppContainer: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/server/app-container", () => ({ getAppContainer: mocks.getAppContainer }));

import { coreTechnicalOwner } from "@/app/api/practice/core-technical/_shared";

describe("Core Technical release request gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests before resolving application services", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await expect(coreTechnicalOwner()).rejects.toMatchObject({
      statusCode: 401,
      code: "AUTH_REQUIRED"
    });
    expect(mocks.getAppContainer).not.toHaveBeenCalled();
  });

  it.each([
    [
      "profile onboarding",
      candidateProfile({ onboardingCompletedAt: null, preparationCompletedAt: null }),
      "ONBOARDING_REQUIRED"
    ],
    [
      "preparation onboarding",
      candidateProfile({ onboardingCompletedAt: 1, preparationCompletedAt: null }),
      "PREPARATION_ONBOARDING_REQUIRED"
    ]
  ])("rejects requests before completed %s", async (_gate, profile, code) => {
    mocks.auth.mockResolvedValue({ userId: "candidate-1" });
    mocks.getAppContainer.mockReturnValue({
      profileService: { get: vi.fn().mockResolvedValue(profile) }
    });

    await expect(coreTechnicalOwner()).rejects.toMatchObject({ statusCode: 409, code });
  });

  it("returns only the authenticated owner context after both onboarding gates pass", async () => {
    const profile = candidateProfile({ onboardingCompletedAt: 1, preparationCompletedAt: 2 });
    const get = vi.fn().mockResolvedValue(profile);
    const app = { profileService: { get } };
    mocks.auth.mockResolvedValue({ userId: "candidate-1" });
    mocks.getAppContainer.mockReturnValue(app);

    await expect(coreTechnicalOwner()).resolves.toEqual({
      ownerId: "user:candidate-1",
      app,
      profile
    });
    expect(get).toHaveBeenCalledWith("user:candidate-1");
  });
});

function candidateProfile(input: {
  onboardingCompletedAt: number | null;
  preparationCompletedAt: number | null;
}): CandidateProfile {
  return {
    onboardingCompletedAt: input.onboardingCompletedAt,
    preparationOnboarding: { completedAt: input.preparationCompletedAt }
  } as CandidateProfile;
}
