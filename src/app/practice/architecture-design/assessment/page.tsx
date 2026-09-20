import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ArchitectureDesignBlockAssessmentClient } from "@/features/practice/architecture-design/ui/architecture-design-block-assessment-client";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export default async function ArchitectureDesignAssessmentPage({
  searchParams
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { profile } = await requireOnboardedProfile();
  const query = await searchParams;
  const sessionId = typeof query.session === "string" ? query.session.trim() : "";
  if (!sessionId) redirect("/practice/architecture-design");

  return (
    <Suspense fallback={<AssessmentLoading />}>
      <ArchitectureDesignBlockAssessmentClient
        sessionId={sessionId}
        workspaceAccent={profile.workspaceAccent}
      />
    </Suspense>
  );
}

function AssessmentLoading() {
  return (
    <main className="fixed inset-0 z-[100] grid place-items-center bg-black text-cream/56">
      Preparing your Architecture &amp; Design checkpoint…
    </main>
  );
}
