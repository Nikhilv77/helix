import type { RoadmapProgressStatus } from "@prisma/client";
import { PracticeSessionsView } from "@/components/workspace/practice/practice-sessions-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { Logger } from "@/server/common/logger";
import { buildStableDsaRecommendation } from "@/server/dsa/stable-dsa-recommendation";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Practice",
  "The DSA patterns and questions in your Trailgrad preparation path."
);
const logger = new Logger("PracticePage");

/** The six-session Practice entry point, visually paired with Interviews. */
export default async function PracticePage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const container = getAppContainer();
  let generationFailed = false;
  const [practiceRoadmap, activity, dsaPlan, questionStatuses, practiceEvidence] =
    await Promise.all([
      container.practiceRoadmapService.home(ownerId).catch((error) => {
        generationFailed = true;
        logger.error({
          event: "practice.roadmap_generation_failed",
          ownerId,
          reason: error instanceof Error ? error.message : "unknown"
        });
        return null;
      }),
      container.practiceRoadmapService.activity(ownerId, 7).catch(() => []),
      container.dsaService.fullPlan().catch(() => null),
      container.frontendRoadmapService
        .questionStatuses(ownerId)
        .catch((): Record<string, RoadmapProgressStatus> => ({})),
      container.practiceEvidenceStore.refresh(ownerId).catch(() => null)
    ]);
  const dsaRecommendation = dsaPlan
    ? await buildStableDsaRecommendation({
        ownerId,
        plan: dsaPlan,
        profile,
        evidence: practiceEvidence,
        statuses: questionStatuses,
        blockStore: container.dsaPracticeBlockStore,
        finalizationService: container.dsaBlockAssessmentFinalizationService
      })
    : null;
  const dsaBlockCompletedQuestions =
    dsaRecommendation?.questions.filter(
      (question) => questionStatuses[question.slug] === "COMPLETED"
    ).length ?? 0;

  return (
    <PracticeSessionsView
      practiceRoadmap={practiceRoadmap}
      activity={activity}
      dsaRecommendation={dsaRecommendation}
      dsaBlockCompletedQuestions={dsaBlockCompletedQuestions}
      generationFailed={generationFailed}
    />
  );
}
