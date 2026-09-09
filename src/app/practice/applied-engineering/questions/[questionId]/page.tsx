import { notFound } from "next/navigation";
import { AppliedEngineeringQuestionWorkspace } from "@/features/practice/applied-engineering/ui/applied-engineering-question-workspace";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Applied Engineering Question",
  "A question in your frozen Applied Engineering production incident."
);

export default async function AppliedEngineeringQuestionPage({
  params,
  searchParams
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  const { ownerId } = await requireOnboardedProfile();
  const { questionId } = await params;
  const query = await searchParams;
  const requestedBlockId = typeof query.block === "string" ? query.block : null;
  const app = getAppContainer();
  let block;
  try {
    block = requestedBlockId
      ? await app.appliedEngineeringHistoryService.read(ownerId, requestedBlockId)
      : await app.appliedEngineeringPracticeService.current(ownerId);
  } catch (error) {
    if (
      error instanceof NotFoundErrorException &&
      error.code === "APPLIED_ENGINEERING_BLOCK_NOT_FOUND"
    ) {
      notFound();
    }
    throw error;
  }
  const question = block?.questions.find(({ id }) => id === questionId);
  if (!block || !question) notFound();
  const stageTitle =
    block.incident.stages.find(({ order }) => order === question.order)?.title ??
    `Question ${question.order}`;

  return (
    <main className="w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden">
      <AppliedEngineeringQuestionWorkspace
        block={block}
        initialQuestion={question}
        stageTitle={stageTitle}
      />
    </main>
  );
}
