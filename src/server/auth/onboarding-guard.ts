import { redirect } from "next/navigation";
import type { CandidateProfile } from "@/lib/shared/types";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import {
  getProfileForRequest,
  getWorkspaceShellStateForRequest
} from "@/features/profile/server/profile-query";
import { getUserIdForRequest } from "@/server/auth/request-user";

export async function requireOnboardedProfile(): Promise<{
  userId: string;
  ownerId: string;
  profile: CandidateProfile;
}> {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");

  const ownerId = authenticatedOwnerId(userId);
  const profile = await getProfileForRequest(ownerId);
  if (!profile.onboardingCompletedAt) redirect("/onboarding");
  if (!profile.preparationOnboarding.completedAt) redirect("/");

  return { userId, ownerId, profile };
}

/** Gate pages that do not need the resume-backed profile payload. */
export async function requireOnboardedOwner(): Promise<{
  userId: string;
  ownerId: string;
  targetRole: CandidateProfile["targetRole"];
  workspaceAccent: CandidateProfile["workspaceAccent"];
}> {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");

  const ownerId = authenticatedOwnerId(userId);
  const profile = await getWorkspaceShellStateForRequest(ownerId);
  if (!profile?.onboardingCompletedAt) redirect("/onboarding");
  if (!profile.preparationCompletedAt) redirect("/");
  return {
    userId,
    ownerId,
    targetRole: profile.targetRole,
    workspaceAccent: profile.workspaceAccent
  };
}
