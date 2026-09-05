import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketingHome } from "@/components/marketing/home/marketing-home";
import { Dashboard } from "@/components/workspace/dashboard/dashboard";
import { DashboardSkeleton } from "@/components/workspace/dashboard/dashboard-skeleton";
import { MayaWelcomeLoading } from "@/components/workspace/dashboard/maya-welcome-loading";
import { welcomePersonaFromQuery } from "@/lib/avatars/personas";
import { buildDashboardOverview } from "@/lib/dashboard/dashboard-overview";
import { appUrl, defaultDescription, defaultTitle, siteName } from "@/lib/shared/seo";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getProfileForRequest } from "@/server/profile/profile-query";

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
    profile = await getProfileForRequest(authenticatedOwnerId(userId));
  } catch {
    redirect("/onboarding");
  }

  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  const query = await searchParams;
  const welcomePersona = welcomePersonaFromQuery(
    typeof query.welcome === "string" ? query.welcome : null
  );
  const preparationRequired = profile.preparationOnboarding.completedAt === null;
  const showMayaWelcome = preparationRequired || welcomePersona !== null;

  if (!showMayaWelcome) {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardOverviewHome userId={userId} profile={profile} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<MayaWelcomeLoading />}>
      <MayaWelcomeHome profile={profile} blocking={preparationRequired} />
    </Suspense>
  );
}

async function DashboardOverviewHome({
  userId,
  profile
}: {
  userId: string;
  profile: CandidateProfile;
}) {
  const ownerId = authenticatedOwnerId(userId);
  const container = getAppContainer();
  const [reports, practice, trailmate] = await Promise.all([
    container.interviewService.reportsOverview(ownerId).catch(() => null),
    container.progressService.dashboard(ownerId).catch(() => null),
    container.helpHistoryService.dashboardOverview(ownerId).catch(() => null)
  ]);

  return (
    <Dashboard
      profile={profile}
      overviewData={buildDashboardOverview(profile, reports, practice, Date.now(), trailmate)}
    />
  );
}

function MayaWelcomeHome({ profile, blocking }: { profile: CandidateProfile; blocking: boolean }) {
  return (
    <Dashboard
      profile={profile}
      showMayaWelcome
      welcomeBlocking={blocking}
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
