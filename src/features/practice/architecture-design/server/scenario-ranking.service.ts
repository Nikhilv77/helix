import {
  ARCHITECTURE_DESIGN_FIRST_SCENARIO_RANKING_POLICY_VERSION,
  ARCHITECTURE_DESIGN_ADAPTIVE_SCENARIO_RANKING_POLICY_VERSION,
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  architectureDesignConfirmedFocusSchema,
  architectureDesignAdaptiveEvidenceSchema,
  architectureDesignAdaptiveScenarioSelectionSchema,
  architectureDesignFirstScenarioSelectionSchema,
  architectureDesignScenarioRankingCandidateSchema,
  type ArchitectureDesignConfirmedFocus,
  type ArchitectureDesignAdaptiveEvidence,
  type ArchitectureDesignAdaptiveScenarioSelection,
  type ArchitectureDesignAdaptiveRankedScenario,
  type ArchitectureDesignDimension,
  type ArchitectureDesignFirstScenarioSelection,
  type ArchitectureDesignRankedScenario,
  type ArchitectureDesignScenarioRankingCandidate
} from "@/features/practice/architecture-design/domain";

export type ArchitectureDesignFirstScenarioRankingContext = {
  recentScenarioKeys?: string[];
  recentTopicKeys?: string[];
};

/** Deterministic selection; publication and compatibility are non-negotiable gates. */
export class ArchitectureDesignScenarioRankingService {
  constructor(
    private readonly candidates: readonly ArchitectureDesignScenarioRankingCandidate[] = ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE
  ) {}

  rankFirstScenario(
    rawFocus: ArchitectureDesignConfirmedFocus,
    context: ArchitectureDesignFirstScenarioRankingContext = {}
  ): ArchitectureDesignFirstScenarioSelection {
    const focus = architectureDesignConfirmedFocusSchema.parse(rawFocus);
    const candidates = architectureDesignScenarioRankingCandidateSchema
      .array()
      .parse(this.candidates);
    const requestedDifficulty = focus.baselineEvidence.state === "STANDARD" ? "standard" : "guided";
    const recent = new Set(context.recentScenarioKeys ?? []);
    const compatible = candidates.filter(
      (candidate) => !recent.has(candidate.key) && isEligible(candidate, focus)
    );
    const exact = compatible.filter((candidate) =>
      candidate.difficulties.includes(requestedDifficulty)
    );
    const pool = exact.length > 0 ? exact : compatible;
    if (pool.length === 0) {
      throw new Error("No published Architecture scenario is compatible with the confirmed focus");
    }

    const recentFamilies = architectureFamiliesForKeys(
      candidates,
      context.recentScenarioKeys ?? []
    );
    const rankings = pool
      .map((candidate) =>
        score(
          candidate,
          focus,
          availableDifficulty(candidate, requestedDifficulty),
          context,
          recentFamilies
        )
      )
      .sort(
        (left, right) =>
          right.scores.total - left.scores.total ||
          left.scenarioKey.localeCompare(right.scenarioKey)
      );
    const selectedScenario = rankings[0]!;
    return deepFreeze(
      architectureDesignFirstScenarioSelectionSchema.parse({
        policyVersion: ARCHITECTURE_DESIGN_FIRST_SCENARIO_RANKING_POLICY_VERSION,
        focusFingerprint: focus.focusFingerprint,
        selectedScenario,
        rankings,
        reason: selectionReason(selectedScenario, focus)
      })
    );
  }

