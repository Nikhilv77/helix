import { displayFirstName } from "@/lib/shared/names";
import type { DashboardOverviewData } from "@/features/dashboard/contracts/dashboard-overview";
import { buildDashboardOverview } from "@/features/dashboard/application/build-dashboard-overview";
import type { ProgressBriefingOverview } from "@/features/progress/contracts/progress";
import type { ProgressStarterQuestion } from "@/features/progress/ui/progress-view";
import type { ReportsOverview } from "@/features/reports/contracts/reports";
import { disciplineLabel } from "@/lib/shared/labels";
import {
  mergeBriefingPractice,
  mergeDashboardPractice
} from "@/features/practice/core-technical/domain/workspace-analytics";
import { aiMlStarterPractice } from "@/features/practice/ai-ml/domain/resume-practice-path";
import {
  storyDiscipline as storyDisciplineDefinition,
  storyDisciplineForRole,
  usesNodePracticeTracks
} from "@/features/practice/story-tracks/domain/story-disciplines";
import { getAppContainer } from "@/server/app-container";
import { nodeTrackAssessmentReports } from "@/features/reports/server/assessment-reports";
import type { CandidateProfile } from "@/lib/shared/types";
import { Logger } from "@/server/common/logger";

export interface CandidateAnalyticsSummary {
  dashboard: DashboardOverviewData;
  progressBriefing: ProgressBriefingOverview;
  progressPage: { firstName: string; starterQuestions: ProgressStarterQuestion[] };
  reportsPage: {
    candidate: { name: string; discipline: string };
    quotaLimit: number;
    quotaStartedAt: number[];
  };
  roast: { readyCount: number; latestReadyAt: number | null };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const logger = new Logger("CandidateAnalyticsLoader");

export async function buildCandidateAnalytics(
  ownerId: string,
  profileInput?: CandidateProfile,
  at = Date.now()
): Promise<{
  summary: CandidateAnalyticsSummary;
  reports: ReportsOverview | null;
  cacheable: boolean;
}> {
  const app = getAppContainer();
  const now = at;
  let cacheable = true;
  const source = async <T>(name: string, load: () => Promise<T>): Promise<T> => {
    const startedAt = Date.now();
    try {
      return await load();
    } finally {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 1_000) {
        logger.warn({
          event: "candidate.analytics_source_slow",
          ownerId,
          source: name,
          durationMs
        });
      }
    }
  };
  const recover = <T>(name: string, promise: Promise<T>, fallback: T): Promise<T> =>
    promise.catch((error) => {
      cacheable = false;
      logger.error({
        event: "candidate.analytics_source_failed",
        ownerId,
        source: name,
        reason: error instanceof Error ? error.message : String(error)
      });
      return fallback;
    });

  const assessmentReports = recover(
    "assessmentReports",
    source("assessmentReports", () => nodeTrackAssessmentReports(ownerId, now)),
    []
  );
  // A stale snapshot is rebuilt only occasionally, but each service can issue
  // several SQL reads. Keep the rebuild in small waves so it cannot occupy the
  // entire Prisma pool while notification and help polling are active.
  const [profile, reports, roadmapPractice] = await Promise.all([
    profileInput
      ? Promise.resolve(profileInput)
      : source("profile", () => app.profileService.get(ownerId)),
    recover(
      "interviewReports",
      source("interviewReports", () =>
        app.interviewService.reportsOverview(ownerId, 50, now, assessmentReports)
      ),
      null
    ),
    // One read serves both the dashboard and the Progress briefing.
    recover(
      "roadmapPractice",
      source("roadmapPractice", () => app.progressService.summary(ownerId, new Date(now))),
      null
    )
  ]);
  const briefing = roadmapPractice?.briefing ?? null;
  const storyDiscipline = storyDisciplineForRole(profile.targetRole);
  // The same tracks the Practice page offers this role: Node.js Core Technical
  // and Applied Engineering for backend and full-stack (alongside their Backend
  // Fundamentals story track), Architecture for those plus story disciplines
  // that include it.
  const nodeTracks = usesNodePracticeTracks(profile.targetRole);
  const architectureTrack =
    nodeTracks ||
    (storyDiscipline !== null && storyDisciplineDefinition(storyDiscipline).architecture !== null);
  const [corePractice, appliedPractice, architecturePractice, storyPractice, insights] =
    await Promise.all([
      recover(
        "corePractice",
        source("corePractice", () =>
          app.coreTechnicalWorkspaceAnalyticsService.practice(ownerId, 126)
        ),
        null
      ),
      nodeTracks
        ? recover(
            "appliedPractice",
            source("appliedPractice", () =>
              app.appliedEngineeringWorkspaceAnalyticsService.practice(ownerId, 126, new Date(now))
            ),
            null
          )
        : Promise.resolve(null),
      architectureTrack
        ? recover(
            "architecturePractice",
            source("architecturePractice", () =>
              app.architectureDesign.workspaceAnalytics.practice(ownerId, 126, new Date(now))
            ),
            null
          )
        : Promise.resolve(null),
      storyDiscipline
        ? recover(
            "storyPractice",
            source("storyPractice", () =>
              app.aiMlPracticeService.dashboardPractice(
                ownerId,
                profile,
                126,
                new Date(now),
                storyDiscipline
              )
            ),
            null
          )
        : Promise.resolve(null),
      recover(
        "interviewInsights",
        source("interviewInsights", () => app.interviewService.insights(ownerId)),
        null
      )
    ]);
  const [trailmate, readyCount, latest, quotaStarts, starterPlan] = await Promise.all([
    recover(
      "trailmate",
      source("trailmate", () => app.helpHistoryService.dashboardOverview(ownerId)),
      null
    ),
    recover(
      "roastCount",
      source("roastCount", () => app.resumeRoastStore.countReady(ownerId)),
      0
    ),
    recover(
      "latestRoast",
      source("latestRoast", () => app.resumeRoastStore.latestReadyAt(ownerId)),
      null
    ),
    recover(
      "interviewQuota",
      source("interviewQuota", () =>
        app.candidateAnalyticsSnapshotStore.recentInterviewStartTimes(ownerId, now - DAY_MS)
      ),
      []
    ),
    briefing?.totals.completedQuestions || profile.targetRole === "ai-ml"
      ? Promise.resolve(null)
      : recover(
          "starterPlan",
          source("starterPlan", () => app.dsaService.frontendPlan()),
          null
        )
  ]);

