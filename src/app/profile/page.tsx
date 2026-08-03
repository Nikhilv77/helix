import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CandidateProfileEditor } from "@/components/workspace/candidate-profile-editor";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const profile = await getAppContainer().profileService.get(authenticatedOwnerId(userId));
  return <CandidateProfileEditor initialProfile={profile} />;
}
