import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { CoreTechnicalBlockAssessmentClient } from "@/features/practice/core-technical/ui/core-technical-block-assessment-client";

export default async function CoreTechnicalAssessmentPage({
  searchParams
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { profile } = await requireOnboardedProfile();
  const query = await searchParams;
  const sessionId = typeof query.session === "string" ? query.session.trim() : "";
  if (!sessionId) redirect("/practice/core-technical");

  return (
    <Suspense fallback={<AssessmentLoading />}>
      <CoreTechnicalBlockAssessmentClient sessionId={sessionId} workspaceAccent={profile.workspaceAccent} />
    </Suspense>
  );
}

function AssessmentLoading() {
  return (
    <main className="fixed inset-0 z-[100] grid place-items-center bg-black text-cream/56">
      Preparing your checkpoint…
    </main>
  );
}

