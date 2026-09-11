import {
  CORE_TECHNICAL_FIRST_STORY_RANKING_POLICY_VERSION,
  CORE_TECHNICAL_ADAPTIVE_STORY_RANKING_POLICY_VERSION,
  coreTechnicalAdaptiveEvidenceSchema,
  coreTechnicalAdaptiveStorySelectionSchema,
  coreTechnicalConfirmedFocusSchema,
  coreTechnicalFirstStorySelectionSchema,
  coreTechnicalStoryRankingCandidateSchema,
  type CoreTechnicalConfirmedFocus,
  type CoreTechnicalAdaptiveEvidence,
  type CoreTechnicalAdaptiveStorySelection,
  type CoreTechnicalFirstStorySelection,
  type CoreTechnicalRankedStory,
  type CoreTechnicalStoryRankingCandidate
} from "@/features/practice/core-technical/domain/focus-ranking-contracts";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "@/features/practice/core-technical/domain/domain-map";

export type CoreTechnicalFirstStoryRankingContext = {
  recentStoryKeys?: string[];
  recentTopicKeys?: string[];
};

/** Deterministic, auditable selection. No model may override compatibility gates or weights. */
export class CoreTechnicalStoryRankingService {
  constructor(private readonly candidates: readonly CoreTechnicalStoryRankingCandidate[]) {}

  rankFirstStory(
    rawFocus: CoreTechnicalConfirmedFocus,
    context: CoreTechnicalFirstStoryRankingContext = {}
  ): CoreTechnicalFirstStorySelection {
    const focus = coreTechnicalConfirmedFocusSchema.parse(rawFocus);
    const candidates = coreTechnicalStoryRankingCandidateSchema.array().parse(this.candidates);
    const requestedDifficulty = difficultyFor(focus);
    const compatible = candidates.filter((candidate) => this.isEligible(candidate, focus));
    const exactDifficulty = compatible.filter((candidate) =>
      candidate.difficulties.includes(requestedDifficulty)
    );
    // Prefer a ready block at the requested level. If that exact level has not
    // shipped yet, use the closest ready block instead of generating a new
    // multi-call pipeline during the user's request.
    const eligible = exactDifficulty.length > 0 ? exactDifficulty : compatible;
    if (eligible.length === 0) {
      throw new Error(
        "No published Core Technical story is compatible with the confirmed focus and exclusions"
      );
    }

    const rankings = eligible
      .map((candidate) =>
        this.score(candidate, focus, availableDifficulty(candidate, requestedDifficulty), context)
      )
      .sort(
        (left, right) =>
          right.scores.total - left.scores.total || left.storyKey.localeCompare(right.storyKey)
      );
    const selectedStory = rankings[0]!;
    const selection = coreTechnicalFirstStorySelectionSchema.parse({
      policyVersion: CORE_TECHNICAL_FIRST_STORY_RANKING_POLICY_VERSION,
      focusFingerprint: focus.focusFingerprint,
      selectedStory,
      rankings,
      reason: selectionReason(selectedStory, focus)
    });
    return deepFreeze(selection);
  }

  /** Validates and personalizes an explicit library choice without overriding the user's choice. */
  rankSelectedStory(
    rawFocus: CoreTechnicalConfirmedFocus,
    storyKey: string,
    context: CoreTechnicalFirstStoryRankingContext = {}
  ): CoreTechnicalFirstStorySelection {
    const focus = coreTechnicalConfirmedFocusSchema.parse(rawFocus);
    const candidates = coreTechnicalStoryRankingCandidateSchema.array().parse(this.candidates);
    const candidate = candidates.find((item) => item.key === storyKey);
    if (!candidate || !this.isSelectable(candidate, focus)) {
      throw new Error("The selected Core Technical practice path is not available for this focus");
    }
    const selectedStory = this.score(
      candidate,
      focus,
      availableDifficulty(candidate, difficultyFor(focus)),
      context
    );
    return deepFreeze(
      coreTechnicalFirstStorySelectionSchema.parse({
        policyVersion: CORE_TECHNICAL_FIRST_STORY_RANKING_POLICY_VERSION,
        focusFingerprint: focus.focusFingerprint,
        selectedStory,
        rankings: [selectedStory],
        reason: `${selectedStory.title} was selected from the reviewed library and personalized for the candidate's level, evidence, and target role.`
      })
    );
  }

  rankNextStory(
    rawFocus: CoreTechnicalConfirmedFocus,
    rawEvidence: CoreTechnicalAdaptiveEvidence
  ): CoreTechnicalAdaptiveStorySelection {
    const selection = this.findNextStory(rawFocus, rawEvidence);
    if (!selection) {
      throw new Error(
        "No published Core Technical story is compatible with the verified assessment evidence"
      );
    }
    return selection;
  }

