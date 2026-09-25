import { ManageAccount } from "@/features/account/ui/manage-account";
import { privatePageMetadata } from "@/lib/shared/seo";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getManageAccountStateForRequest } from "@/features/profile/server/profile-query";
import { getUserIdForRequest } from "@/server/auth/request-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const unstable_dynamicStaleTime = 30;
export const metadata = privatePageMetadata(
  "Manage Account",
  "Manage your Trailgrad account settings."
);

export default async function ManagePage() {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");
  const profile = await getManageAccountStateForRequest(authenticatedOwnerId(userId));
  if (!profile.onboardingCompletedAt) redirect("/onboarding");
  if (!profile.preparationCompletedAt) redirect("/");
  return <ManageAccount profile={profile} />;
}
