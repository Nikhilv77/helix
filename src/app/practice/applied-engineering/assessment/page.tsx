import { Suspense } from "react";
import { AssessmentRoomLoading } from "@/features/practice/shared/ui/assessment-room-loading";
import { redirect } from "next/navigation";
import { AppliedEngineeringBlockAssessmentClient } from "@/features/practice/applied-engineering/ui/applied-engineering-block-assessment-client";
import { loadAppliedEngineeringRecallQuiz } from "@/features/practice/applied-engineering/server/recall-quiz.loader";
import { getPrismaService } from "@/server/database/prisma.service";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export default async function AppliedEngineeringAssessmentPage({
  searchParams
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { ownerId, profile } = await requireOnboardedProfile();
  const query = await searchParams;
  const sessionId = typeof query.session === "string" ? query.session.trim() : "";
  if (!sessionId) redirect("/practice/applied-engineering");
  // Not awaited: the room renders at once and the recall check streams in.
  const recallQuiz = loadAppliedEngineeringRecallQuiz(
    getPrismaService(),
    ownerId,
    sessionId
  ).catch(() => []);

  return (
    <Suspense fallback={<AssessmentLoading />}>
      <AppliedEngineeringBlockAssessmentClient
        sessionId={sessionId}
        workspaceAccent={profile.workspaceAccent}
        recallQuiz={recallQuiz}
      />
    </Suspense>
  );
}

function AssessmentLoading() {
  return <AssessmentRoomLoading />;
}