  /** Materializes one explicitly selected reviewed library scenario under the active focus. */
  rankSelectedScenario(
    rawFocus: ArchitectureDesignConfirmedFocus,
    scenarioKey: string,
    context: ArchitectureDesignFirstScenarioRankingContext = {}
  ): ArchitectureDesignFirstScenarioSelection {
    const focus = architectureDesignConfirmedFocusSchema.parse(rawFocus);
    const candidates = architectureDesignScenarioRankingCandidateSchema
      .array()
      .parse(this.candidates);
    const candidate = candidates.find(({ key }) => key === scenarioKey);
    if (
      !candidate ||
      !isEligibleForContinuation(candidate, focus, context.recentScenarioKeys ?? [])
    ) {
      throw new Error(
        "The selected published Architecture scenario is not compatible with the confirmed focus"
      );
    }
    const requestedDifficulty = focus.baselineEvidence.state === "STANDARD" ? "standard" : "guided";
    const ranked = score(
      candidate,
      focus,
      availableDifficulty(candidate, requestedDifficulty),
      context,
      architectureFamiliesForKeys(candidates, context.recentScenarioKeys ?? [])
    );
    return deepFreeze(
      architectureDesignFirstScenarioSelectionSchema.parse({
        policyVersion: ARCHITECTURE_DESIGN_FIRST_SCENARIO_RANKING_POLICY_VERSION,
        focusFingerprint: focus.focusFingerprint,
        selectedScenario: ranked,
        rankings: [ranked],
        reason: `You selected ${ranked.title} from the reviewed Architecture & Design library for this role-aligned path.`
      })
    );
  }

  rankNextScenario(
    rawFocus: ArchitectureDesignConfirmedFocus,
    rawEvidence: ArchitectureDesignAdaptiveEvidence
  ): ArchitectureDesignAdaptiveScenarioSelection {
    const focus = architectureDesignConfirmedFocusSchema.parse(rawFocus);
    const evidence = architectureDesignAdaptiveEvidenceSchema.parse(rawEvidence);
    const candidates = architectureDesignScenarioRankingCandidateSchema
      .array()
      .parse(this.candidates);
    const requestedDifficulty = adaptiveDifficulty(evidence, focus.seniority);
    const compatible = candidates.filter((candidate) =>
      isEligibleForContinuation(candidate, focus, evidence.priorScenarioKeys)
    );
    const novel = compatible.filter(
      (candidate) => !evidence.priorScenarioKeys.includes(candidate.key)
    );
    const exact = novel.filter((candidate) => candidate.difficulties.includes(requestedDifficulty));
    const pool = exact.length > 0 ? exact : novel;
    if (pool.length === 0) {
      throw new Error(
        "No published Architecture scenario is compatible with the verified evidence"
      );
    }
    const weakDimensions = adaptiveWeaknessDimensions(evidence);
    const priorFamilies = architectureFamiliesForKeys(candidates, evidence.priorScenarioKeys);
    const rankings = pool
      .map((candidate) =>
        scoreAdaptive(
          candidate,
          focus,
          evidence,
          weakDimensions,
          availableDifficulty(candidate, requestedDifficulty),
          priorFamilies
        )
      )
      .sort(
        (left, right) =>
          right.scores.total - left.scores.total ||
          left.scenarioKey.localeCompare(right.scenarioKey)
      );
    const selectedScenario = rankings[0]!;
    const weakestMeasure = Object.entries(evidence.assessmentScores).sort(
      (left, right) => left[1] - right[1]
    )[0]?.[0];
    return deepFreeze(
      architectureDesignAdaptiveScenarioSelectionSchema.parse({
        policyVersion: ARCHITECTURE_DESIGN_ADAPTIVE_SCENARIO_RANKING_POLICY_VERSION,
        focusFingerprint: focus.focusFingerprint,
        evidence,
        selectedScenario,
        rankings,
        reason: `We chose ${selectedScenario.title} because ${humanize(weakestMeasure ?? "architecture judgment")} needs the most reinforcement and this scenario adds unrepeated evidence.`
      })
    );
  }

