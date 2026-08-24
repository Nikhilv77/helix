import { ResumeInterviewEntry } from "@/components/interview/resume/resume-interview-entry";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Resume interview",
  "A staged resume interview with Maya, built from the skills and work on your own resume."
);

export default async function ResumeInterviewEntryPage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const quota = await getAppContainer().interviewService.quota(ownerId).catch(() => null);

  return (
    <ResumeInterviewEntry
      hasResume={Boolean(profile.resume)}
      sessionsRemaining={quota ? Math.max(0, quota.limit - quota.used) : null}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
      skills={profile.resume?.skills ?? []}
      workspaceAccent={profile.workspaceAccent}
    />
  );
}
