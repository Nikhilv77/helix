import { notFound } from "next/navigation";
import { ArchitectureDesignQuestionWorkspace } from "@/features/practice/architecture-design/ui/architecture-design-question-workspace";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Architecture & Design Question",
  "A question in your frozen Architecture & Design scenario."
);

export default async function ArchitectureDesignQuestionPage({
  params,
  searchParams
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  const { ownerId } = await requireOnboardedProfile();
  const [{ questionId }, query] = await Promise.all([params, searchParams]);
  const requestedBlockId = typeof query.block === "string" ? query.block : null;
  const services = getAppContainer().architectureDesign;
  let block;
  try {
    block = requestedBlockId
      ? await services.history.read(ownerId, requestedBlockId)
      : await services.practice.current(ownerId);
  } catch (error) {
    if (
      error instanceof NotFoundErrorException &&
      error.code === "ARCHITECTURE_DESIGN_BLOCK_NOT_FOUND"
    ) {
      notFound();
    }
    throw error;
  }
  const question = block?.questions.find(({ id }) => id === questionId);
  if (!block || !question) notFound();
  const stageTitle =
    block.scenario.stages.find(({ order }) => order === question.order)?.title ??
    `Question ${question.order}`;

  return (
    <main className="w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden">
      <ArchitectureDesignQuestionWorkspace
        block={block}
        initialQuestion={question}
        stageTitle={stageTitle}
      />
    </main>
  );
}
