import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketingHome } from "@/components/marketing/home/marketing-home";
import { Dashboard } from "@/components/workspace/dashboard/dashboard";
import { DashboardSkeleton } from "@/components/workspace/dashboard/dashboard-skeleton";
import { MayaWelcomeLoading } from "@/components/workspace/dashboard/maya-welcome-loading";
import { buildDashboardOverview } from "@/lib/dashboard/dashboard-overview";
import type { ProgressInterview } from "@/lib/roadmap/progress";
import { appUrl, defaultDescription, defaultTitle, siteName } from "@/lib/shared/seo";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const metadata: Metadata = {
  title: { absolute: defaultTitle },
  description: defaultDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: "/"
  },
  twitter: {
    title: defaultTitle,
    description: defaultDescription
  }
};

/**
 * `/` is the public marketing page for signed-out visitors and the Overview
 * screen for onboarded users. Resolve that distinction on the server so the
 * wrong surface never flashes during authentication.
 */
export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ welcome?: string | string[] }>;
}) {
  if (!clerkEnabled) {
    return (
      <>
        <SoftwareJsonLd />
        <MarketingHome />
      </>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return (
      <>
        <SoftwareJsonLd />
        <MarketingHome />
      </>
    );
  }

  let profile;

  try {
    profile = await getAppContainer().profileService.get(authenticatedOwnerId(userId));
  } catch {
    redirect("/onboarding");
  }

  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  const query = await searchParams;
  const showMayaWelcome = query.welcome === "maya";

  if (!showMayaWelcome) {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardOverviewHome userId={userId} profile={profile} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<MayaWelcomeLoading />}>
      <MayaWelcomeHome userId={userId} profile={profile} />
    </Suspense>
  );
}

const EMPTY_PROGRESS_INTERVIEW: ProgressInterview = {
  readinessScore: null,
  completedSessions: 0,
  sessionsThisWeek: 0,
  answeredQuestions: 0,
  competencies: [],
  strongest: null,
  focus: null
};

async function DashboardOverviewHome({
  userId,
  profile
}: {
  userId: string;
  profile: CandidateProfile;
}) {
  const ownerId = authenticatedOwnerId(userId);
  const container = getAppContainer();
  const [reports, practice] = await Promise.all([
    container.interviewService.reportsOverview(ownerId).catch(() => null),
    container.progressService.overview(ownerId, EMPTY_PROGRESS_INTERVIEW).catch(() => null)
  ]);

  return (
    <Dashboard
      profile={profile}
      overviewData={buildDashboardOverview(profile, reports, practice)}
    />
  );
}

async function MayaWelcomeHome({
  userId,
  profile
}: {
  userId: string;
  profile: CandidateProfile;
}) {
  const ownerId = authenticatedOwnerId(userId);
  const [frontendRoadmap, frontendPlan] =
    profile.targetRole === "fullstack"
      ? await Promise.all([
          getAppContainer()
            .frontendRoadmapService.home(ownerId)
            .catch(() => null),
          getAppContainer()
            .dsaService.frontendPlan()
            .catch(() => null)
        ])
      : [null, null];

  return (
    <Dashboard
      profile={profile}
      showMayaWelcome
      frontendRoadmap={frontendRoadmap}
      frontendPlan={frontendPlan}
    />
  );
}

function SoftwareJsonLd() {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: siteName,
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          url: appUrl,
          description: defaultDescription,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD"
          }
        })
      }}
    />
  );
}