  findNextScenario(
    rawFocus: ArchitectureDesignConfirmedFocus,
    rawEvidence: ArchitectureDesignAdaptiveEvidence
  ): ArchitectureDesignAdaptiveScenarioSelection | null {
    const focus = architectureDesignConfirmedFocusSchema.parse(rawFocus);
    const evidence = architectureDesignAdaptiveEvidenceSchema.parse(rawEvidence);
    const candidates = architectureDesignScenarioRankingCandidateSchema
      .array()
      .parse(this.candidates);
    const hasEligibleNovelScenario = candidates.some(
      (candidate) =>
        isEligibleForContinuation(candidate, focus, evidence.priorScenarioKeys) &&
        !evidence.priorScenarioKeys.includes(candidate.key)
    );
    return hasEligibleNovelScenario ? this.rankNextScenario(focus, evidence) : null;
  }
}

function isEligible(
  candidate: ArchitectureDesignScenarioRankingCandidate,
  focus: ArchitectureDesignConfirmedFocus
): boolean {
  return (
    candidate.publicationStatus === "published" &&
    candidate.roles.includes(focus.role) &&
    candidate.seniorities.includes(focus.seniority) &&
    candidate.prerequisiteScenarioKeys.length === 0 &&
    !focus.excludedScenarioKeys.includes(candidate.key)
  );
}

function isEligibleForContinuation(
  candidate: ArchitectureDesignScenarioRankingCandidate,
  focus: ArchitectureDesignConfirmedFocus,
  completedScenarioKeys: string[]
): boolean {
  return (
    candidate.publicationStatus === "published" &&
    candidate.roles.includes(focus.role) &&
    candidate.seniorities.includes(focus.seniority) &&
    candidate.prerequisiteScenarioKeys.every((key) => completedScenarioKeys.includes(key)) &&
    !focus.excludedScenarioKeys.includes(candidate.key)
  );
}

function score(
  candidate: ArchitectureDesignScenarioRankingCandidate,
  focus: ArchitectureDesignConfirmedFocus,
  difficulty: ArchitectureDesignRankedScenario["difficulty"],
  context: ArchitectureDesignFirstScenarioRankingContext,
  recentFamilies: ReadonlySet<ArchitectureDesignScenarioRankingCandidate["architectureFamily"]>
): ArchitectureDesignRankedScenario {
  const candidateSignals = new Set([
    ...candidate.topicKeys,
    ...candidate.emphasisDimensionKeys,
    ...candidate.targetKeywords.map(normalize)
  ]);
  const baselineTargets =
    focus.baselineEvidence.weakDimensionKeys.length > 0
      ? focus.baselineEvidence.weakDimensionKeys
      : focus.baselineEvidence.unassessedDimensionKeys;
  const baselineGapTransfer = Math.round(30 * hitRatio(candidateSignals, baselineTargets));
  const targetText = normalize(`${focus.targetJob} ${focus.targetCompany ?? ""}`);
  const targetMatches = candidate.targetKeywords.filter((keyword) =>
    targetText.includes(normalize(keyword))
  ).length;
  const targetRoleJob = Math.min(20, 12 + targetMatches * 4);
  const resumeSignals = [
    ...focus.resumeEvidence.architectureSkillKeys,
    ...focus.resumeEvidence.projectKeywords.map(normalize)
  ];
  const resumeProjectRelevance =
    resumeSignals.length === 0 ? 0 : Math.round(15 * hitRatio(candidateSignals, resumeSignals));
  const dimensionCoverage = Math.round(
    20 * hitRatio(new Set(candidate.emphasisDimensionKeys), baselineTargets)
  );
  const planSignals = [...focus.planEvidence.topicKeys, ...focus.planEvidence.skillKeys];
  const plannedCoverage = Math.round(10 * hitRatio(candidateSignals, planSignals));
  const recentTopics = new Set(context.recentTopicKeys ?? []);
  const topicNovelty = Math.round(5 * (1 - hitRatio(recentTopics, candidate.topicKeys)));
  const novelty = familyNovelty(candidate, recentFamilies, topicNovelty);
  const scores = {
    baselineGapTransfer,
    targetRoleJob,
    resumeProjectRelevance,
    dimensionCoverage,
    plannedCoverage,
    novelty,
    total:
      baselineGapTransfer +
      targetRoleJob +
      resumeProjectRelevance +
      dimensionCoverage +
      plannedCoverage +
      novelty
  };
  return {
    scenarioKey: candidate.key,
    scenarioVersion: candidate.version,
    title: candidate.title,
    difficulty,
    emphasizedDimensionKeys: prioritizedDimensions(candidate, focus),
    scores
  };
}

