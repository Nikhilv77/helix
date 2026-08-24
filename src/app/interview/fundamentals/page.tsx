import { FundamentalsInterviewEntry } from "@/components/interview/fundamentals/fundamentals-interview-entry";
import { FUNDAMENTALS_AREAS } from "@/lib/fundamentals/areas";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Computer fundamentals",
  "A fundamentals interview with Maya across networking, browser behaviour and databases."
);

export default async function FundamentalsInterviewEntryPage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const quota = await getAppContainer().interviewService.quota(ownerId).catch(() => null);

  return (
    <FundamentalsInterviewEntry
      sessionsRemaining={quota ? Math.max(0, quota.limit - quota.used) : null}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
      areas={FUNDAMENTALS_AREAS.map((area) => area.title)}
      workspaceAccent={profile.workspaceAccent}
    />
  );
}