  findNextStory(
    rawFocus: CoreTechnicalConfirmedFocus,
    rawEvidence: CoreTechnicalAdaptiveEvidence
  ): CoreTechnicalAdaptiveStorySelection | null {
    const focus = coreTechnicalConfirmedFocusSchema.parse(rawFocus);
    const evidence = coreTechnicalAdaptiveEvidenceSchema.parse(rawEvidence);
    const candidates = coreTechnicalStoryRankingCandidateSchema.array().parse(this.candidates);
    const requestedDifficulty = adaptiveDifficulty(evidence);
    const compatible = candidates.filter((candidate) =>
      this.isEligibleNext(candidate, focus, evidence.priorStoryKeys)
    );
    const novel = compatible.filter(
      (candidate) => !evidence.priorStoryKeys.includes(candidate.key)
    );
    const exactDifficulty = novel.filter((candidate) =>
      candidate.difficulties.includes(requestedDifficulty)
    );
    const pool = exactDifficulty.length > 0 ? exactDifficulty : novel;
    if (pool.length === 0) return null;
    const rankings = pool
      .map((candidate) => {
        const difficulty = availableDifficulty(candidate, requestedDifficulty);
        const candidateSignals = new Set([...candidate.topicKeys, ...candidate.mechanismKeys]);
        const assessmentAverage = average(Object.values(evidence.assessmentScores));
        const weaknessDeficit = (100 - assessmentAverage) / 100;
        const weakSignals = [
          ...evidence.practice.weakTopicKeys,
          ...evidence.practice.weakMechanismKeys
        ];
        const weakFit = weakSignals.length === 0 ? 0.5 : hitRatio(candidateSignals, weakSignals);
        const assessmentWeakness = Math.round(30 * weaknessDeficit * (0.5 + 0.5 * weakFit));
        const practiceWeakness = Math.round(25 * hitRatio(candidateSignals, weakSignals));
        const targetText = `${focus.targetJob} ${focus.targetCompany ?? ""}`.toLowerCase();
        const targetMatches = candidate.targetKeywords.filter((keyword) =>
          targetText.includes(keyword.toLowerCase())
        ).length;
        const targetRoleJob = Math.min(20, 12 + targetMatches * 4);
        const priorTopics = new Set(evidence.priorTopicKeys);
        const newTopicRatio =
          candidate.topicKeys.filter((key) => !priorTopics.has(key)).length /
          candidate.topicKeys.length;
        const plannedCoverage = Math.round(15 * (0.4 + 0.6 * newTopicRatio));
        const novelty = Math.round(
          6 +
            (4 * candidate.topicKeys.filter((key) => !priorTopics.has(key)).length) /
              candidate.topicKeys.length
        );
        const scores = {
          assessmentWeakness,
          practiceWeakness,
          targetRoleJob,
          plannedCoverage,
          novelty,
          total: assessmentWeakness + practiceWeakness + targetRoleJob + plannedCoverage + novelty
        };
        const emphasizedConceptKeys = [
          ...candidate.topicKeys.filter((key) => evidence.practice.weakTopicKeys.includes(key)),
          ...candidate.mechanismKeys.filter((key) =>
            evidence.practice.weakMechanismKeys.includes(key)
          ),
          ...candidate.topicKeys
        ]
          .filter((key, index, values) => values.indexOf(key) === index)
          .slice(0, 3);
        return {
          storyKey: candidate.key,
          storyVersion: candidate.version,
          title: candidate.title,
          difficulty,
          emphasizedConceptKeys,
          scores
        };
      })
      .sort(
        (left, right) =>
          right.scores.total - left.scores.total || left.storyKey.localeCompare(right.storyKey)
      );
    const selectedStory = rankings[0]!;
    const weakestDimension =
      Object.entries(evidence.assessmentScores).sort((left, right) => left[1] - right[1])[0]?.[0] ??
      "technical reasoning";
    return deepFreeze(
      coreTechnicalAdaptiveStorySelectionSchema.parse({
        policyVersion: CORE_TECHNICAL_ADAPTIVE_STORY_RANKING_POLICY_VERSION,
        focusFingerprint: focus.focusFingerprint,
        evidence,
        selectedStory,
        rankings,
        reason: bounded(
          `${selectedStory.title} is next because the assessment's weakest area was ${humanize(weakestDimension)}, verified Practice evidence identified ${evidence.practice.weakTopicKeys[0] ?? "a remaining mechanism gap"}, and this story adds useful coverage for ${focus.targetJob}.`,
          420
        )
      })
    );
  }

