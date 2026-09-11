import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CoreTechnicalAssessment } from "@/features/practice/core-technical/ui/core-technical-assessment";
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
  const terminalCount = block.questions.filter(
    ({ status }) => status === "COMPLETED" || status === "LEARNED"
  ).length;

  return (
    <main className="mx-auto min-h-[calc(100svh-4.25rem)] w-full max-w-[76rem] px-4 pb-20 pt-6 sm:px-7 lg:px-8">
      <Link
        href={`/practice/core-technical?block=${encodeURIComponent(block.id)}`}
        className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/52 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to practice path
      </Link>
      <section aria-labelledby="assessment-room-title">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--workspace-accent)]">
          Dedicated assessment room
        </p>
        <h1
          id="assessment-room-title"
          className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.035em] text-cream sm:text-[2.6rem]"
        >
          Your technical conversation
        </h1>
        <p className="mb-7 mt-3 max-w-[42rem] text-[14px] leading-6 text-cream/52">
          Answer from the evidence you worked with. Your teacher will assess the mechanism,
          reasoning, repair, and production judgement behind each response.
        </p>
        <CoreTechnicalAssessment block={block} terminalCount={terminalCount} dedicatedRoom />
      </section>
    </main>
  );
}
