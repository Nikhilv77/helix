import {
  PracticeSessionAvailability,
  PrepQuestionPublicationStatus,
  Prisma,
  RoadmapQuestionSourceType
} from "@prisma/client";
import type { PersonalizedInterviewPlan } from "@/lib/interviews/personalized-plan";
import type { PracticeSessionKey } from "@/lib/practice/practice-roadmap";

const PRIMARY_LIMITS = {
  "core-technical": 12,
  "applied-engineering": 24,
  "architecture-system-design": 12
} as const;

type PrimaryPracticeSessionKey = keyof typeof PRIMARY_LIMITS;

export interface PracticePlacementCandidate {
  questionProgressId: string;
  sourceQuestionId: string;
  canonicalOrder: number;
  sessionKey: string;
  chapterKey: string;
  contentVersion: number;
  roles: string[];
  levels: string[];
  /** Empty means language-agnostic. See PrepQuestionTemplate.languages. */
  languages: string[];
  format: string;
  prerequisites: string[];
  attemptCount: number;
  bestScore: number | null;
  lastAttemptedAt: Date | null;
  status: string;
  title: string;
  prompt: string;
  competency: string;
  tags: string[];
  whatItTests: string[];
}

export interface SelectedPracticePlacement extends PracticePlacementCandidate {
  practiceSessionKey: PracticeSessionKey;
  order: number;
  selectionReason: string;
}

export interface PracticePlacementReconciliation {
  counts: Map<PracticeSessionKey, number>;
  changed: boolean;
}

/** Candidate-specific, deterministic selection. Chapter round-robin prevents a
 * large topic from crowding out the rest of a session bank. */
export function selectPracticeQuestionPlacements(
  candidates: PracticePlacementCandidate[],
  plan: PersonalizedInterviewPlan,
  candidateLevel: string | null = null,
  candidateLanguage: string | null = null
): SelectedPracticePlacement[] {
  const primary = new Map<PrimaryPracticeSessionKey, SelectedPracticePlacement[]>();
  const completedIds = new Set(
    candidates
      .filter((candidate) => candidate.status === "COMPLETED")
      .map((candidate) => candidate.sourceQuestionId)
  );

  for (const sessionKey of Object.keys(PRIMARY_LIMITS) as PrimaryPracticeSessionKey[]) {
    const inSession = candidates
      .filter((candidate) => candidate.sessionKey === sessionKey)
      // Language is a gate rather than a ranking signal. A `predict-run`
      // question asks what JavaScript prints; for a Go candidate there is no
      // partially-right answer, so the question must not be offered at all.
      // An empty `languages` array means agnostic and always passes.
      .filter(
        (candidate) =>
          candidate.languages.length === 0 ||
          (candidateLanguage !== null && candidate.languages.includes(candidateLanguage))
      );
    const roleMatches = inSession.filter((candidate) =>
      candidate.roles.includes(plan.sourceSnapshot.targetRole.family)
    );
    const pool = roleMatches.length >= Math.min(PRIMARY_LIMITS[sessionKey], inSession.length)
      ? roleMatches
      : inSession;
    const selected = balancedSelection(
      pool,
      PRIMARY_LIMITS[sessionKey],
      candidateTopicScore(plan, sessionKey, candidateLevel, completedIds)
    ).map((candidate, index) => ({
      ...candidate,
      practiceSessionKey: sessionKey,
      order: index + 1,
      selectionReason: selectionReason(candidate, roleMatches, candidateLevel, completedIds)
    }));
    primary.set(sessionKey, selected);
  }

return [...primary.values()].flat();
}

