import { ResumeRoastWorkspace } from "@/features/resume-roast/ui/resume-roast-workspace";
import { loadResumeRoastPageData } from "@/features/resume-roast/server/resume-roast-page-data";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getUserIdForRequest } from "@/server/auth/request-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = privatePageMetadata(
  "Resume Roast",
  "Get a funny, evidence-grounded review of your saved resume from James."
);

export default async function ResumeRoastPage() {
  const userId = await getUserIdForRequest();
  if (!userId) redirect("/");
  const page = await loadResumeRoastPageData(authenticatedOwnerId(userId));
  if (!page.onboardingCompletedAt) redirect("/onboarding");
  if (!page.preparationCompletedAt) redirect("/");
  return <ResumeRoastWorkspace resume={page.resume} initialState={page.state} />;
}
