import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { ManageSkeleton } from "@/components/workspace/account/manage-skeleton";
import { DashboardSkeleton } from "@/components/workspace/dashboard/dashboard-skeleton";
import { MayaWelcomeLoading } from "@/components/workspace/dashboard/maya-welcome-loading";
import { HelpHubSkeleton } from "@/components/workspace/help/help-hub-skeleton";
import { InterviewsSkeleton } from "@/components/workspace/interviews/interviews-skeleton";
import {
  DsaPracticeSkeleton,
  PracticeSkeleton
} from "@/components/workspace/practice/practice-skeleton";
import { ProfileSkeleton } from "@/components/workspace/profile/profile-skeleton";
import { RouteProgress, Waveform } from "@/components/workspace/shared/loading/primitives";
import { isWorkspaceChromeRoute } from "@/lib/workspace/workspace-routes";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** Root fallback shared by the public home and signed-in workspace routes. */
export default async function RootLoading() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-trailgrad-pathname") ?? "";
  const search = requestHeaders.get("x-trailgrad-search") ?? "";
  const interviewRoute = pathname === "/interview" || pathname.startsWith("/interview/");
  const progressRoute = pathname === "/progress";
  const manageRoute = pathname === "/manage";
  const profileRoute = pathname === "/profile";
  const workspaceRoute = isWorkspaceChromeRoute(pathname) && pathname !== "/";
  const welcomeHome = pathname === "/" && new URLSearchParams(search).get("welcome") === "maya";
  const workspaceHome =
    pathname === "/" && !welcomeHome && clerkEnabled && Boolean((await auth()).userId);

  if (welcomeHome) return <MayaWelcomeLoading />;

  if (workspaceHome) return <DashboardSkeleton />;

  if (interviewRoute || progressRoute) return null;

  if (pathname === "/interviews") return <InterviewsSkeleton />;

  if (pathname === "/practice") {
    return <PracticeSkeleton />;
  }

  if (pathname.startsWith("/practice/")) return <DsaPracticeSkeleton />;

  if (pathname === "/help") return <HelpHubSkeleton />;

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

  if (workspaceRoute) {
    return (
      <div className="blueprint relative min-h-[100svh]" aria-busy="true" aria-label="Loading">
        <RouteProgress />
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
