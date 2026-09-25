import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { CandidatePracticeEvidence } from "@/features/practice/shared/domain/practice-evidence";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";

/**
 * Reuse a plan while its profile, interview sessions, and practice-attempt
 * source have not changed. The short expiry bounds any missed source update.
 * The owner id is always part of the key; no cached plan can cross accounts.
 */
export async function cachedPersonalizedPlan(
  ownerId: string,
  profile: CandidateProfile,
  loadPracticeEvidence?: () => Promise<CandidatePracticeEvidence | null>
) {
  const container = getAppContainer();
  const sourceWatermark = await container.personalizedPlanningStore.sourceWatermark(ownerId);
  // Appearance and notification edits update CandidateProfile.updatedAt but
  // do not change interview planning. Key the cache by planning inputs only.
  const profileRevision = createHash("sha256")
    .update(
      JSON.stringify({
        targetRole: profile.targetRole,
        level: profile.level,
        targetCompany: profile.targetCompany,
        targetDate: profile.targetDate,
        headline: profile.headline,
        context: profile.context,
        focusAreas: profile.focusAreas,
        stories: profile.stories,
        teacherId: profile.teacherId,
        preparationOnboarding: profile.preparationOnboarding,
        resumeVersion: profile.resume?.versionId ?? profile.resume?.contentFingerprint ?? null
      })
    )
    .digest("hex");
  return unstable_cache(
    () =>
      container.personalizedInterviewPlanningService.activePlan(ownerId, Date.now(), {
        profile,
        practiceEvidence: loadPracticeEvidence?.()
      }),
    [
      "personalized-plan-v1",
      ownerId,
      sourceWatermark,
      profileRevision,
      profile.resume?.versionId ?? profile.resume?.contentFingerprint ?? "",
      profile.targetRole ?? "",
      profile.level ?? ""
    ],
    { revalidate: 60 }
  )();
}