function prioritizedDimensions(
  candidate: ArchitectureDesignScenarioRankingCandidate,
  focus: ArchitectureDesignConfirmedFocus
): ArchitectureDesignDimension[] {
  return [
    ...focus.baselineEvidence.weakDimensionKeys,
    ...focus.baselineEvidence.unassessedDimensionKeys,
    ...candidate.emphasisDimensionKeys,
    ...candidate.dimensionKeys
  ]
    .filter((key) => candidate.dimensionKeys.includes(key))
    .filter(uniqueValue)
    .slice(0, 5);
}

function scoreAdaptive(
  candidate: ArchitectureDesignScenarioRankingCandidate,
  focus: ArchitectureDesignConfirmedFocus,
  evidence: ArchitectureDesignAdaptiveEvidence,
  weakDimensions: ArchitectureDesignDimension[],
  difficulty: ArchitectureDesignAdaptiveRankedScenario["difficulty"],
  priorFamilies: ReadonlySet<ArchitectureDesignScenarioRankingCandidate["architectureFamily"]>
): ArchitectureDesignAdaptiveRankedScenario {
  const candidateSignals = new Set([
    ...candidate.topicKeys,
    ...candidate.emphasisDimensionKeys,
    ...candidate.targetKeywords.map(normalize)
  ]);
  const assessmentAverage = average(Object.values(evidence.assessmentScores));
  const assessmentWeakness = Math.round(
    30 *
      ((100 - assessmentAverage) / 100) *
      (0.5 + 0.5 * hitRatio(candidateSignals, weakDimensions))
  );
  const practiceWeakness = Math.round(
    25 * hitRatio(candidateSignals, evidence.practice.weakDimensionKeys)
  );
  const targetText = normalize(`${focus.targetJob} ${focus.targetCompany ?? ""}`);
  const targetMatches = candidate.targetKeywords.filter((keyword) =>
    targetText.includes(normalize(keyword))
  ).length;
  const targetRoleJob = Math.min(15, 9 + targetMatches * 3);
  const dimensionCoverage = Math.round(
    15 * hitRatio(new Set(candidate.emphasisDimensionKeys), weakDimensions)
  );
  const priorTopics = new Set(evidence.priorTopicKeys);
  const plannedCoverage = Math.round(
    10 *
      (candidate.topicKeys.filter((key) => !priorTopics.has(key)).length /
        candidate.topicKeys.length)
  );
  const novelty = familyNovelty(candidate, priorFamilies, 5);
  const scores = {
    assessmentWeakness,
    practiceWeakness,
    targetRoleJob,
    dimensionCoverage,
    plannedCoverage,
    novelty,
    total:
      assessmentWeakness +
      practiceWeakness +
      targetRoleJob +
      dimensionCoverage +
      plannedCoverage +
      novelty
  };
  return {
    scenarioKey: candidate.key,
    scenarioVersion: candidate.version,
    title: candidate.title,
    difficulty,
    emphasizedDimensionKeys: [...weakDimensions, ...candidate.dimensionKeys]
      .filter((key) => candidate.dimensionKeys.includes(key))
      .filter(uniqueValue)
      .slice(0, 5),
    scores
  };
}

