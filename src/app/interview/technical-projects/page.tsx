import { TechnicalProjectsInterviewEntry } from "@/features/interviews/ui/technical-projects/technical-projects-interview-entry";
import { selectGroundedProjectSource } from "@/features/interviews/server/technical-projects-round";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Core Technical & Projects interview",
  "A Claire-led technical calibration and deep project interview grounded in your experience."
);

export default async function TechnicalProjectsInterviewEntryPage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const app = getAppContainer();
  const [quota, plan] = await Promise.all([
    app.interviewService.quota(ownerId).catch(() => null),
    app.personalizedInterviewPlanningService.activePlan(ownerId).catch(() => null)
  ]);
  const coreBlueprint = plan?.sessions.find((session) => session.kind === "core-technical");
  const appliedBlueprint = plan?.sessions.find((session) => session.kind === "applied-engineering");
  const hasBlueprints = Boolean(coreBlueprint && appliedBlueprint);
  const projectName =
    coreBlueprint && appliedBlueprint
      ? selectGroundedProjectSource({ profile, coreBlueprint, appliedBlueprint }).name
      : null;

  return (
    <TechnicalProjectsInterviewEntry
      readyContent={hasBlueprints}
      sessionsRemaining={quota ? Math.max(0, quota.limit - quota.used) : null}
      firstName={profile.resume?.fullName?.trim().split(/\s+/)[0] ?? ""}
      projectName={projectName}
      workspaceAccent={profile.workspaceAccent}
    />
  );
}
