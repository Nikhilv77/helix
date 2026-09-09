import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { CandidateProfile } from "@/lib/shared/types";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getProfileForRequest } from "@/features/profile/server/profile-query";

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
  if (!profile.preparationOnboarding.completedAt) redirect("/");

  return { userId, ownerId, profile };
}
