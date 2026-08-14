import { ManageAccount } from "@/components/workspace/manage-account";
import { privatePageMetadata } from "@/lib/seo";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Manage Account",
  "Manage your Trailgrad account settings."
);

export default async function ManagePage() {
  const { profile } = await requireOnboardedProfile();
  return <ManageAccount profile={profile} />;
}