export async function reconcilePracticeQuestionPlacements(
  tx: Prisma.TransactionClient,
  roadmapId: string,
  sessions: Array<{ id: string; practiceSessionKey: string }>,
  plan: PersonalizedInterviewPlan,
  ownerId: string
): Promise<PracticePlacementReconciliation> {
  const [progress, profile] = await Promise.all([
    tx.userQuestionProgress.findMany({
      where: {
        roadmapId,
        sourceType: RoadmapQuestionSourceType.PREP,
        prepQuestionTemplate: { publicationStatus: PrepQuestionPublicationStatus.PUBLISHED }
      },
      select: {
        id: true,
        order: true,
        attemptCount: true,
        bestScore: true,
        lastAttemptedAt: true,
        status: true,
        prepQuestionTemplate: {
          select: {
            id: true,
            sessionKey: true,
            chapterKey: true,
            contentVersion: true,
            roles: true,
            levels: true,
            languages: true,
            format: true,
            prerequisites: true,
            title: true,
            prompt: true,
            competency: true,
            tags: true,
            whatItTests: true
          }
        }
      }
    }),
    tx.candidateProfile.findUnique({
      where: { ownerId },
      select: { level: true, dsaEditorLanguage: true }
    })
  ]);
  const candidates = progress.flatMap((row): PracticePlacementCandidate[] =>
    row.prepQuestionTemplate
      ? [{
          questionProgressId: row.id,
          sourceQuestionId: row.prepQuestionTemplate.id,
          canonicalOrder: row.order,
          attemptCount: row.attemptCount,
          bestScore: row.bestScore,
          lastAttemptedAt: row.lastAttemptedAt,
          status: row.status,
          ...row.prepQuestionTemplate
        }]
      : []
  );
  const desired = selectPracticeQuestionPlacements(
    candidates,
    plan,
    profile?.level ?? null,
    profile?.dsaEditorLanguage ?? null
  );
  const sessionByKey = new Map(sessions.map((session) => [session.practiceSessionKey, session.id]));
  const desiredWithSession = desired.flatMap((placement) => {
    const sessionProgressId = sessionByKey.get(placement.practiceSessionKey);
    return sessionProgressId ? [{ ...placement, sessionProgressId }] : [];
  });
  const counts = new Map<PracticeSessionKey, number>();
  for (const placement of desiredWithSession) {
    counts.set(placement.practiceSessionKey, (counts.get(placement.practiceSessionKey) ?? 0) + 1);
  }

  const existing = await tx.practiceQuestionPlacement.findMany({
    where: { roadmapId },
    select: {
      id: true,
      sessionProgressId: true,
      questionProgressId: true,
      practiceSessionKey: true,
      order: true,
      selectionReason: true,
      contentVersion: true,
      sourceInterviewPlanId: true,
      sourceInterviewPlanRevision: true,
      sourceProfileVersionId: true,
      sourceProfileRevision: true
    }
  });
  const unchanged = samePlacements(existing, desiredWithSession, plan);
  if (unchanged) return { counts, changed: false };

  // Placements are a deterministic index over canonical progress; attempts and
  // mastery live on UserQuestionProgress. Replacing the changed index in two
  // queries avoids dozens of remote upsert round trips. The unchanged path
  // above remains completely write-free.
  await tx.practiceQuestionPlacement.deleteMany({ where: { roadmapId } });
  if (desiredWithSession.length) {
    await tx.practiceQuestionPlacement.createMany({
      data: desiredWithSession.map((placement) => placementData(roadmapId, placement, plan))
    });
  }

  return { counts, changed: true };
}

function placementData(
  roadmapId: string,
  placement: SelectedPracticePlacement & { sessionProgressId: string },
  plan: PersonalizedInterviewPlan
) {
  return {
    roadmapId,
    sessionProgressId: placement.sessionProgressId,
    questionProgressId: placement.questionProgressId,
    practiceSessionKey: placement.practiceSessionKey,
    order: placement.order,
    selectionReason: placement.selectionReason,
    contentVersion: placement.contentVersion,
    sourceInterviewPlanId: plan.id,
    sourceInterviewPlanRevision: plan.revision,
    sourceProfileVersionId: plan.sourceSnapshot.candidateProfile.id,
    sourceProfileRevision: plan.sourceSnapshot.candidateProfile.revision,
    metadata: {
      canonicalOrder: placement.canonicalOrder,
      chapterKey: placement.chapterKey
    }
  } satisfies Prisma.PracticeQuestionPlacementUncheckedCreateInput;
}

function samePlacements(
  existing: Array<{
    sessionProgressId: string;
    questionProgressId: string;
    practiceSessionKey: string;
    order: number;
    selectionReason: string;
    contentVersion: number;
    sourceInterviewPlanId: string | null;
    sourceInterviewPlanRevision: number | null;
    sourceProfileVersionId: string | null;
    sourceProfileRevision: number | null;
  }>,
  desired: Array<SelectedPracticePlacement & { sessionProgressId: string }>,
  plan: PersonalizedInterviewPlan
): boolean {
  if (existing.length !== desired.length) return false;
  const byIdentity = new Map(
    existing.map((placement) => [
      `${placement.sessionProgressId}:${placement.questionProgressId}`,
      placement
    ])
  );
  return desired.every((placement) => {
    const stored = byIdentity.get(`${placement.sessionProgressId}:${placement.questionProgressId}`);
    return Boolean(
      stored &&
      stored.practiceSessionKey === placement.practiceSessionKey &&
      stored.order === placement.order &&
      stored.selectionReason === placement.selectionReason &&
      stored.contentVersion === placement.contentVersion &&
      stored.sourceInterviewPlanId === plan.id &&
      stored.sourceInterviewPlanRevision === plan.revision &&
      stored.sourceProfileVersionId === plan.sourceSnapshot.candidateProfile.id &&
      stored.sourceProfileRevision === plan.sourceSnapshot.candidateProfile.revision
    );
  });
}

