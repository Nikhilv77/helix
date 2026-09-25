import type { CandidateResume } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import type { ResumeRoastState } from "./resume-roast.service";

export interface ResumeRoastPageData {
  onboardingCompletedAt: number | null;
  preparationCompletedAt: number | null;
  resume: CandidateResume | null;
  state: ResumeRoastState;
}

/** One owner-scoped read for the page and its state API on warm visits. */
export async function loadResumeRoastPageData(ownerId: string): Promise<ResumeRoastPageData> {
  const app = getAppContainer();
  return app.workspacePageSnapshotStore.readOrBuild(ownerId, "resume-roast", () =>
    buildResumeRoastPageData(ownerId)
  );
}

export async function buildResumeRoastPageData(ownerId: string) {
  const app = getAppContainer();
  const profilePromise = app.profileService.get(ownerId);
  const statePromise = app.resumeRoastService.state(ownerId, profilePromise);
  const [profile, state] = await Promise.all([profilePromise, statePromise]);
  return {
    cacheable: true,
    data: {
      onboardingCompletedAt: profile.onboardingCompletedAt,
      preparationCompletedAt: profile.preparationOnboarding.completedAt,
      resume: profile.resume,
      state
    } satisfies ResumeRoastPageData
  };
}
