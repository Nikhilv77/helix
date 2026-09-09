import { headers } from "next/headers";
import { ManageSkeleton } from "@/features/account/ui/manage-skeleton";
import { PreparationWelcomeLoading } from "@/features/preparation-onboarding/ui/preparation-welcome-loading";
import { HelpHubSkeleton } from "@/features/peer-help/ui/help-hub-skeleton";
import { InterviewsSkeleton } from "@/features/interviews/ui/history/interviews-skeleton";
import {
  DsaPracticeSkeleton,
  PracticeSkeleton
} from "@/features/practice/shared/ui/practice-skeleton";
import { ProfileSkeleton } from "@/features/profile/ui/profile-skeleton";
import { RouteProgress, Waveform } from "@/components/workspace/shared/loading/primitives";
import { isWorkspaceChromeRoute } from "@/lib/workspace/workspace-routes";
import { welcomePersonaFromQuery } from "@/lib/avatars/personas";

/** Root fallback shared by the public home and signed-in workspace routes. */
export default async function RootLoading() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-trailgrad-pathname") ?? "";
  const search = requestHeaders.get("x-trailgrad-search") ?? "";

  // Next's internal navigation request can reach this boundary without the
  // proxy pathname header. Showing the generic loader in that case causes a
  // wrong full-page flash before the route-specific fallback mounts.
  if (!pathname) return null;

  const interviewRoute = pathname === "/interview" || pathname.startsWith("/interview/");
  const progressRoute = pathname === "/progress";
  const manageRoute = pathname === "/manage";
  const profileRoute = pathname === "/profile";
  const workspaceRoute = isWorkspaceChromeRoute(pathname) && pathname !== "/";
  const welcomeHome =
    pathname === "/" &&
    welcomePersonaFromQuery(new URLSearchParams(search).get("welcome")) !== null;
  if (welcomeHome) return <PreparationWelcomeLoading />;

  // `/` resolves to either the public home, onboarding, or the signed-in
  // overview. Its page owns the correct fallback once that surface is known;
  // rendering another root fallback first causes a full-graphite flash.
  if (pathname === "/") return null;

  if (interviewRoute || progressRoute) return null;

  if (pathname === "/interviews") return <InterviewsSkeleton />;

  if (pathname === "/practice") {
    return <PracticeSkeleton />;
  }

  if (pathname.startsWith("/practice/")) return <DsaPracticeSkeleton />;

  if (pathname === "/trailmate") return <HelpHubSkeleton />;

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
