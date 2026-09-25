import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DsaTopics } from "@/features/practice/dsa/ui/dsa-topics";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedOwner } from "@/server/auth/onboarding-guard";
import { buildStableDsaRecommendation } from "@/features/practice/dsa/server/stable-dsa-recommendation";
import { DsaBlockHistoryError } from "@/features/practice/dsa/server/dsa-block-history.service";
import { DsaPracticeBlockStatus } from "@prisma/client";
import { recommendationFromSnapshot } from "@/features/practice/dsa/server/dsa-practice-block.store";
import { getProfileForRequest } from "@/features/profile/server/profile-query";
import { cachedDsaPage } from "@/features/practice/dsa/server/cached-dsa-page";

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
  const { ownerId } = await requireOnboardedOwner();
  const container = getAppContainer();
  const query = await searchParams;
  const requestedBlockId = typeof query.block === "string" ? query.block : null;
  const panel = query.panel === "transcript" ? "transcript" : "overview";
  const [plan, pageProgress, initialHistory] = await Promise.all([
    timedDsaRead(
      "plan",
      container.dsaService.fullPlan().catch(() => null)
    ),
    timedDsaRead("progress", cachedDsaPage(ownerId)),
    timedDsaRead("blocks", container.dsaPracticeBlockStore.history(ownerId))
  ]);
  const { roadmap, questionStatuses } = pageProgress;
  let block = initialHistory.find((item) => item.isCurrent) ?? null;
  let historyRows: typeof initialHistory | undefined = initialHistory;
  if (!block) {
    block = await timedDsaRead("legacyBlock", container.dsaPracticeBlockStore.current(ownerId));
    if (block) historyRows = undefined;
  }
  // Existing cohorts from before write-time promotion may still be practising.
  // Reuse the already loaded status map and touch the database only when the
  // cohort has actually become ready.
  if (
    block?.status === DsaPracticeBlockStatus.PRACTISING &&
    block.questionSlugs.length > 0 &&
    block.questionSlugs.every((slug) => questionStatuses[slug] === "COMPLETED")
  ) {
    block = await timedDsaRead(
      "readinessPromotion",
      container.dsaPracticeBlockStore.refreshReadiness(ownerId)
    );
    historyRows = undefined;
  }
  if (block?.status === DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS) {
    const recovered = await timedDsaRead(
      "assessmentRecovery",
      container.dsaBlockAssessmentFinalizationService.recoverCurrent(ownerId)
    );
    if (recovered) {
      block = await container.dsaPracticeBlockStore.currentForDisplay(ownerId);
      historyRows = undefined;
    }
  }

  let recommendation =
    block && block.status !== DsaPracticeBlockStatus.ASSESSED
      ? recommendationFromSnapshot(block.recommendationSnapshot)
      : null;
  if (!recommendation && plan) {
    // Verified evidence and the full resume profile are only needed when a
    // first, legacy, or post-assessment cohort must actually be selected.
    const [profile, practiceEvidence] = await Promise.all([
      timedDsaRead("profileForNewBlock", getProfileForRequest(ownerId)),
      timedDsaRead(
        "evidenceForNewBlock",
        container.practiceEvidenceStore.refresh(ownerId).catch(() => null)
      )
    ]);
    recommendation = await timedDsaRead(
      "newRecommendation",
      buildStableDsaRecommendation({
        ownerId,
        plan,
        profile,
        evidence: practiceEvidence,
        statuses: questionStatuses,
        blockStore: container.dsaPracticeBlockStore,
        currentBlock: Promise.resolve(block)
      })
    );
    historyRows = undefined;
  }
  let blockHistory = null;
  try {
    blockHistory = await timedDsaRead(
      "history",
      container.dsaBlockHistoryService.read(
        ownerId,
        requestedBlockId,
        questionStatuses,
        panel === "transcript",
        historyRows
      )
    );
  } catch (error) {
    if (error instanceof DsaBlockHistoryError && error.code === "BLOCK_NOT_FOUND") {
      redirect("/practice/dsa");
    }
    throw error;
  }

  return (
    <div className="dsa-practice-page practice-page mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
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
          allowEarlyAssessmentStart={false}
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

async function timedDsaRead<T>(source: string, read: Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    return await read;
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs >= 1_000) {
      console.warn(
        "[DsaPracticePage]",
        JSON.stringify({ event: "dsa_read_slow", source, durationMs })
      );
    }
  }
}
