import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { Dashboard } from "@/components/workspace/dashboard";
import { WorkspaceLoading } from "@/components/workspace/skeletons";
import { appUrl, defaultDescription, defaultTitle, siteName } from "@/lib/seo";
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
 * Decided on the server. Gating this on the client meant a signed-in user
 * rendered the marketing page until Clerk's hooks resolved.
 */
/**
 * `/` serves two entirely different pages, so the work is split across two
 * boundaries.
 *
 * The outer component does nothing but resolve auth, which is quick, and its
 * fallback (app/loading.tsx) is deliberately brand-neutral — it renders before
 * `auth()` settles, so it cannot know whether marketing or the workspace is
 * coming. Marketing then returns immediately; the workspace's slower profile
 * and roadmap reads suspend behind their own boundary, inside the shell —
 * so the sidebar stays put and only the content area shows the loader.
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

  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <WorkspaceHome userId={userId} searchParams={searchParams} />
    </Suspense>
  );
}

/** The signed-in half: everything that needs a database read. */
async function WorkspaceHome({
  userId,
  searchParams
}: {
  userId: string;
  searchParams: Promise<{ welcome?: string | string[] }>;
}) {
  const query = await searchParams;
  const showMayaWelcome = query.welcome === "maya";

  let dashboardData;
  try {
    const ownerId = authenticatedOwnerId(userId);
    // Home renders the preparation plan only, so it loads the profile it is
    // keyed on and the plan itself — nothing else. Quota, history, insights and
    // the generated curriculum still power Practice, Progress and Reports.
    const profile = await getAppContainer().profileService.get(ownerId);
    const [frontendRoadmap, frontendPlan] =
      profile.targetRole === "frontend"
        ? await Promise.all([
            getAppContainer()
              .frontendRoadmapService.home(ownerId)
              .catch(() => null),
            getAppContainer()
              .dsaService.frontendPlan()
              .catch(() => null)
          ])
        : [null, null];
    dashboardData = { profile, frontendRoadmap, frontendPlan };
  } catch {
    redirect("/onboarding");
  }

  if (!dashboardData.profile.onboardingCompletedAt) redirect("/onboarding");

  return <Dashboard {...dashboardData} showMayaWelcome={showMayaWelcome} />;
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
