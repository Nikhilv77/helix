import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "@/lib/shared/types";
import { resolveHomeSurface } from "./home-route-state";

const completedProfile = {
  onboardingCompletedAt: 1,
  preparationOnboarding: { completedAt: 2 }
} as CandidateProfile;

describe("resolveHomeSurface", () => {
  it.each([
    {
      name: "Clerk is disabled",
      input: { clerkEnabled: false, userId: null, profile: null, welcomeRequested: false },
      expected: "marketing"
    },
    {
      name: "the visitor is signed out",
      input: { clerkEnabled: true, userId: null, profile: null, welcomeRequested: false },
      expected: "marketing"
    },
    {
      name: "the signed-in user has no profile",
      input: { clerkEnabled: true, userId: "user-1", profile: null, welcomeRequested: false },
      expected: "onboarding"
    },
    {
      name: "profile onboarding is incomplete",
      input: {
        clerkEnabled: true,
        userId: "user-1",
        profile: { ...completedProfile, onboardingCompletedAt: null },
        welcomeRequested: false
      },
      expected: "onboarding"
    },
    {
      name: "preparation onboarding is incomplete",
      input: {
        clerkEnabled: true,
        userId: "user-1",
        profile: {
          ...completedProfile,
          preparationOnboarding: { ...completedProfile.preparationOnboarding, completedAt: null }
        },
        welcomeRequested: false
      },
      expected: "preparation"
    },
    {
      name: "a completed user explicitly requests the welcome flow",
      input: {
        clerkEnabled: true,
        userId: "user-1",
        profile: completedProfile,
        welcomeRequested: true
      },
      expected: "preparation"
    },
    {
      name: "all onboarding is complete",
      input: {
        clerkEnabled: true,
        userId: "user-1",
        profile: completedProfile,
        welcomeRequested: false
      },
      expected: "overview"
    }
  ])("selects $expected when $name", ({ input, expected }) => {
    expect(resolveHomeSurface(input)).toBe(expected);
  });
});
