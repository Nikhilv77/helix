import { headers } from "next/headers";
import { ManageSkeleton } from "@/components/workspace/account/manage-skeleton";
import { MayaWelcomeLoading } from "@/components/workspace/dashboard/maya-welcome-loading";
import { InterviewsSkeleton } from "@/components/workspace/interviews/interviews-skeleton";
import { ProfileSkeleton } from "@/components/workspace/profile/profile-skeleton";
import { RouteProgress, Waveform } from "@/components/workspace/shared/loading/primitives";

/** Root fallback shared by the public home and signed-in workspace routes. */
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

  if (welcomeHome) return <MayaWelcomeLoading />;

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
