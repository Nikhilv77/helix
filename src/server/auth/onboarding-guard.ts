import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { CandidateProfile } from "@/lib/shared/types";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getProfileForRequest } from "@/server/profile/profile-query";

export async function requireOnboardedProfile(): Promise<{
  userId: string;
  ownerId: string;
  profile: CandidateProfile;
}> {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const ownerId = authenticatedOwnerId(userId);
  const profile = await getProfileForRequest(ownerId);
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  return { userId, ownerId, profile };
}
