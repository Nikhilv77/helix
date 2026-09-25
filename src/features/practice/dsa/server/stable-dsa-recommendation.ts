import { DsaPracticeBlockStatus } from "@prisma/client";
import {
  buildDsaRecommendation,
  type DsaRecommendation
} from "@/features/practice/dsa/domain/dsa-recommendation";
import type { CandidatePracticeEvidence } from "@/features/practice/shared/domain/practice-evidence";
import type { FrontendDsaPlan } from "@/lib/roadmap/frontend-plan";
import type { CandidateProfile } from "@/lib/shared/types";
import { parseDsaBlockAssessmentReport } from "@/features/practice/dsa/domain/block-assessment-report";
import type { DsaBlockAssessmentFinalizationService } from "./dsa-block-assessment-finalization.service";
import {
  DsaPracticeBlockStore,
  recommendationFromSnapshot,
  type DsaPracticeBlockRecord
} from "@/features/practice/dsa/server/dsa-practice-block.store";

/**
 * Keeps a recommendation cohort stable through its end-of-block assessment.
 * The next evidence-based cohort is selected only after that assessment is
 * terminally assessed; completing questions only makes the assessment ready.
 */
export async function buildStableDsaRecommendation(input: {
  ownerId: string;
  plan: FrontendDsaPlan;
  profile: CandidateProfile;
  evidence: CandidatePracticeEvidence | null;
  loadEvidence?: () => Promise<CandidatePracticeEvidence | null>;
  statuses: Record<string, string>;
  blockStore: DsaPracticeBlockStore;
  finalizationService?: DsaBlockAssessmentFinalizationService;
  currentBlock?: Promise<DsaPracticeBlockRecord | null>;
}): Promise<DsaRecommendation | null> {
  // This is lifecycle authority, not a best-effort display enhancement. If a
  // durable read or transition fails, fail the page request rather than show a
  // freshly calculated cohort that may contradict the persisted current one.
  let current = await (input.currentBlock ?? input.blockStore.currentWithReadiness(input.ownerId));
  if (current?.status === DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS) {
    const recovered = await input.finalizationService?.recoverCurrent(input.ownerId);
    if (recovered) current = await input.blockStore.currentWithReadiness(input.ownerId);
  }
  if (current) {
    if (current && current.status !== DsaPracticeBlockStatus.ASSESSED) {
      // Durable snapshots preserve the exact recommendation copy as well as
      // the cohort. Legacy JSON rows lack that copy, so reconstruct only their
      // frozen question set while preserving backward compatibility.
      const snapshot = recommendationFromSnapshot(current.recommendationSnapshot);
      if (snapshot) return snapshot;
      return buildDsaRecommendation({
        plan: input.plan,
        profile: input.profile,
        evidence: input.evidence ?? (await input.loadEvidence?.()) ?? null,
        statuses: input.statuses,
        blockQuestionSlugs: current.questionSlugs,
        retainCompletedQuestions: true
      });
    }
  }

  const assessmentReport = current?.assessment?.reportSnapshot
    ? parseDsaBlockAssessmentReport(current.assessment.reportSnapshot)
    : null;
  const nextRecommendation = buildDsaRecommendation({
    plan: input.plan,
    profile: input.profile,
    evidence: input.evidence ?? (await input.loadEvidence?.()) ?? null,
    statuses: input.statuses,
    assessmentReport
  });
  if (!nextRecommendation) return null;

  const stored = await input.blockStore.createOrAdvance(input.ownerId, nextRecommendation);
  const persistedRecommendation = recommendationFromSnapshot(stored.recommendationSnapshot);
  if (!persistedRecommendation) {
    throw new Error("Durable DSA practice block is missing its recommendation snapshot.");
  }
  return persistedRecommendation;
}
