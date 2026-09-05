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
