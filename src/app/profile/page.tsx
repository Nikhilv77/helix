import { CandidateProfileEditor } from "@/components/workspace/profile/candidate-profile-editor";
import { privatePageMetadata } from "@/lib/seo";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "My Profile",
  "Review and edit the resume-grounded interview memory Trailgrad uses for practice."
);

export default async function ProfilePage() {
  const { profile } = await requireOnboardedProfile();
  return <CandidateProfileEditor initialProfile={profile} />;
}
