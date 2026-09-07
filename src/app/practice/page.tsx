import type { RoadmapProgressStatus } from "@prisma/client";
import { PracticeSessionsView } from "@/components/workspace/practice/practice-sessions-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { Logger } from "@/server/common/logger";
import { buildStableDsaRecommendation } from "@/server/dsa/stable-dsa-recommendation";
import { coreTechnicalPracticeEntry } from "@/lib/practice/core-technical/ui-state";
import { mergePracticeActivity } from "@/lib/practice/core-technical/workspace-analytics";
import type { CoreTechnicalEligibility } from "@/server/core-technical/eligibility.service";

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
  const [
    practiceRoadmap,
    activity,
    dsaPlan,
    questionStatuses,
    practiceEvidence,
    coreTechnicalEligibility,
    coreTechnicalBlock,
    coreTechnicalAnalytics
  ] = await Promise.all([
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
    container.practiceEvidenceStore.refresh(ownerId).catch(() => null),
    container.coreTechnicalEligibilityService
      .forProfile(profile)
      .catch((): CoreTechnicalEligibility => unavailableCoreTechnical()),
    container.coreTechnicalPracticeService.current(ownerId).catch(() => null),
    container.coreTechnicalWorkspaceAnalyticsService.practice(ownerId, 7).catch(() => null)
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
      activity={mergePracticeActivity(activity, coreTechnicalAnalytics?.activity ?? [])}
      dsaRecommendation={dsaRecommendation}
      dsaBlockCompletedQuestions={dsaBlockCompletedQuestions}
      coreTechnicalEntry={coreTechnicalPracticeEntry(coreTechnicalEligibility, coreTechnicalBlock)}
      coreTechnicalTotals={
        coreTechnicalAnalytics
          ? {
              totalQuestions: coreTechnicalAnalytics.totalQuestions,
              completedQuestions: coreTechnicalAnalytics.completedQuestions
            }
          : null
      }
      generationFailed={generationFailed}
    />
  );
}

function unavailableCoreTechnical(): CoreTechnicalEligibility {
  return {
    available: false,
    reason: "CONTENT_UNAVAILABLE",
    message: "The reviewed Node.js story path is not available yet.",
    stack: { language: "javascript", runtime: "nodejs", runtimeVersion: "22 LTS" },
    requiredStoryCount: 2,
    publishedStoryCount: 0,
    stories: []
  };
}
