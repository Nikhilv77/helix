import { SystemDesignInterviewEntry } from "@/features/interviews/ui/design/system-design-interview-entry";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "System Design interview",
  "A candidate-led system-design interview with requirement discovery, diagramming, deep dives, and pressure tests."
);

export default async function SystemDesignInterviewEntryPage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const quota = await getAppContainer()
    .interviewService.quota(ownerId)
    .catch(() => null);

  return (
    <SystemDesignInterviewEntry
      sessionsRemaining={quota ? Math.max(0, quota.limit - quota.used) : null}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
      workspaceAccent={profile.workspaceAccent}
    />
  );
}
