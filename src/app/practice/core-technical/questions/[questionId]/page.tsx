import { notFound } from "next/navigation";
import { CoreTechnicalQuestionWorkspace } from "@/features/practice/core-technical/ui/core-technical-question-workspace";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Core Technical Question",
  "A question in your frozen Core Technical practice path."
);

export default async function CoreTechnicalQuestionPage({
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
      ? await app.coreTechnicalHistoryService.read(ownerId, requestedBlockId)
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
  const question = block?.questions.find(({ id }) => id === questionId);
  if (!block || !question) notFound();
  const stageTitle =
    block.story.stages.find(({ order }) => order === question.order)?.title ??
    `Question ${question.order}`;

  return (
    <main className="w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden">
      <CoreTechnicalQuestionWorkspace
        block={block}
        initialQuestion={question}
        stageTitle={stageTitle}
      />
    </main>
  );
}
