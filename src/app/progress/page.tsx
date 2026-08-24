import {
  ProgressView,
  type ProgressStarterQuestion
} from "@/components/workspace/progress/progress-view";
import type { ProgressInterview } from "@/lib/roadmap/progress";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Progress",
  "How far you are through your preparation path, measured from what you have actually practised."
);

const EMPTY_INTERVIEW: ProgressInterview = {
  readinessScore: null,
  completedSessions: 0,
  sessionsThisWeek: 0,
  answeredQuestions: 0,
  competencies: [],
  strongest: null,
  focus: null
};

/** Practice progress and interview evidence, on one page. */
export default async function ProgressPage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const container = getAppContainer();

  const [insights, plan] = await Promise.all([
    container.interviewService.insights(ownerId).catch(() => null),
    container.dsaService.frontendPlan().catch(() => null)
  ]);

  const interview: ProgressInterview = insights
    ? {
        readinessScore: insights.readinessScore,
        completedSessions: insights.completedSessions,
        sessionsThisWeek: insights.sessionsThisWeek,
        answeredQuestions: insights.answeredQuestions,
        competencies: insights.competencyMap,
        strongest: insights.strongest,
        focus: insights.recommendedFocus
      }
    : EMPTY_INTERVIEW;

  const overview = await container.progressService.overview(ownerId, interview);
  const starterQuestions: ProgressStarterQuestion[] =
    plan?.chapters
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
      .slice(0, 3) ?? [];

  return (
    <ProgressView
      overview={overview}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
      starterQuestions={starterQuestions}
    />
  );
}
