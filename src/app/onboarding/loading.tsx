import { BlueprintBackdrop } from "@/features/onboarding/ui/shared/onboarding-ui";

/**
 * While the server checks the profile, show the onboarding background itself
 * rather than the app-wide skeleton. The page then fades in once, over the
 * same surface, instead of replacing a dashboard-shaped placeholder.
 */
export default function OnboardingLoading() {
  return (
    <main
      className="blueprint onboarding-theme relative min-h-screen min-h-[100svh] overflow-x-hidden"
      aria-busy="true"
      aria-label="Loading onboarding"
    >
      <BlueprintBackdrop />
    </main>
  );
}
