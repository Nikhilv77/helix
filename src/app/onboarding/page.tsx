import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/flow/onboarding-flow";
import { privatePageMetadata } from "@/lib/shared/seo";
import type { CandidateProfile } from "@/lib/shared/types";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Onboarding",
  "Set your role, experience level, and resume evidence before starting Trailgrad interviews."
);

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ replace?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const replacingResume = (await searchParams).replace === "resume";
  let profile: CandidateProfile | null = null;

  try {
    profile = await getAppContainer().profileService.get(authenticatedOwnerId(userId));
    if (profile.onboardingCompletedAt && !replacingResume) redirect("/");
  } catch (error) {
    // A database hiccup should not block onboarding outright; the upload route
    // authorises and persists on its own. Re-throw the redirect Next.js raises.
    if (isRedirectError(error)) throw error;
  }

  return (
    <OnboardingFlow
      replacingResume={replacingResume}
      // Someone swapping their resume already has a teacher; send them straight
      // past the picker rather than making them choose again.
      initialStep={replacingResume ? "resume" : "teacher"}
      initialTeacherId={profile?.teacherId ?? null}
      initialRole={profile?.targetRole ?? undefined}
      initialLevel={profile?.level ?? undefined}
    />
  );
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
