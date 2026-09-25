import type { CandidateProfile } from "@/lib/shared/types";
import { ApiRouteError } from "@/server/http/api-error";

/** API counterpart to the workspace route guard. */
export function requireCompletedPreparationOnboarding(profile: CandidateProfile): void {
  if (!profile.onboardingCompletedAt) {
    throw new ApiRouteError(409, "ONBOARDING_REQUIRED", "Finish onboarding first.");
  }
  if (!profile.preparationOnboarding?.completedAt) {
    throw new ApiRouteError(
      409,
      "PREPARATION_ONBOARDING_REQUIRED",
      "Finish your preparation setup and baseline first."
    );
  }
}

/** The same gate for endpoints that only need the small workspace projection. */
export function requireCompletedPreparationOnboardingState(
  state: { onboardingCompletedAt: number | null; preparationCompletedAt: number | null } | null
): asserts state is { onboardingCompletedAt: number; preparationCompletedAt: number } {
  if (!state?.onboardingCompletedAt) {
    throw new ApiRouteError(409, "ONBOARDING_REQUIRED", "Finish onboarding first.");
  }
  if (!state.preparationCompletedAt) {
    throw new ApiRouteError(
      409,
      "PREPARATION_ONBOARDING_REQUIRED",
      "Finish your preparation setup and baseline first."
    );
  }
}
