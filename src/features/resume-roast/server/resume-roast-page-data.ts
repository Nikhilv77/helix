import type { CandidateProfile, CandidateResume } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import { RESUME_ROAST_GENERATION_STALE_MS, type ResumeRoastState } from "./resume-roast.service";

export interface ResumeRoastPageData {
  onboardingCompletedAt: number | null;
  preparationCompletedAt: number | null;
  resume: CandidateResume | null;
  /** What the in-page resume upload needs to re-read a new file. */
  targetRole: CandidateProfile["targetRole"];
  level: CandidateProfile["level"];
  state: ResumeRoastState;
}

/** One owner-scoped read for the page and its state API on warm visits. */
export async function loadResumeRoastPageData(ownerId: string): Promise<ResumeRoastPageData> {
  const app = getAppContainer();
  return app.workspacePageSnapshotStore.readOrBuild(ownerId, "resume-roast", () =>
    buildResumeRoastPageData(ownerId)
  );
}

/** Rebuilds the prepared page after a roast settles, so the next visit is warm. */
export async function refreshResumeRoastPageData(ownerId: string): Promise<void> {
  await getAppContainer().workspacePageSnapshotStore.readOrBuild(
    ownerId,
    "resume-roast",
    () => buildResumeRoastPageData(ownerId),
    { requireFresh: true }
  );
}

export async function buildResumeRoastPageData(ownerId: string) {
  const app = getAppContainer();
  const profilePromise = app.profileService.get(ownerId);
  const statePromise = app.resumeRoastService.state(ownerId, profilePromise);
  const [profile, state] = await Promise.all([profilePromise, statePromise]);
  return {
    cacheable: true,
    // A running roast is only reported until it could have finished; a
    // killed function must not leave the page showing "Analysing" forever.
    expiresAt: state.inProgress
      ? new Date(state.inProgress.startedAt + RESUME_ROAST_GENERATION_STALE_MS)
      : null,
    data: {
      onboardingCompletedAt: profile.onboardingCompletedAt,
      preparationCompletedAt: profile.preparationOnboarding.completedAt,
      resume: profile.resume,
      targetRole: profile.targetRole,
      level: profile.level,
      state
    } satisfies ResumeRoastPageData
  };
}
