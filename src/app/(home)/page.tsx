import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketingHome } from "@/features/marketing/ui/home/marketing-home";
import { DashboardOverview } from "@/features/dashboard/ui/overview/dashboard-overview";
import { DashboardSkeleton } from "@/features/dashboard/ui/overview/dashboard-skeleton";
import { PreparationWelcomeLoading } from "@/features/preparation-onboarding/ui/preparation-welcome-loading";
import { PreparationWelcomeScreen } from "@/features/preparation-onboarding/ui/preparation-welcome-screen";
import { welcomePersonaFromQuery } from "@/lib/avatars/personas";
import { loadDashboardOverview } from "@/features/dashboard/server/load-dashboard-overview";
import { appUrl, defaultDescription, defaultTitle, siteName } from "@/lib/shared/seo";
import type { CandidateProfile } from "@/lib/shared/types";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getProfileForRequest } from "@/features/profile/server/profile-query";
import { resolveHomeSurface } from "./home-route-state";

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

  const onboardingSurface = resolveHomeSurface({
    clerkEnabled,
    userId,
    profile,
    welcomeRequested: false
  });
  if (onboardingSurface === "onboarding") redirect("/onboarding");

  const query = await searchParams;
  const welcomePersona = welcomePersonaFromQuery(
    typeof query.welcome === "string" ? query.welcome : null
  );
  const preparationRequired = profile.preparationOnboarding.completedAt === null;
  const surface = resolveHomeSurface({
    clerkEnabled,
    userId,
    profile,
    welcomeRequested: welcomePersona !== null
  });

  if (surface === "overview") {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardOverviewHome userId={userId} profile={profile} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PreparationWelcomeLoading />}>
      <PreparationWelcomeScreen profile={profile} blocking={preparationRequired} />
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
  const now = Date.now();
  const overviewData = await loadDashboardOverview({ ownerId, profile, now });

  return <DashboardOverview overviewData={overviewData} />;
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
