import type { RoadmapProgressStatus } from "@prisma/client";
import { PracticeSessionsView } from "@/features/practice/shared/ui/practice-sessions-view";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { buildStableDsaRecommendation } from "@/features/practice/dsa/server/stable-dsa-recommendation";
import { coreTechnicalPracticeEntry } from "@/features/practice/core-technical/domain/ui-state";
import { mergePracticeActivity } from "@/features/practice/core-technical/domain/workspace-analytics";
import type { CoreTechnicalEligibility } from "@/features/practice/core-technical/server/eligibility.service";
import { appliedEngineeringPracticeEntry } from "@/features/practice/applied-engineering/domain/ui-state";
import type { AppliedEngineeringEligibility } from "@/features/practice/applied-engineering/server/eligibility.service";
import { architectureDesignPracticeEntry } from "@/features/practice/architecture-design/domain/ui-state";
import type { ArchitectureDesignEligibility } from "@/features/practice/architecture-design/server/eligibility.service";
import {
  storyDiscipline,
  storyDisciplineForRole,
  storyTrackHref,
  storyTrackQuestionTotal,
  type StoryDiscipline
} from "@/features/practice/story-tracks/domain/story-disciplines";
import type { StoryPracticeEntry } from "@/features/practice/shared/domain/practice-roadmap";
import type { AiMlPracticeSummary } from "@/features/practice/ai-ml/server/ai-ml-practice.service";
import type { CandidateProfile } from "@/lib/shared/types";
import { includesDsaPulse } from "@/features/preparation-onboarding/domain/preparation-onboarding";
import { cachedPersonalizedPlan } from "@/features/interviews/server/cached-personalized-plan";
import { unstable_cache } from "next/cache";

const logger = new Logger("PracticePage");

