import { PracticeSessionsView } from "@/features/practice/shared/ui/practice-sessions-view";
import { loadPracticeHomeView } from "@/features/practice/shared/server/practice-home-loader";
import { privatePageMetadata } from "@/lib/shared/seo";
import { redirect } from "next/navigation";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getAppContainer } from "@/server/app-container";
import { getUserIdForRequest } from "@/server/auth/request-user";

export const dynamic = "force-dynamic";
export const unstable_dynamicStaleTime = 30;
export const maxDuration = 60;
export const metadata = privatePageMetadata(
  "Practice",
  "The DSA patterns and questions in your Trailgrad preparation path."
);

export default async function PracticePage() {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");
  const ownerId = authenticatedOwnerId(userId);
  const snapshot = getAppContainer().practiceHomeSnapshotStore;
  const props = await snapshot.readOrBuild(ownerId, async () => {
    const profile = await getAppContainer().profileService.get(ownerId);
    if (!profile.onboardingCompletedAt) redirect("/onboarding");
    if (!profile.preparationOnboarding.completedAt) redirect("/");
    return loadPracticeHomeView(ownerId, profile);
  });
  return <PracticeSessionsView {...props} />;
}