function candidateTopicScore(
  plan: PersonalizedInterviewPlan,
  sessionKey: PrimaryPracticeSessionKey,
  candidateLevel: string | null,
  completedIds: Set<string>
): (candidate: PracticePlacementCandidate) => number {
  const blueprintKind = sessionKey;
  const blueprint = plan.sessions.find((session) => session.kind === blueprintKind);
  const targetTokens = new Set(
    (blueprint?.topics ?? []).flatMap((topic) =>
      tokenize([topic.key, topic.label, ...topic.skillKeys, ...topic.objectives].join(" "))
    )
  );
  return (candidate) => {
    const candidateTokens = new Set(tokenize([
      candidate.title,
      candidate.prompt,
      candidate.competency,
      ...candidate.tags,
      ...candidate.whatItTests
    ].join(" ")));
    let score = 0;
    for (const token of targetTokens) if (candidateTokens.has(token)) score += 10;
    score += formatWeight(candidate.format);
    if (candidateLevel && candidate.levels.includes(candidateLevel)) score += 6;
    if (candidate.prerequisites.every((id) => completedIds.has(id))) score += 4;
    else score -= 4;
    if (candidate.attemptCount === 0) score += 2;
    if (candidate.bestScore !== null) score += Math.max(0, 1 - candidate.bestScore) * 5;
    if (candidate.status === "IN_PROGRESS") score += 3;
    if (candidate.status === "COMPLETED") score -= 3;
    return score;
  };
}

/**
 * How much a format is worth beyond its topic match.
 *
 * Topic matching alone favours the questions it was meant to replace: an essay
 * prompt titled "React rendering, state, and effects" shares many more tokens
 * with a React blueprint than "var, closures, and the loop that already
 * finished" does, so eleven typed questions displaced ten predict-run ones in
 * the same session.
 *
 * The weight encodes the product decision rather than fighting it with keywords:
 * a question graded against a known answer is worth more than one graded against
 * an open rubric, because the evidence it produces is more reliable. It is small
 * enough that a strong topic match still wins — two matching tokens outweigh it.
 */
function formatWeight(format: string): number {
  switch (format) {
    // Mechanically verified: the runtime decides, not a model.
    case "predict-run":
      return 14;
    // Graded against a planted answer the grader is told.
    case "find-the-flaw":
    case "diagnose":
      return 12;
    // Open rubric over prose.
    case "typed":
    case "spoken":
    case "diagram":
      return 0;
    // Recognition only; retired from Practice but defensive.
    case "mcq":
      return -6;
    default:
      return 0;
  }
}

function selectionReason(
  candidate: PracticePlacementCandidate,
  roleMatches: PracticePlacementCandidate[],
  candidateLevel: string | null,
  completedIds: Set<string>
): string {
  const reasons = [roleMatches.includes(candidate) ? "role" : "bank-fallback", "blueprint"];
  if (candidateLevel && candidate.levels.includes(candidateLevel)) reasons.push("level");
  if (candidate.prerequisites.every((id) => completedIds.has(id))) reasons.push("prerequisite-ready");
  if (candidate.attemptCount > 0 && candidate.status !== "COMPLETED") reasons.push("practice-gap");
  return reasons.join("+");
}

function balancedSelection(
  candidates: PracticePlacementCandidate[],
  limit: number,
  score: (candidate: PracticePlacementCandidate) => number
): PracticePlacementCandidate[] {
  const groups = new Map<string, PracticePlacementCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.chapterKey) ?? [];
    group.push(candidate);
    groups.set(candidate.chapterKey, group);
  }
  for (const group of groups.values()) {
    group.sort((left, right) =>
      score(right) - score(left) ||
      left.canonicalOrder - right.canonicalOrder ||
      left.questionProgressId.localeCompare(right.questionProgressId)
    );
  }
  const chapterKeys = [...groups.keys()].sort();
  const selected: PracticePlacementCandidate[] = [];
  while (selected.length < limit) {
    let added = false;
    for (const chapterKey of chapterKeys) {
      const candidate = groups.get(chapterKey)?.shift();
      if (!candidate) continue;
      selected.push(candidate);
      added = true;
      if (selected.length === limit) break;
    }
    if (!added) break;
  }
  return selected;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
}

export function placementAvailability(count: number): PracticeSessionAvailability {
  return count > 0
    ? PracticeSessionAvailability.AVAILABLE
    : PracticeSessionAvailability.UNAVAILABLE;
}