  private isEligible(
    candidate: CoreTechnicalStoryRankingCandidate,
    focus: CoreTechnicalConfirmedFocus
  ): boolean {
    const topics = new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key));
    const mechanisms = new Set(
      NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys)
    );
    return (
      candidate.publicationStatus === "published" &&
      candidate.roles.includes(focus.role) &&
      candidate.language === focus.stack.language &&
      candidate.runtime === focus.stack.runtime &&
      candidate.runtimeVersion === focus.stack.runtimeVersion &&
      (candidate.frameworks.length === 0 ||
        (focus.stack.framework !== null && candidate.frameworks.includes(focus.stack.framework))) &&
      candidate.prerequisiteStoryKeys.length === 0 &&
      (focus.baselineEvidence.state !== "UNKNOWN" || foundationFit(candidate.topicKeys) >= 0.75) &&
      !candidate.topicKeys.some((key) => focus.excludedTopicKeys.includes(key)) &&
      candidate.topicKeys.every((key) => topics.has(key)) &&
      candidate.mechanismKeys.every((key) => mechanisms.has(key))
    );
  }

  private isSelectable(
    candidate: CoreTechnicalStoryRankingCandidate,
    focus: CoreTechnicalConfirmedFocus
  ): boolean {
    const topics = new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key));
    const mechanisms = new Set(
      NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys)
    );
    return (
      candidate.publicationStatus === "published" &&
      candidate.roles.includes(focus.role) &&
      candidate.language === focus.stack.language &&
      candidate.runtime === focus.stack.runtime &&
      candidate.runtimeVersion === focus.stack.runtimeVersion &&
      (candidate.frameworks.length === 0 ||
        (focus.stack.framework !== null && candidate.frameworks.includes(focus.stack.framework))) &&
      !candidate.topicKeys.some((key) => focus.excludedTopicKeys.includes(key)) &&
      candidate.topicKeys.every((key) => topics.has(key)) &&
      candidate.mechanismKeys.every((key) => mechanisms.has(key))
    );
  }

  private isEligibleNext(
    candidate: CoreTechnicalStoryRankingCandidate,
    focus: CoreTechnicalConfirmedFocus,
    completedStoryKeys: string[]
  ): boolean {
    const topics = new Set(NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => topic.key));
    const mechanisms = new Set(
      NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.flatMap((topic) => topic.mechanismKeys)
    );
    return (
      candidate.publicationStatus === "published" &&
      candidate.roles.includes(focus.role) &&
      candidate.language === focus.stack.language &&
      candidate.runtime === focus.stack.runtime &&
      candidate.runtimeVersion === focus.stack.runtimeVersion &&
      (candidate.frameworks.length === 0 ||
        (focus.stack.framework !== null && candidate.frameworks.includes(focus.stack.framework))) &&
      candidate.prerequisiteStoryKeys.every((key) => completedStoryKeys.includes(key)) &&
      !candidate.topicKeys.some((key) => focus.excludedTopicKeys.includes(key)) &&
      candidate.topicKeys.every((key) => topics.has(key)) &&
      candidate.mechanismKeys.every((key) => mechanisms.has(key))
    );
  }

  private score(
    candidate: CoreTechnicalStoryRankingCandidate,
    focus: CoreTechnicalConfirmedFocus,
    difficulty: CoreTechnicalRankedStory["difficulty"],
    context: CoreTechnicalFirstStoryRankingContext
  ): CoreTechnicalRankedStory {
    const candidateSignals = new Set([...candidate.topicKeys, ...candidate.mechanismKeys]);
    const weakSignals = [
      ...focus.baselineEvidence.weakConceptKeys,
      ...focus.baselineEvidence.weakMechanismKeys
    ];
    const unassessedSignals = [
      ...focus.baselineEvidence.unassessedConceptKeys,
      ...focus.baselineEvidence.unassessedMechanismKeys
    ];
    const baselineGapTransfer =
      focus.baselineEvidence.state === "UNKNOWN"
        ? Math.round(35 * foundationFit(candidate.topicKeys))
        : weakSignals.length > 0
          ? Math.round(
              35 *
                (0.7 * hitRatio(candidateSignals, weakSignals) +
                  0.3 * hitRatio(candidateSignals, unassessedSignals))
            )
          : Math.round(35 * hitRatio(candidateSignals, unassessedSignals));

    const targetText = `${focus.targetJob} ${focus.targetCompany ?? ""}`.toLowerCase();
    const targetMatches = candidate.targetKeywords.filter((keyword) =>
      targetText.includes(keyword.toLowerCase())
    ).length;
    const targetRoleJob = Math.min(25, 15 + targetMatches * 5);

    const resumeSignals = new Set([
      ...focus.resumeEvidence.topicKeys,
      ...focus.resumeEvidence.mechanismKeys
    ]);
    const resumeProjectRelevance =
      resumeSignals.size === 0
        ? 0
        : Math.round(15 * hitRatio(candidateSignals, [...resumeSignals]));

    const topicByKey = new Map(
      NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => [topic.key, topic])
    );
    const importance =
      candidate.topicKeys.reduce((sum, key) => {
        const level = topicByKey.get(key)?.importance;
        return sum + (level === "essential" ? 1 : level === "high" ? 0.75 : 0.5);
      }, 0) / candidate.topicKeys.length;
    const plannedCoverage = Math.round(15 * importance);

    const recentTopics = new Set(context.recentTopicKeys ?? []);
    const recentOverlap =
      candidate.topicKeys.filter((key) => recentTopics.has(key)).length /
      candidate.topicKeys.length;
    const storyRepeated = (context.recentStoryKeys ?? []).includes(candidate.key);
    const storyDiversity = Math.round(
      10 * Math.max(0, 1 - recentOverlap - (storyRepeated ? 0.5 : 0))
    );

    const scores = {
      baselineGapTransfer,
      targetRoleJob,
      resumeProjectRelevance,
      plannedCoverage,
      storyDiversity,
      total:
        baselineGapTransfer +
        targetRoleJob +
        resumeProjectRelevance +
        plannedCoverage +
        storyDiversity
    };
    const emphasizedConceptKeys = prioritizedEmphasis(candidate, focus);
    return {
      storyKey: candidate.key,
      storyVersion: candidate.version,
      title: candidate.title,
      difficulty,
      emphasizedConceptKeys,
      scores
    };
  }
}

