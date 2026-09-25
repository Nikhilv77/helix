import { redirect } from "next/navigation";
import { ArchitectureDesignQuestionWorkspace } from "@/features/practice/architecture-design/ui/architecture-design-question-workspace";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedOwner } from "@/server/auth/onboarding-guard";

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
  const [{ ownerId }, { questionId }, query] = await Promise.all([
    requireOnboardedOwner(),
    params,
    searchParams
  ]);
  const requestedBlockId = typeof query.block === "string" ? query.block : null;
  const workspace = await getAppContainer().architectureDesign.practice.questionWorkspace(
    ownerId,
    questionId,
    requestedBlockId
  );
  if (!workspace) redirect("/practice/architecture-design");
  const { block, question } = workspace;
  const stageTitle =
    block.story.stages.find(({ order }) => order === question.order)?.title ??
    `Question ${question.order}`;

  return (
    <main className="practice-question-page w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden">
      <ArchitectureDesignQuestionWorkspace
        key={questionId}
        block={block}
        initialQuestion={question}
        stageTitle={stageTitle}
      />
    </main>
  );
}
