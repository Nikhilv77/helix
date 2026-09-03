import { ResumeRoastWorkspace } from "@/components/resume-roast/resume-roast-workspace";
import { privatePageMetadata } from "@/lib/shared/seo";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Resume Roast",
  "Get a funny, evidence-grounded review of your saved resume from James."
);

export default async function ResumeRoastPage() {
  const { profile } = await requireOnboardedProfile();
  return <ResumeRoastWorkspace resume={profile.resume} />;
}