function difficultyFor(focus: CoreTechnicalConfirmedFocus): CoreTechnicalRankedStory["difficulty"] {
  if (focus.baselineEvidence.state === "STANDARD") {
    return focus.seniority === "junior" ? "guided" : "standard";
  }
  if (focus.baselineEvidence.state === "STRETCH") {
    return focus.seniority === "senior" ? "stretch" : "standard";
  }
  return "guided";
}

function availableDifficulty(
  candidate: CoreTechnicalStoryRankingCandidate,
  requested: CoreTechnicalRankedStory["difficulty"]
): CoreTechnicalRankedStory["difficulty"] {
  if (candidate.difficulties.includes(requested)) return requested;
  const rank = { guided: 0, standard: 1, stretch: 2 } as const;
  return [...candidate.difficulties].sort(
    (left, right) =>
      Math.abs(rank[left] - rank[requested]) - Math.abs(rank[right] - rank[requested])
  )[0]!;
}

function adaptiveDifficulty(
  evidence: CoreTechnicalAdaptiveEvidence
): CoreTechnicalRankedStory["difficulty"] {
  const score = average(Object.values(evidence.assessmentScores));
  if (score >= 82 && evidence.practice.learnedCount === 0) return "stretch";
  if (score < 55 || evidence.practice.learnedCount >= 3) return "guided";
  return "standard";
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function bounded(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit - 3) + "...";
}

function hitRatio(candidateSignals: Set<string>, targets: string[]): number {
  const uniqueTargets = [...new Set(targets)];
  if (uniqueTargets.length === 0) return 0;
  return uniqueTargets.filter((key) => candidateSignals.has(key)).length / uniqueTargets.length;
}

function foundationFit(topicKeys: string[]): number {
  const foundational = new Set([
    "javascript-values-and-mutation",
    "javascript-scope-and-closures",
    "javascript-modules",
    "async-scheduling",
    "errors-and-cancellation"
  ]);
  return topicKeys.filter((key) => foundational.has(key)).length / topicKeys.length;
}

function prioritizedEmphasis(
  candidate: CoreTechnicalStoryRankingCandidate,
  focus: CoreTechnicalConfirmedFocus
): string[] {
  const selected = new Set(candidate.topicKeys);
  const weak = focus.baselineEvidence.weakConceptKeys.filter((key) => selected.has(key));
  const unassessed = focus.baselineEvidence.unassessedConceptKeys.filter((key) =>
    selected.has(key)
  );
  return [...new Set([...weak, ...unassessed, ...candidate.topicKeys])].slice(0, 3);
}

function selectionReason(
  story: CoreTechnicalRankedStory,
  focus: CoreTechnicalConfirmedFocus
): string {
  const topicByKey = new Map(
    NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => [topic.key, topic.title])
  );
  const emphasized = story.emphasizedConceptKeys[0];
  const topic = emphasized
    ? (topicByKey.get(emphasized)?.toLowerCase() ?? emphasized)
    : "Node.js foundations";
  const evidenceReason =
    focus.baselineEvidence.state === "UNKNOWN"
      ? `your baseline evidence is incomplete, so it starts with broad ${topic}`
      : focus.baselineEvidence.weakConceptKeys.some((key) =>
            story.emphasizedConceptKeys.includes(key)
          )
        ? `your initial assessment showed a gap in ${topic}`
        : `your initial assessment supports an unassessed transfer into ${topic}`;
  return `We chose ${story.title} because ${evidenceReason}, and it is relevant to your ${focus.targetJob} target.`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
