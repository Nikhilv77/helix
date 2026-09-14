import { HiringManagerInterviewEntry } from "@/features/interviews/ui/hiring-manager/hiring-manager-interview-entry";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Hiring manager interview",
  "A final behavioural interview focused on communication, judgement, and how you work."
);

export default async function HiringManagerInterviewPage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const quota = await getAppContainer().interviewService.quota(ownerId).catch(() => null);

  return (
    <HiringManagerInterviewEntry
      sessionsRemaining={quota ? Math.max(0, quota.limit - quota.used) : null}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
      workspaceAccent={profile.workspaceAccent}
    />
  );
}
