import { DsaInterviewEntry } from "@/components/interview/dsa/dsa-interview-entry";
import { OPERATION_DSA_SLUGS } from "@/lib/dsa/dsa-code-templates";
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
  const app = getAppContainer();
  const [completed, quota] = await Promise.all([
    app.frontendRoadmapService.completedDsaQuestions(ownerId).catch(() => []),
    app.interviewService.quota(ownerId).catch(() => null)
  ]);
  // Matches the readiness gate in /api/interview/dsa/start, so the count Maya
  // reads out is the count that decides whether the round can start.
  const eligible = completed.filter((question) => !OPERATION_DSA_SLUGS.has(question.slug));

  return (
    <DsaInterviewEntry
      completedCount={eligible.length}
      sessionsRemaining={quota ? Math.max(0, quota.limit - quota.used) : null}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
      workspaceAccent={profile.workspaceAccent}
    />
  );
}
