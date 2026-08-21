import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import {
  DashboardSkeleton,
  MayaWelcomeLoading,
  ManageSkeleton,
  RouteProgress,
  Waveform
} from "@/components/workspace/shared/loading/skeletons";
import { InterviewsSkeleton } from "@/components/workspace/interviews/interviews-skeleton";
import { ProfileSkeleton } from "@/components/workspace/profile/profile-skeleton";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Root fallback. `/` is both marketing and dashboard, so route alone is not
 * enough: signed-out users should never see dashboard cards while the marketing
 * home resolves.
 */
export default async function RootLoading() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-trailgrad-pathname") ?? "";
  const search = requestHeaders.get("x-trailgrad-search") ?? "";
  const interviewRoute = pathname === "/interview" || pathname.startsWith("/interview/");
  const progressRoute = pathname === "/progress";
  const manageRoute = pathname === "/manage";
  const profileRoute = pathname === "/profile";
  const workspaceRoute = isWorkspaceLoadingRoute(pathname);
  const welcomeHome = pathname === "/" && new URLSearchParams(search).get("welcome") === "maya";
  const dashboardHome = pathname === "/" && (await shouldShowDashboardSkeleton());

  if (interviewRoute || progressRoute) return null;

  if (pathname === "/interviews") return <InterviewsSkeleton />;

  if (manageRoute) {
    return (
      <div className="blueprint relative min-h-[100svh]" aria-busy="true" aria-label="Loading">
        <div className="relative z-10">
          <ManageSkeleton />
        </div>
      </div>
    );
  }

  if (profileRoute) {
    return (
      <div className="blueprint relative min-h-[100svh]" aria-busy="true" aria-label="Loading">
        <div className="blueprint-glow" />
        <div className="relative z-10">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (workspaceRoute || dashboardHome) {
    if (welcomeHome) return <MayaWelcomeLoading />;

    return (
      <div className="blueprint relative min-h-[100svh]" aria-busy="true" aria-label="Loading">
        <div className="blueprint-glow" />
        <div className="relative z-10">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div
      className="blueprint relative grid min-h-[100svh] place-items-center"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="blueprint-glow" />
      <RouteProgress />
      <Waveform className="relative z-10" />
    </div>
  );
}

function isWorkspaceLoadingRoute(pathname: string): boolean {
  return (
    pathname === "/practice" ||
    pathname.startsWith("/practice/") ||
    pathname === "/interviews" ||
    pathname === "/profile" ||
    pathname.startsWith("/sessions/") ||
    pathname.startsWith("/session/")
  );
}

async function shouldShowDashboardSkeleton() {
  if (!clerkPublishableKey) return false;

  const { userId } = await auth();
  if (!userId) return false;

  const profile = await getAppContainer()
    .profileService.get(authenticatedOwnerId(userId))
    .catch(() => null);

  return Boolean(profile?.onboardingCompletedAt);
}
