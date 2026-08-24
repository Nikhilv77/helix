import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import InterviewSetupClient from "./interview-setup-client";

export const dynamic = "force-dynamic";

export default async function InterviewSetupPage() {
  const { profile } = await requireOnboardedProfile();

  return <InterviewSetupClient workspaceAccent={profile.workspaceAccent} />;
}
