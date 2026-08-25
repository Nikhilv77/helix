import type { CandidateProfile } from "../shared/types";
import { ApiClientError, getProfile, reconcileInterviewOwner } from "../api/api-client";

interface PostAuthDependencies {
  reconcile(): Promise<{ moved: number }>;
  loadProfile(): Promise<CandidateProfile>;
}

const defaultDependencies: PostAuthDependencies = {
  reconcile: reconcileInterviewOwner,
  loadProfile: getProfile
};

/**
 * Claims this browser's anonymous interviews before the first signed-in page
 * decides where to send the user. A 401 means Clerk has not reached the route
 * handler yet and must be retried by the continuation screen. Other failures
 * do not block sign-in; the Reports page remains a later repair path.
 */
export async function loadPostAuthProfile(
  dependencies: PostAuthDependencies = defaultDependencies
): Promise<CandidateProfile> {
  try {
    await dependencies.reconcile();
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) throw error;
  }

  return dependencies.loadProfile();
}
