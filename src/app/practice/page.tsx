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
import { aiMlPracticeQuestionCount } from "@/features/practice/ai-ml/domain/ai-ml-story-catalog";
import type { AiMlPracticeEntry } from "@/features/practice/shared/domain/practice-roadmap";
import type { AiMlPracticeSummary } from "@/features/practice/ai-ml/server/ai-ml-practice.service";
import { includesDsaPulse } from "@/features/preparation-onboarding/domain/preparation-onboarding";

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
  let aiMlProgressFailed = false;
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
    architectureDesignAnalytics,
    aiMlSummaries
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
      .catch((error): ArchitectureDesignEligibility => {
        logger.error({
          event: "practice.architecture_eligibility_read_failed",
          ownerId,
          reason: error instanceof Error ? error.message : "unknown"
        });
        return unavailableArchitectureDesign();
      }),
    container.architectureDesign.practice.current(ownerId).catch(() => null),
    container.architectureDesign.workspaceAnalytics.practice(ownerId, 7).catch(() => null),
    profile.targetRole === "ai-ml"
      ? container.aiMlPracticeService.summaries(ownerId).catch((error) => {
          aiMlProgressFailed = true;
          logger.error({
            event: "practice.ai_ml_progress_read_failed",
            ownerId,
            reason: error instanceof Error ? error.message : "unknown"
          });
          return [];
        })
      : Promise.resolve([])
  ]);
  const dsaRecommendation =
    dsaPlan && includesDsaPulse(profile.targetRole ?? "fullstack")
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
      aiMlProgressFailed={aiMlProgressFailed}
      aiMlEntries={
        profile.targetRole === "ai-ml"
          ? aiMlPracticeEntries(
              aiMlSummaries,
              architectureDesignPracticeEntry(
                architectureDesignEligibility,
                architectureDesignBlock
              )
            )
          : []
      }
    />
  );
}

function aiMlPracticeEntries(
  summaries: AiMlPracticeSummary[],
  architecture: ReturnType<typeof architectureDesignPracticeEntry>
): AiMlPracticeEntry[] {
  const summaryByTrack = new Map(summaries.map((summary) => [summary.track, summary]));
  const core = summaryByTrack.get("core-technical");
  const applied = summaryByTrack.get("applied-engineering");
  return [
    {
      key: "ai-ml-core-technical",
      order: 1,
      title: "Core Technical · AI/ML",
      purpose: "Reason through models, evaluation, data quality, retrieval, and ML fundamentals.",
      covers: ["Model evaluation", "Data and features", "Retrieval and LLM reasoning"],
      difficulty: "guided",
      durationMinutes: 35,
      availability: "available",
      status: progressStatus(
        core?.completedQuestions ?? 0,
        core?.totalQuestions ?? aiMlPracticeQuestionCount("core-technical")
      ),
      totalQuestions: core?.totalQuestions ?? aiMlPracticeQuestionCount("core-technical"),
      attemptedQuestions: core?.completedQuestions ?? 0,
      completedQuestions: core?.completedQuestions ?? 0,
      progressPercent: core?.progressPercent ?? 0,
      href: "/practice/ai-ml/core-technical"
    },
    {
      key: "ai-ml-applied-engineering",
      order: 2,
      title: "Applied Engineering · AI/ML",
      purpose:
        "Diagnose realistic production model, retrieval, safety, latency, and rollout problems.",
      covers: ["Production diagnosis", "Safe model delivery", "Observability and operations"],
      difficulty: "guided",
      durationMinutes: 40,
      availability: "available",
      status: progressStatus(
        applied?.completedQuestions ?? 0,
        applied?.totalQuestions ?? aiMlPracticeQuestionCount("applied-engineering")
      ),
      totalQuestions: applied?.totalQuestions ?? aiMlPracticeQuestionCount("applied-engineering"),
      attemptedQuestions: applied?.completedQuestions ?? 0,
      completedQuestions: applied?.completedQuestions ?? 0,
      progressPercent: applied?.progressPercent ?? 0,
      href: "/practice/ai-ml/applied-engineering"
    },
    {
      key: "ai-ml-architecture-design",
      order: 3,
      title: "Architecture & Design · AI/ML",
      purpose:
        "Design production AI systems across data, serving, retrieval, evaluation, and safety.",
      covers: [
        "Requirements and data flow",
        "Model and retrieval architecture",
        "Scale and reliability"
      ],
      difficulty: architecture.difficulty ?? "adaptive",
      durationMinutes: architecture.durationMinutes ?? 45,
      availability: architecture.availability,
      availabilityLabel: architecture.availabilityLabel,
      status: architecture.status,
      totalQuestions: architecture.totalQuestions,
      attemptedQuestions: architecture.attemptedQuestions,
      completedQuestions: architecture.completedQuestions,
      progressPercent: architecture.progressPercent,
      href: architecture.href
    }
  ];
}

function progressStatus(completed: number, total: number): "ACTIVE" | "IN_PROGRESS" | "COMPLETED" {
  if (total > 0 && completed >= total) return "COMPLETED";
  return completed > 0 ? "IN_PROGRESS" : "ACTIVE";
}

function unavailableArchitectureDesign(): ArchitectureDesignEligibility {
  return {
    available: false,
    reason: "CONTENT_UNAVAILABLE",
    message: "Architecture & Design availability could not be checked. Please refresh the page.",
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
