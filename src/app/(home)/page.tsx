import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketingHome } from "@/features/marketing/ui/home/marketing-home";
import { DashboardOverview } from "@/features/dashboard/ui/overview/dashboard-overview";
import { PreparationWelcomeLoading } from "@/features/preparation-onboarding/ui/preparation-welcome-loading";
import { PreparationWelcomeScreen } from "@/features/preparation-onboarding/ui/preparation-welcome-screen";
import { welcomePersonaFromQuery } from "@/lib/avatars/personas";
import { loadDashboardOverview } from "@/features/dashboard/server/load-dashboard-overview";
import { appUrl, defaultDescription, defaultTitle, siteName } from "@/lib/shared/seo";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import {
  getProfileForRequest,
  getWorkspaceShellStateForRequest
} from "@/features/profile/server/profile-query";
import { resolveHomeSurface } from "./home-route-state";
import { getUserIdForRequest } from "@/server/auth/request-user";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Keep a recently visited Overview in the client router cache. This does not
// cache the authenticated response on the server or in a shared HTTP cache.
export const unstable_dynamicStaleTime = 30;
export const maxDuration = 60;

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

  const userId = await getUserIdForRequest();
  if (!userId) {
    return (
      <>
        <SoftwareJsonLd />
        <MarketingHome />
      </>
    );
  }

  const ownerId = authenticatedOwnerId(userId);
  const shellProfile = await getWorkspaceShellStateForRequest(ownerId);

  const routeProfile = shellProfile
    ? {
        onboardingCompletedAt: shellProfile.onboardingCompletedAt,
        preparationOnboarding: { completedAt: shellProfile.preparationCompletedAt }
      }
    : null;

  const onboardingSurface = resolveHomeSurface({
    clerkEnabled,
    userId,
    profile: routeProfile,
    welcomeRequested: false
  });
  if (onboardingSurface === "onboarding") redirect("/onboarding");

  const query = await searchParams;
  const welcomePersona = welcomePersonaFromQuery(
    typeof query.welcome === "string" ? query.welcome : null
  );
  const preparationRequired = shellProfile?.preparationCompletedAt === null;
  const surface = resolveHomeSurface({
    clerkEnabled,
    userId,
    profile: routeProfile,
    welcomeRequested: welcomePersona !== null
  });

  if (surface === "overview") {
    // The root boundary already covers this request. A nested fallback swaps
    // its neutral loader for a second, different skeleton before the page lands.
    const overviewData = await loadDashboardOverview({ ownerId, now: Date.now() });
    return <DashboardOverview overviewData={overviewData} />;
  }

  const profile = await getProfileForRequest(ownerId);
  return (
    <Suspense fallback={<PreparationWelcomeLoading />}>
      <PreparationWelcomeScreen profile={profile} blocking={preparationRequired} />
    </Suspense>
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
