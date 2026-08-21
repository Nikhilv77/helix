import { DsaInterviewEntry } from "@/components/interview/dsa/dsa-interview-entry";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "DSA interview",
  "A DSA interview with Maya based on the questions you have solved."
);

export default async function DsaInterviewEntryPage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const completed = await getAppContainer()
    .frontendRoadmapService.completedDsaQuestions(ownerId)
    .catch(() => []);

  return (
    <DsaInterviewEntry
      completedCount={completed.length}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
    />
  );
}
