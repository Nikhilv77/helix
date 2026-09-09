import { NextRequest } from "next/server";
import type { CandidateProfile } from "@/lib/shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appliedEngineeringFocusConfirmationSchema } from "./focus.service";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  enforce: vi.fn(),
  getAppContainer: vi.fn(),
  getSharedGuard: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/server/app-container", () => ({ getAppContainer: mocks.getAppContainer }));
vi.mock("@/server/rate-limit/shared-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rate-limit/shared-guard")>();
  return { ...actual, getSharedGuard: mocks.getSharedGuard };
});

import {
  appliedEngineeringOwner,
  parseAppliedEngineeringJson,
  requireAppliedEngineeringEligibility
} from "@/app/api/practice/applied-engineering/_shared";

describe("Applied Engineering request gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSharedGuard.mockReturnValue({ enforce: mocks.enforce });
  });

  it("rejects unauthenticated requests before resolving application services", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await expect(appliedEngineeringOwner()).rejects.toMatchObject({
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

    await expect(appliedEngineeringOwner()).rejects.toMatchObject({ statusCode: 409, code });
  });

  it("enforces the requested shared rate-limit policy for the authenticated owner", async () => {
    const profile = candidateProfile({ onboardingCompletedAt: 1, preparationCompletedAt: 2 });
    const app = {
      config: { nodeEnv: "test" },
      profileService: { get: vi.fn().mockResolvedValue(profile) }
    };
    const policy = { namespace: "applied-engineering-test" } as never;
    mocks.auth.mockResolvedValue({ userId: "candidate-1" });
    mocks.getAppContainer.mockReturnValue(app);

    await expect(appliedEngineeringOwner(policy)).resolves.toEqual({
      ownerId: "user:candidate-1",
      app,
      profile
    });
    expect(mocks.enforce).toHaveBeenCalledWith(policy, "user:candidate-1");
  });

  it("rejects malformed or over-posted JSON through strict route schemas", async () => {
    const request = new NextRequest("http://localhost/api/practice/applied-engineering/confirm", {
      method: "POST",
      body: JSON.stringify({ language: "javascript", resumeEvidence: ["must-not-be-client-owned"] }),
      headers: { "content-type": "application/json" }
    });

    await expect(
      parseAppliedEngineeringJson(request, appliedEngineeringFocusConfirmationSchema)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "APPLIED_ENGINEERING_INVALID_REQUEST"
    });
  });

  it("maps fail-closed launch eligibility to bounded API errors", async () => {
    const profile = candidateProfile({ onboardingCompletedAt: 1, preparationCompletedAt: 2 });
    const app = {
      appliedEngineeringEligibilityService: {
        forProfile: vi.fn().mockResolvedValue({
          available: false,
          reason: "RUNNER_UNAVAILABLE",
          message: "The pinned runner is unavailable."
        })
      }
    } as never;

    await expect(requireAppliedEngineeringEligibility(app, profile)).rejects.toMatchObject({
      statusCode: 503,
      code: "APPLIED_ENGINEERING_RUNNER_UNAVAILABLE",
      message: "The pinned runner is unavailable."
    });
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
