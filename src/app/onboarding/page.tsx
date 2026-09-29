import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/features/onboarding/ui/flow/onboarding-flow";
import { privatePageMetadata } from "@/lib/shared/seo";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getWorkspaceShellStateForRequest } from "@/features/profile/server/profile-query";
import { getUserIdForRequest } from "@/server/auth/request-user";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Onboarding",
  "Set your experience level and add resume evidence before starting Trailgrad interviews."
);

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ replace?: string | string[] }>;
}) {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");

  const replacingResume = (await searchParams).replace === "resume";
  const shellState = await getWorkspaceShellStateForRequest(authenticatedOwnerId(userId));
  if (shellState?.onboardingCompletedAt && !replacingResume) redirect("/");

  return (
    <OnboardingFlow
      replacingResume={replacingResume}
      // Someone swapping their resume already has a teacher; send them straight
      // past the picker rather than making them choose again.
      initialStep={replacingResume ? "resume" : "teacher"}
      initialTeacherId={shellState?.teacherId ?? null}
      initialLevel={shellState?.level ?? undefined}
    />
  );
}
