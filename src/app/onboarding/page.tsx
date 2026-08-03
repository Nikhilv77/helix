import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ replace?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const replacingResume = (await searchParams).replace === "resume";

  try {
    const profile = await getAppContainer().profileService.get(authenticatedOwnerId(userId));
    if (profile.onboardingCompletedAt && !replacingResume) redirect("/");
  } catch (error) {
    // A database hiccup should not block onboarding outright; the upload route
    // authorises and persists on its own. Re-throw the redirect Next.js raises.
    if (isRedirectError(error)) throw error;
  }

  return <OnboardingFlow replacingResume={replacingResume} />;
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
