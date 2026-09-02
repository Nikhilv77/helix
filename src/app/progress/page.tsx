import {
  ProgressView,
  type ProgressStarterQuestion
} from "@/components/workspace/progress/progress-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Progress",
  "How far you are through your preparation path, measured from what you have actually practised."
);

/** Practice progress and interview evidence, on one page. */
export default async function ProgressPage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const container = getAppContainer();

  const insights = await container.interviewService.insights(ownerId).catch(() => null);

  const interview = { completedSessions: insights?.completedSessions ?? 0 };

  const overview = await container.progressService.briefing(ownerId, interview);
  const hasPracticeProgress = overview.totals.completedQuestions > 0;
  const plan = hasPracticeProgress
    ? null
    : await container.dsaService.frontendPlan().catch(() => null);
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
