import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireOnboardedOwner } from "@/server/auth/onboarding-guard";
import { DsaBlockAssessmentClient } from "@/features/practice/dsa/ui/dsa-block-assessment-client";

export default async function DsaBlockAssessmentPage({
  searchParams
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { workspaceAccent } = await requireOnboardedOwner();
  const query = await searchParams;
  const sessionId = typeof query.session === "string" ? query.session.trim() : "";
  if (!sessionId) redirect("/practice/dsa");

  return (
    <Suspense fallback={<AssessmentLoading />}>
      <DsaBlockAssessmentClient sessionId={sessionId} workspaceAccent={workspaceAccent} />
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