  // A failed briefing read is rendered as an empty state for this request, but
  // never saved as a durable analytics result.
  const roadmapBriefing: ProgressBriefingOverview = briefing ?? {
    totals: { totalAttempts: 0, completedQuestions: 0 },
    streak: {
      currentDays: 0,
      longestDays: 0,
      activeDays: 0,
      lastActiveAt: null,
      lastSolvedAt: null
    },
    activity: [],
    interview: { completedSessions: 0 }
  };
  // Overview and Progress count the same practice: DSA plus every other track.
  // Progress used to add only story tracks, so Core Technical, Applied
  // Engineering, and Architecture work never reached its totals or streak.
  const trackPractice = [corePractice, appliedPractice, architecturePractice, storyPractice].filter(
    (practice): practice is NonNullable<typeof practice> => practice !== null
  );
  // Merge over the full window, then keep the seven days the pages show.
  const mergedBriefing = trackPractice.reduce(mergeBriefingPractice, roadmapBriefing);
  const progressBriefing: ProgressBriefingOverview = {
    ...mergedBriefing,
    activity: mergedBriefing.activity.slice(-7),
    interview: { completedSessions: insights?.completedSessions ?? 0 }
  };
  const mergedDashboard = trackPractice.reduce<ReturnType<typeof mergeDashboardPractice> | null>(
    mergeDashboardPractice,
    roadmapPractice?.dashboard ?? null
  );
  const dashboardPractice = mergedDashboard
    ? { ...mergedDashboard, activity: mergedDashboard.activity.slice(-7) }
    : null;
  return {
    summary: {
      dashboard: buildDashboardOverview(profile, reports, dashboardPractice, now, trailmate),
      progressBriefing,
      progressPage: {
        firstName: displayFirstName(profile.resume?.fullName),
        starterQuestions:
          profile.targetRole === "ai-ml"
            ? aiMlStarterPractice(profile)
            : (starterPlan?.chapters
                .flatMap((chapter) =>
                  chapter.questions.map((question) => ({
                    title: question.title,
                    difficulty: question.difficulty,
                    minutes: question.expectedTimeMinutes,
                    href: `/dsa-questions/${question.slug}`,
                    chapterTitle: chapter.title
                  }))
                )
                .filter((question) => question.difficulty === "easy")
                .slice(0, 3) ?? [])
      },
      reportsPage: {
        candidate: {
          name: profile.resume?.fullName?.trim() ?? "",
          discipline: profile.targetRole ? disciplineLabel(profile.targetRole) : ""
        },
        quotaLimit: app.config.interviewDailyLimit,
        quotaStartedAt: quotaStarts
      },
      roast: { readyCount, latestReadyAt: latest?.getTime() ?? null }
    },
    reports,
    cacheable
  };
}
