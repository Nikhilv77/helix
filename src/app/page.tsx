import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { Dashboard } from "@/components/workspace/dashboard";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Decided on the server. Gating this on the client meant a signed-in user
 * rendered the marketing page until Clerk's hooks resolved.
 */
export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ welcome?: string | string[] }>;
}) {
  const query = await searchParams;
  const showMayaWelcome = query.welcome === "maya";
  if (!clerkEnabled) {
    return <MarketingHome />;
  }

  const { userId } = await auth();
  if (!userId) return <MarketingHome />;

  let dashboardData;
  try {
    const interviewService = getAppContainer().interviewService;
    const ownerId = authenticatedOwnerId(userId);
    const [quota, sessions, profile, insights] = await Promise.all([
      interviewService.quota(ownerId),
      interviewService.history(ownerId),
      getAppContainer().profileService.get(ownerId),
      interviewService.insights(ownerId)
    ]);
    dashboardData = { quota, sessions, profile, insights };
  } catch {
    return (
      <Dashboard
        quota={{ used: 0, limit: 2 }}
        sessions={[]}
        profile={{
          targetRole: null,
          level: null,
          targetCompany: "",
          targetDate: null,
          headline: "",
          context: "",
          focusAreas: [],
          stories: [],
          onboardingCompletedAt: null,
          resume: null,
          updatedAt: null,
          completeness: 0
        }}
        insights={{
          readinessScore: null,
          completedSessions: 0,
          sessionsThisWeek: 0,
          answeredQuestions: 0,
          competencyMap: [],
          strongest: null,
          recommendedFocus: null
        }}
        historyAvailable={false}
      />
    );
  }

  if (!dashboardData.profile.onboardingCompletedAt) redirect("/onboarding");

  return <Dashboard {...dashboardData} showMayaWelcome={showMayaWelcome} />;
}