function selectionReason(
  selected: ArchitectureDesignRankedScenario,
  focus: ArchitectureDesignConfirmedFocus
): string {
  const dimension = selected.emphasizedDimensionKeys[0]?.replaceAll("-", " ") ?? "system design";
  const evidence =
    focus.baselineEvidence.state === "UNKNOWN"
      ? "your onboarding evidence is incomplete"
      : focus.baselineEvidence.weakDimensionKeys.includes(
            selected.emphasizedDimensionKeys[0] as ArchitectureDesignDimension
          )
        ? `your onboarding evidence showed a gap in ${dimension}`
        : `${dimension} still needs direct evidence`;
  return `We chose ${selected.title} because ${evidence}, and it supports your ${focus.targetJob} target.`;
}

function availableDifficulty(
  candidate: ArchitectureDesignScenarioRankingCandidate,
  requested: ArchitectureDesignRankedScenario["difficulty"]
): ArchitectureDesignRankedScenario["difficulty"] {
  if (candidate.difficulties.includes(requested)) return requested;
  const rank = { guided: 0, standard: 1, stretch: 2 } as const;
  return [...candidate.difficulties].sort(
    (left, right) =>
      Math.abs(rank[left] - rank[requested]) - Math.abs(rank[right] - rank[requested])
  )[0]!;
}

function adaptiveDifficulty(
  evidence: ArchitectureDesignAdaptiveEvidence,
  seniority: ArchitectureDesignConfirmedFocus["seniority"]
): ArchitectureDesignAdaptiveRankedScenario["difficulty"] {
  const score = average(Object.values(evidence.assessmentScores));
  if (score >= 82 && evidence.practice.learnedCount === 0 && seniority === "senior") {
    return "stretch";
  }
  if (score < 55 || evidence.practice.learnedCount >= 2) return "guided";
  return "standard";
}

function adaptiveWeaknessDimensions(
  evidence: ArchitectureDesignAdaptiveEvidence
): ArchitectureDesignDimension[] {
  const weakest = Object.entries(evidence.assessmentScores).sort(
    (left, right) => left[1] - right[1]
  )[0]?.[0];
  const byMeasure: Record<string, ArchitectureDesignDimension[]> = {
    requirementsScope: ["requirements-framing"],
    apiDataCapacity: [
      "capacity-estimation",
      "api-event-contracts",
      "data-modeling",
      "storage-access-patterns",
      "consistency-transactions"
    ],
    architectureTradeoffs: [
      "component-boundaries",
      "caching-contention",
      "async-work-backpressure",
      "partitioning-hotspots",
      "tradeoff-communication"
    ],
    reliabilitySecurityOperability: [
      "reliability-failure-isolation",
      "observability-slos",
      "security-privacy",
      "cost-efficiency"
    ],
    communicationEvolution: ["tradeoff-communication", "migration-evolution"]
  };
  return [...(byMeasure[weakest ?? ""] ?? []), ...evidence.practice.weakDimensionKeys].filter(
    uniqueValue
  );
}

function hitRatio(candidateSignals: ReadonlySet<string>, targets: readonly string[]): number {
  const unique = [...new Set(targets.map(normalize))];
  if (unique.length === 0) return 0;
  return unique.filter((key) => candidateSignals.has(key)).length / unique.length;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function architectureFamiliesForKeys(
  candidates: readonly ArchitectureDesignScenarioRankingCandidate[],
  scenarioKeys: readonly string[]
): ReadonlySet<ArchitectureDesignScenarioRankingCandidate["architectureFamily"]> {
  const keys = new Set(scenarioKeys);
  return new Set(
    candidates
      .filter((candidate) => keys.has(candidate.key))
      .map((candidate) => candidate.architectureFamily)
  );
}

function familyNovelty(
  candidate: ArchitectureDesignScenarioRankingCandidate,
  priorFamilies: ReadonlySet<ArchitectureDesignScenarioRankingCandidate["architectureFamily"]>,
  fallback: number
): number {
  if (priorFamilies.size === 0) return fallback;
  return priorFamilies.has(candidate.architectureFamily) ? 0 : 5;
}

function uniqueValue<T>(value: T, index: number, values: T[]): boolean {
  return values.indexOf(value) === index;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