export async function loadPracticeHomeView(ownerId: string, profile: CandidateProfile) {
  const container = getAppContainer();
  const discipline = storyDisciplineForRole(profile.targetRole);
  // AI/ML replaces the DSA roadmap entirely; frontend and data keep DSA and
  // add their story tracks alongside it.
  const aiMlPractice = discipline === "ai-ml";
  // Node.js Core Technical and Applied Engineering serve backend and full-stack paths.
  const nodeTracks = discipline === null;
  const architectureTrack =
    nodeTracks || (discipline !== null && storyDiscipline(discipline).includesArchitecture);
  const hasDsaPulse = !aiMlPractice && includesDsaPulse(profile.targetRole ?? "fullstack");
  let generationFailed = false;
  let storyProgressFailed = false;
  let transientFailure = false;
  const recover = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
    promise.catch(() => {
      transientFailure = true;
      return fallback;
    });
  let practiceEvidencePromise: Promise<
    Awaited<ReturnType<typeof container.practiceEvidenceStore.refresh>>
  > | null = null;
  const loadPracticeEvidence = () =>
    (practiceEvidencePromise ??= container.practiceEvidenceStore.refresh(ownerId));
  const planPromise = aiMlPractice
    ? null
    : cachedPersonalizedPlan(ownerId, profile, loadPracticeEvidence);
  const practiceRoadmapPromise = aiMlPractice
    ? Promise.resolve(null)
    : container.practiceRoadmapService
        .home(ownerId, undefined, profile, planPromise ?? undefined, (stamp, plan, load) =>
          unstable_cache(
            load,
            [
              "practice-roadmap-v1",
              ownerId,
              plan.id,
              String(plan.revision),
              stamp.updatedAt.toISOString(),
              String(stamp.templateVersion ?? "")
            ],
            { revalidate: 60 }
          )()
        )
        .catch((error) => {
          generationFailed = true;
          logger.error({
            event: "practice.roadmap_generation_failed",
            ownerId,
            reason: error instanceof Error ? error.message : "unknown"
          });
          return null;
        });
  const dsaPlanPromise = !hasDsaPulse
    ? Promise.resolve(null)
    : recover(container.dsaService.fullPlan(), null);
  const dsaCurrentBlockPromise = hasDsaPulse
    ? container.dsaPracticeBlockStore.currentWithReadiness(ownerId)
    : Promise.resolve(null);
  const questionStatusesPromise = aiMlPractice
    ? Promise.resolve({} as Record<string, RoadmapProgressStatus>)
    : recover(
        container.frontendRoadmapService.questionStatuses(ownerId),
        {} as Record<string, RoadmapProgressStatus>
      );
  const dsaRecommendationPromise = Promise.all([
    practiceRoadmapPromise,
    dsaPlanPromise,
    questionStatusesPromise,
    dsaCurrentBlockPromise
  ]).then(([roadmap, dsaPlan, statuses, currentBlock]) =>
    roadmap && dsaPlan && hasDsaPulse
      ? buildStableDsaRecommendation({
          ownerId,
          plan: dsaPlan,
          profile,
          evidence: null,
          loadEvidence: () => recover(loadPracticeEvidence(), null),
          statuses,
          currentBlock: Promise.resolve(currentBlock),
          blockStore: container.dsaPracticeBlockStore,
          finalizationService: container.dsaBlockAssessmentFinalizationService
        })
      : null
  );
  const [
    practiceRoadmap,
    activity,
    questionStatuses,
    dsaRecommendation,
    coreTechnicalEligibility,
    coreTechnicalBlock,
    coreTechnicalAnalytics,
    appliedEngineeringEligibility,
    appliedEngineeringBlock,
    appliedEngineeringAnalytics,
    architectureDesignEligibility,
    architectureDesignBlock,
    architectureDesignAnalytics,
    storySummaries
  ] = await Promise.all([
    practiceRoadmapPromise,
    aiMlPractice
      ? Promise.resolve([])
      : recover(container.practiceRoadmapService.activity(ownerId, 7), []),
    questionStatusesPromise,
    dsaRecommendationPromise,
    !nodeTracks
      ? Promise.resolve(unavailableCoreTechnical())
      : recover(
          container.coreTechnicalEligibilityService.forProfile(profile),
          unavailableCoreTechnical()
        ),
    !nodeTracks
      ? Promise.resolve(null)
      : recover(container.coreTechnicalPracticeService.currentEntryBlock(ownerId), null),
    !nodeTracks
      ? Promise.resolve(null)
      : recover(container.coreTechnicalWorkspaceAnalyticsService.entrySummary(ownerId, 7), null),
    !nodeTracks
      ? Promise.resolve(unavailableAppliedEngineering())
      : recover(
          container.appliedEngineeringEligibilityService.forProfile(profile),
          unavailableAppliedEngineering()
        ),
    !nodeTracks
      ? Promise.resolve(null)
      : recover(container.appliedEngineeringPracticeService.currentEntryBlock(ownerId), null),
    !nodeTracks
      ? Promise.resolve(null)
      : recover(
          container.appliedEngineeringWorkspaceAnalyticsService.entrySummary(ownerId, 7),
          null
        ),
    !architectureTrack
      ? Promise.resolve(unavailableArchitectureDesign())
      : container.architectureDesign.eligibility
          .forProfile(profile)
          .catch((error): ArchitectureDesignEligibility => {
            transientFailure = true;
            logger.error({
              event: "practice.architecture_eligibility_read_failed",
              ownerId,
              reason: error instanceof Error ? error.message : "unknown"
            });
            return unavailableArchitectureDesign();
          }),
    !architectureTrack
      ? Promise.resolve(null)
      : recover(container.architectureDesign.practice.currentEntryBlock(ownerId), null),
    !architectureTrack
      ? Promise.resolve(null)
      : recover(container.architectureDesign.workspaceAnalytics.entrySummary(ownerId, 7), null),
    discipline
      ? container.aiMlPracticeService.summaries(ownerId, discipline).catch((error) => {
          storyProgressFailed = true;
          logger.error({
            event: "practice.story_progress_read_failed",
            discipline,
            ownerId,
            reason: error instanceof Error ? error.message : "unknown"
          });
          return [];
        })
      : Promise.resolve([])
  ]);
  const dsaBlockCompletedQuestions =
    dsaRecommendation?.questions.filter(
      (question) => questionStatuses[question.slug] === "COMPLETED"
    ).length ?? 0;

  const view = (
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
        practiceRoadmap && architectureTrack
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
      storyProgressFailed={storyProgressFailed}
      storyEntries={
        discipline
          ? storyPracticeEntries(
              discipline,
              storySummaries,
              aiMlPractice
                ? architectureDesignPracticeEntry(
                    architectureDesignEligibility,
                    architectureDesignBlock
                  )
                : null,
              profile
            )
          : []
      }
    />
  );
  return { view, cacheable: !transientFailure && !generationFailed && !storyProgressFailed };
}

function storyPracticeEntries(
  discipline: StoryDiscipline,
  summaries: AiMlPracticeSummary[],
  architecture: ReturnType<typeof architectureDesignPracticeEntry> | null,
  profile: CandidateProfile
): StoryPracticeEntry[] {
  const definition = storyDiscipline(discipline);
  const summaryByTrack = new Map(summaries.map((summary) => [summary.track, summary]));
  // AI/ML has no DSA session, so its tracks lead; others follow DSA.
  const firstOrder = discipline === "ai-ml" ? 1 : 2;
  const entries: StoryPracticeEntry[] = (["core-technical", "applied-engineering"] as const).map(
    (track, index) => {
      const summary = summaryByTrack.get(track);
      const copy = definition.tracks[track];
      const completed = summary?.completedQuestions ?? 0;
      const total = storyTrackQuestionTotal(profile, discipline, track, summary?.totalQuestions);
      return {
        key: `${discipline}-${track}`,
        order: firstOrder + index,
        title: copy.title,
        purpose: copy.purpose,
        covers: copy.covers,
        difficulty: "guided",
        durationMinutes: copy.durationMinutes,
        availability: "available",
        status: progressStatus(completed, total),
        totalQuestions: total,
        attemptedQuestions: completed,
        completedQuestions: completed,
        progressPercent: total ? Math.round((completed / total) * 100) : 0,
        href: storyTrackHref(discipline, track)
      };
    }
  );
  if (!architecture) return entries;
  return [
    ...entries,
    {
      key: `${discipline}-architecture-design`,
      order: firstOrder + 2,
      title: `Architecture & Design · ${definition.label}`,
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
