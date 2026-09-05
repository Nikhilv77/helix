import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DsaTopics } from "@/components/workspace/dsa/dsa-topics";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { buildStableDsaRecommendation } from "@/server/dsa/stable-dsa-recommendation";
import { DsaBlockHistoryError } from "@/server/dsa/dsa-block-history.service";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "DSA Practice",
  "The DSA patterns and questions in your Trailgrad preparation path."
);

/** The existing, fully implemented first Practice session. */
export default async function DsaPracticePage({
  searchParams
}: {
  searchParams: Promise<{
    block?: string | string[];
    panel?: string | string[];
  }>;
}) {
  const { ownerId, profile } = await requireOnboardedProfile();
  const container = getAppContainer();
  const query = await searchParams;
  const requestedBlockId = typeof query.block === "string" ? query.block : null;
  const panel = query.panel === "transcript" ? "transcript" : "overview";
  const allowEarlyAssessmentStart = container.config.nodeEnv === "development";

  if (allowEarlyAssessmentStart) {
    await container.dsaPracticeBlockStore.refreshReadiness(ownerId, { allowIncomplete: true });
  }

  // This is deliberately awaited before recommendation/history reads. It
  // repairs a terminal interview whose deferred finalizer failed.
  await container.dsaBlockAssessmentFinalizationService.recoverCurrent(ownerId);
  const [plan, roadmap, questionStatuses, practiceEvidence] = await Promise.all([
    container.dsaService.fullPlan().catch(() => null),
    container.frontendRoadmapService.home(ownerId).catch(() => null),
    container.frontendRoadmapService.questionStatuses(ownerId).catch(() => ({})),
    container.practiceEvidenceStore.refresh(ownerId).catch(() => null)
  ]);
  const recommendation = plan
    ? await buildStableDsaRecommendation({
        ownerId,
        plan,
        profile,
        evidence: practiceEvidence,
        statuses: questionStatuses,
        blockStore: container.dsaPracticeBlockStore
        // Recovery already ran above, before every Practice read.
      })
    : null;
  let blockHistory = null;
  try {
    blockHistory = await container.dsaBlockHistoryService.read(
      ownerId,
      requestedBlockId,
      questionStatuses
    );
  } catch (error) {
    if (error instanceof DsaBlockHistoryError && error.code === "BLOCK_NOT_FOUND") notFound();
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
      <Link
        href="/practice"
        className="mb-5 inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/52 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Practice
      </Link>
      {plan ? (
        <DsaTopics
          plan={plan}
          roadmap={roadmap}
          questionStatuses={questionStatuses}
          recommendation={recommendation}
          blockHistory={blockHistory}
          panel={panel}
          allowEarlyAssessmentStart={allowEarlyAssessmentStart}
        />
      ) : (
        <div
          role="alert"
          className="mt-10 rounded-2xl border border-white/[0.1] bg-black px-5 py-6 text-sm text-cream/62"
        >
          The question bank is unavailable right now. Refresh in a moment.
        </div>
      )}
    </div>
  );
}
