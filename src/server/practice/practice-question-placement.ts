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
  "architecture-system-design": 12,
  "resume-behavioral-defense": 12
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
  candidateLevel: string | null = null
): SelectedPracticePlacement[] {
  const primary = new Map<PrimaryPracticeSessionKey, SelectedPracticePlacement[]>();
  const completedIds = new Set(
    candidates
      .filter((candidate) => candidate.status === "COMPLETED")
      .map((candidate) => candidate.sourceQuestionId)
  );

  for (const sessionKey of Object.keys(PRIMARY_LIMITS) as PrimaryPracticeSessionKey[]) {
    const inSession = candidates.filter((candidate) => candidate.sessionKey === sessionKey);
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

  const finalDistribution: Array<[PrimaryPracticeSessionKey, number]> = [
    ["core-technical", 3],
    ["applied-engineering", 3],
    ["architecture-system-design", 3],
    ["resume-behavioral-defense", 3]
  ];
  const final = finalDistribution.flatMap(([sessionKey, count]) =>
    (primary.get(sessionKey) ?? []).slice(0, count)
  ).map((candidate, index) => ({
    ...candidate,
    practiceSessionKey: "final-mock" as const,
    order: index + 1,
    selectionReason: "final-mixed-review"
  }));

  return [...primary.values()].flat().concat(final);
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
    tx.candidateProfile.findUnique({ where: { ownerId }, select: { level: true } })
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
  const desired = selectPracticeQuestionPlacements(candidates, plan, profile?.level ?? null);
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
  const blueprintKind = sessionKey === "resume-behavioral-defense" ? "final-mock" : sessionKey;
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
