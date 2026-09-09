import type { CandidateProfile } from "@/lib/shared/types";

export type HomeSurface = "marketing" | "onboarding" | "preparation" | "overview";

interface HomeRouteStateInput {
  clerkEnabled: boolean;
  userId: string | null;
  profile: Pick<CandidateProfile, "onboardingCompletedAt" | "preparationOnboarding"> | null;
  welcomeRequested: boolean;
}

/** Keeps the multiplexed `/` route decision explicit and independently testable. */
export function resolveHomeSurface({
  clerkEnabled,
  userId,
  profile,
  welcomeRequested
}: HomeRouteStateInput): HomeSurface {
  if (!clerkEnabled || !userId) return "marketing";
  if (!profile?.onboardingCompletedAt) return "onboarding";
  if (!profile.preparationOnboarding.completedAt || welcomeRequested) return "preparation";
  return "overview";
}
