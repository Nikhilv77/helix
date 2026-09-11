import { notFound, redirect } from "next/navigation";
import { interviewRoomHref } from "@/features/interviews/ui/shared/interview-room-navigation";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Core Technical Assessment",
  "Your dedicated Core Technical practice-path assessment room."
);

export default async function CoreTechnicalAssessmentRoomPage({
  params,
  searchParams
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  const { ownerId } = await requireOnboardedProfile();
  const [{ assessmentId }, query] = await Promise.all([params, searchParams]);
  const blockId = typeof query.block === "string" ? query.block : null;
  const app = getAppContainer();

  let block;
  try {
    block = blockId
      ? await app.coreTechnicalHistoryService.read(ownerId, blockId)
      : await app.coreTechnicalPracticeService.current(ownerId);
  } catch (error) {
    if (
      error instanceof NotFoundErrorException &&
      error.code === "CORE_TECHNICAL_BLOCK_NOT_FOUND"
    ) {
      notFound();
    }
    throw error;
  }

  if (!block?.assessment || block.assessment.id !== assessmentId) notFound();
  if (block.assessment.status === "IN_PROGRESS") {
    const started = await app.coreTechnicalAssessmentRuntimeService.startOrResume(ownerId, {
      assessmentId,
      requestId: assessmentId
    });
    redirect(interviewRoomHref(started.sessionId));
  }

  redirect(`/practice/core-technical?block=${encodeURIComponent(block.id)}`);
}
