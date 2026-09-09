import type { RoadmapProgressStatus } from "@prisma/client";
import { PracticeSessionsView } from "@/features/practice/shared/ui/practice-sessions-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { Logger } from "@/server/common/logger";
import { buildStableDsaRecommendation } from "@/features/practice/dsa/server/stable-dsa-recommendation";
import { coreTechnicalPracticeEntry } from "@/features/practice/core-technical/domain/ui-state";
import { mergePracticeActivity } from "@/features/practice/core-technical/domain/workspace-analytics";
import type { CoreTechnicalEligibility } from "@/features/practice/core-technical/server/eligibility.service";
import { appliedEngineeringPracticeEntry } from "@/features/practice/applied-engineering/domain/ui-state";
import type { AppliedEngineeringEligibility } from "@/features/practice/applied-engineering/server/eligibility.service";
import { architectureDesignPracticeEntry } from "@/features/practice/architecture-design/domain/ui-state";
import type { ArchitectureDesignEligibility } from "@/features/practice/architecture-design/server/eligibility.service";

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
    coreTechnicalAnalytics,
    appliedEngineeringEligibility,
    appliedEngineeringBlock,
    appliedEngineeringAnalytics,
    architectureDesignEligibility,
    architectureDesignBlock,
    architectureDesignAnalytics
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
    container.coreTechnicalWorkspaceAnalyticsService.practice(ownerId, 7).catch(() => null),
    container.appliedEngineeringEligibilityService
      .forProfile(profile)
      .catch((): AppliedEngineeringEligibility => unavailableAppliedEngineering()),
    container.appliedEngineeringPracticeService.current(ownerId).catch(() => null),
    container.appliedEngineeringWorkspaceAnalyticsService.practice(ownerId, 7).catch(() => null),
    container.architectureDesign.eligibility
      .forProfile(profile)
      .catch((): ArchitectureDesignEligibility => unavailableArchitectureDesign()),
    container.architectureDesign.practice.current(ownerId).catch(() => null),
    container.architectureDesign.workspaceAnalytics.practice(ownerId, 7).catch(() => null)
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
      activity={mergePracticeActivity(
        mergePracticeActivity(
          mergePracticeActivity(activity, coreTechnicalAnalytics?.activity ?? []),
          appliedEngineeringAnalytics?.activity ?? []
        ),
        architectureDesignAnalytics?.activity ?? []
      )}
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
      appliedEngineeringEntry={appliedEngineeringPracticeEntry(
        appliedEngineeringEligibility,
        appliedEngineeringBlock
      )}
      appliedEngineeringTotals={
        appliedEngineeringAnalytics
          ? {
              totalQuestions: appliedEngineeringAnalytics.totalQuestions,
              completedQuestions: appliedEngineeringAnalytics.completedQuestions
            }
          : null
      }
      architectureDesignEntry={
        practiceRoadmap
          ? architectureDesignPracticeEntry(architectureDesignEligibility, architectureDesignBlock)
          : null
      }
      architectureDesignTotals={
        architectureDesignAnalytics
          ? {
              totalQuestions: architectureDesignAnalytics.totalQuestions,
              completedQuestions: architectureDesignAnalytics.completedQuestions
            }
          : null
      }
      generationFailed={generationFailed}
    />
  );
}

function unavailableArchitectureDesign(): ArchitectureDesignEligibility {
  return {
    available: false,
    reason: "CONTENT_UNAVAILABLE",
    message: "The reviewed Architecture & Design scenario path is not available yet.",
    requiredScenarioCount: 2,
    publishedScenarioCount: 0,
    scenarios: []
  };
}

function unavailableAppliedEngineering(): AppliedEngineeringEligibility {
  return {
    available: false,
    reason: "CONTENT_UNAVAILABLE",
    message: "The reviewed Node.js incident path is not available yet.",
    stack: { language: "javascript", runtime: "nodejs", runtimeVersion: "22 LTS" },
    requiredIncidentCount: 2,
    publishedIncidentCount: 0,
    incidents: []
  };
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
