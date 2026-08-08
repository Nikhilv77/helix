import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Continue",
  "Continue into your Trailgrad interview workspace."
);

export default async function ContinueAfterAuthentication() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let destination = "/";
  try {
    const ownerId = authenticatedOwnerId(userId);
    const profile = await getAppContainer().profileService.get(ownerId);
    destination = profile.onboardingCompletedAt ? "/" : "/onboarding";
  } catch {
    // A database hiccup should land the user somewhere recoverable, not loop auth.
  }

  redirect(destination);
}
