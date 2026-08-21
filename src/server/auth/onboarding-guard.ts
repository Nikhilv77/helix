import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export async function requireOnboardedProfile(): Promise<{
  userId: string;
  ownerId: string;
  profile: CandidateProfile;
}> {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const ownerId = authenticatedOwnerId(userId);
  const profile = await getAppContainer().profileService.get(ownerId);
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  return { userId, ownerId, profile };
}
