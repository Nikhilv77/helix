import {
  APPLIED_ENGINEERING_ADAPTIVE_INCIDENT_RANKING_POLICY_VERSION,
  APPLIED_ENGINEERING_FIRST_INCIDENT_RANKING_POLICY_VERSION,
  appliedEngineeringAdaptiveEvidenceSchema,
  appliedEngineeringAdaptiveIncidentSelectionSchema,
  appliedEngineeringConfirmedFocusSchema,
  appliedEngineeringFirstIncidentSelectionSchema,
  appliedEngineeringIncidentRankingCandidateSchema,
  type AppliedEngineeringAdaptiveEvidence,
  type AppliedEngineeringAdaptiveIncidentSelection,
  type AppliedEngineeringAdaptiveRankedIncident,
  type AppliedEngineeringConfirmedFocus,
  type AppliedEngineeringFirstIncidentSelection,
  type AppliedEngineeringIncidentRankingCandidate,
  type AppliedEngineeringProductionSignal,
  type AppliedEngineeringRankedIncident
} from "@/lib/practice/applied-engineering";

export type AppliedEngineeringFirstIncidentRankingContext = {
  recentIncidentKeys?: string[];
  recentTopicKeys?: string[];
};

const FOUNDATION_SIGNALS = new Set<AppliedEngineeringProductionSignal>([
  "customer-impact",
  "evidence-selection",
  "root-cause-reasoning",
  "testing-verification",
  "observability",
  "rollout-safety"
]);

/** Deterministic selection; no model may override compatibility or publication gates. */
export class AppliedEngineeringIncidentRankingService {
  constructor(private readonly candidates: readonly AppliedEngineeringIncidentRankingCandidate[]) {}

  rankFirstIncident(
    rawFocus: AppliedEngineeringConfirmedFocus,
    context: AppliedEngineeringFirstIncidentRankingContext = {}
  ): AppliedEngineeringFirstIncidentSelection {
    const focus = appliedEngineeringConfirmedFocusSchema.parse(rawFocus);
    const candidates = appliedEngineeringIncidentRankingCandidateSchema
      .array()
      .parse(this.candidates);
    const requestedDifficulty = difficultyFor(focus);
    const recentIncidentKeys = new Set(context.recentIncidentKeys ?? []);
    const compatible = candidates.filter(
      (candidate) =>
        !recentIncidentKeys.has(candidate.key) && this.isEligible(candidate, focus, [])
    );
    const exact = compatible.filter((candidate) =>
      candidate.difficulties.includes(requestedDifficulty)
    );
    const pool = exact.length > 0 ? exact : compatible;
    if (pool.length === 0) {
      throw new Error(
        "No published Applied Engineering incident is compatible with the confirmed focus"
      );
    }

    const rankings = pool
      .map((candidate) =>
        this.scoreFirst(
          candidate,
          focus,
          availableDifficulty(candidate, requestedDifficulty),
          context
        )
      )
      .sort(
        (left, right) =>
          right.scores.total - left.scores.total ||
          left.incidentKey.localeCompare(right.incidentKey)
      );
    const selectedIncident = rankings[0]!;
    return deepFreeze(
      appliedEngineeringFirstIncidentSelectionSchema.parse({
        policyVersion: APPLIED_ENGINEERING_FIRST_INCIDENT_RANKING_POLICY_VERSION,
        focusFingerprint: focus.focusFingerprint,
        selectedIncident,
        rankings,
        reason: firstSelectionReason(selectedIncident, focus)
      })
    );
  }

  rankNextIncident(
    rawFocus: AppliedEngineeringConfirmedFocus,
    rawEvidence: AppliedEngineeringAdaptiveEvidence
  ): AppliedEngineeringAdaptiveIncidentSelection {
    const focus = appliedEngineeringConfirmedFocusSchema.parse(rawFocus);
    const evidence = appliedEngineeringAdaptiveEvidenceSchema.parse(rawEvidence);
    const candidates = appliedEngineeringIncidentRankingCandidateSchema
      .array()
      .parse(this.candidates);
    const requestedDifficulty = adaptiveDifficulty(evidence);
    const compatible = candidates.filter((candidate) =>
      this.isEligible(candidate, focus, evidence.priorIncidentKeys)
    );
    const novel = compatible.filter(
      (candidate) => !evidence.priorIncidentKeys.includes(candidate.key)
    );
    const exact = novel.filter((candidate) => candidate.difficulties.includes(requestedDifficulty));
    const pool = exact.length > 0 ? exact : novel;
    if (pool.length === 0) {
      throw new Error(
        "No published Applied Engineering incident is compatible with the verified evidence"
      );
    }

    const weaknessSignals = adaptiveWeaknessSignals(evidence);
    const rankings = pool
      .map((candidate) =>
        this.scoreAdaptive(
          candidate,
          focus,
          evidence,
          weaknessSignals,
          availableDifficulty(candidate, requestedDifficulty)
        )
      )
      .sort(
        (left, right) =>
          right.scores.total - left.scores.total ||
          left.incidentKey.localeCompare(right.incidentKey)
      );
    const selectedIncident = rankings[0]!;
    const weakestDimension = Object.entries(evidence.assessmentScores).sort(
      (left, right) => left[1] - right[1]
    )[0]?.[0];

    return deepFreeze(
      appliedEngineeringAdaptiveIncidentSelectionSchema.parse({
        policyVersion: APPLIED_ENGINEERING_ADAPTIVE_INCIDENT_RANKING_POLICY_VERSION,
        focusFingerprint: focus.focusFingerprint,
        evidence,
        selectedIncident,
        rankings,
        reason: bounded(
          `${selectedIncident.title} is next because ${humanize(weakestDimension ?? "production judgment")} needs the most reinforcement and the incident adds unrepeated evidence for ${focus.targetJob}.`,
          500
        )
      })
    );
  }

  private isEligible(
    candidate: AppliedEngineeringIncidentRankingCandidate,
    focus: AppliedEngineeringConfirmedFocus,
    completedIncidentKeys: string[]
  ): boolean {
    return (
      candidate.publicationStatus === "published" &&
      candidate.roles.includes(focus.role) &&
      candidate.language === focus.stack.language &&
      candidate.runtime === focus.stack.runtime &&
      candidate.runtimeVersion === focus.stack.runtimeVersion &&
      (candidate.frameworks.length === 0 ||
        (focus.stack.framework !== null && candidate.frameworks.includes(focus.stack.framework))) &&
      candidate.prerequisiteIncidentKeys.every((key) => completedIncidentKeys.includes(key)) &&
      !focus.excludedIncidentKeys.includes(candidate.key) &&
      (focus.baselineEvidence.state !== "UNKNOWN" ||
        candidate.difficulties.includes("guided") ||
        foundationFit(candidate.productionSignalKeys) >= 0.5)
    );
  }

  private scoreFirst(
    candidate: AppliedEngineeringIncidentRankingCandidate,
    focus: AppliedEngineeringConfirmedFocus,
    difficulty: AppliedEngineeringRankedIncident["difficulty"],
    context: AppliedEngineeringFirstIncidentRankingContext
  ): AppliedEngineeringRankedIncident {
    const candidateSignals = new Set<string>([
      ...candidate.topicKeys,
      ...candidate.productionSignalKeys,
      ...candidate.targetKeywords
    ]);
    const baseline = focus.baselineEvidence;
    const baselineGapTransfer =
      baseline.state === "UNKNOWN"
        ? Math.round(30 * foundationFit(candidate.productionSignalKeys))
        : baseline.weakSignalKeys.length > 0
          ? Math.round(
              30 *
                (0.75 * hitRatio(candidateSignals, baseline.weakSignalKeys) +
                  0.25 * hitRatio(candidateSignals, baseline.unassessedSignalKeys))
            )
          : Math.round(30 * hitRatio(candidateSignals, baseline.unassessedSignalKeys));
    const targetText = `${focus.targetJob} ${focus.targetCompany ?? ""}`.toLowerCase();
    const targetMatches = candidate.targetKeywords.filter((keyword) =>
      targetText.includes(keyword.toLowerCase())
    ).length;
    const targetRoleJob = Math.min(20, 12 + targetMatches * 4);
    const resumeSignals = [
      ...focus.resumeEvidence.technologyKeys,
      ...focus.resumeEvidence.projectKeywords,
      ...focus.resumeEvidence.productionSignalKeys
    ];
    const resumeProjectRelevance =
      resumeSignals.length === 0 ? 0 : Math.round(15 * hitRatio(candidateSignals, resumeSignals));
    const productionEvidenceCoverage = Math.round(
      20 * foundationFit(candidate.productionSignalKeys)
    );
    const plannedCoverage = Math.round(
      10 * hitRatio(candidateSignals, baseline.unassessedSignalKeys)
    );
    const recentTopics = new Set(context.recentTopicKeys ?? []);
    const recentOverlap = hitRatio(recentTopics, candidate.topicKeys);
    const repeated = (context.recentIncidentKeys ?? []).includes(candidate.key);
    const novelty = Math.round(5 * Math.max(0, 1 - recentOverlap - (repeated ? 0.5 : 0)));
    const scores = {
      baselineGapTransfer,
      targetRoleJob,
      resumeProjectRelevance,
      productionEvidenceCoverage,
      plannedCoverage,
      novelty,
      total:
        baselineGapTransfer +
        targetRoleJob +
        resumeProjectRelevance +
        productionEvidenceCoverage +
        plannedCoverage +
        novelty
    };
    return {
      incidentKey: candidate.key,
      incidentVersion: candidate.version,
      title: candidate.title,
      difficulty,
      emphasizedSignalKeys: prioritizedSignals(candidate, focus),
      scores
    };
  }

  private scoreAdaptive(
    candidate: AppliedEngineeringIncidentRankingCandidate,
    focus: AppliedEngineeringConfirmedFocus,
    evidence: AppliedEngineeringAdaptiveEvidence,
    weaknessSignals: AppliedEngineeringProductionSignal[],
    difficulty: AppliedEngineeringAdaptiveRankedIncident["difficulty"]
  ): AppliedEngineeringAdaptiveRankedIncident {
    const candidateSignals = new Set<string>(candidate.productionSignalKeys);
    const assessmentAverage = average(Object.values(evidence.assessmentScores));
    const assessmentWeakness = Math.round(
      30 *
        ((100 - assessmentAverage) / 100) *
        (0.5 + 0.5 * hitRatio(candidateSignals, weaknessSignals))
    );
    const practiceWeakness = Math.round(
      25 * hitRatio(candidateSignals, evidence.practice.weakSignalKeys)
    );
    const targetText = `${focus.targetJob} ${focus.targetCompany ?? ""}`.toLowerCase();
    const targetMatches = candidate.targetKeywords.filter((keyword) =>
      targetText.includes(keyword.toLowerCase())
    ).length;
    const targetRoleJob = Math.min(15, 9 + targetMatches * 3);
    const productionEvidenceCoverage = Math.round(15 * hitRatio(candidateSignals, weaknessSignals));
    const priorTopics = new Set(evidence.priorTopicKeys);
    const newTopicRatio =
      candidate.topicKeys.filter((key) => !priorTopics.has(key)).length /
      candidate.topicKeys.length;
    const plannedCoverage = Math.round(10 * newTopicRatio);
    const novelty = evidence.priorIncidentKeys.includes(candidate.key) ? 0 : 5;
    const scores = {
      assessmentWeakness,
      practiceWeakness,
      targetRoleJob,
      productionEvidenceCoverage,
      plannedCoverage,
      novelty,
      total:
        assessmentWeakness +
        practiceWeakness +
        targetRoleJob +
        productionEvidenceCoverage +
        plannedCoverage +
        novelty
    };
    const emphasizedSignalKeys = [
      ...candidate.productionSignalKeys.filter((key) => weaknessSignals.includes(key)),
      ...candidate.productionSignalKeys
    ]
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 4);
    return {
      incidentKey: candidate.key,
      incidentVersion: candidate.version,
      title: candidate.title,
      difficulty,
      emphasizedSignalKeys,
      scores
    };
  }
}

function difficultyFor(
  focus: AppliedEngineeringConfirmedFocus
): AppliedEngineeringRankedIncident["difficulty"] {
  if (focus.baselineEvidence.state === "STRETCH") return "stretch";
  if (focus.baselineEvidence.state === "STANDARD") return "standard";
  return "guided";
}

function adaptiveDifficulty(
  evidence: AppliedEngineeringAdaptiveEvidence
): AppliedEngineeringAdaptiveRankedIncident["difficulty"] {
  const score = average(Object.values(evidence.assessmentScores));
  if (score >= 82 && evidence.practice.learnedCount === 0) return "stretch";
  if (score < 55 || evidence.practice.learnedCount >= 3) return "guided";
  return "standard";
}

function availableDifficulty(
  candidate: AppliedEngineeringIncidentRankingCandidate,
  requested: AppliedEngineeringRankedIncident["difficulty"]
): AppliedEngineeringRankedIncident["difficulty"] {
  if (candidate.difficulties.includes(requested)) return requested;
  const rank = { guided: 0, standard: 1, stretch: 2 } as const;
  return [...candidate.difficulties].sort(
    (left, right) =>
      Math.abs(rank[left] - rank[requested]) - Math.abs(rank[right] - rank[requested])
  )[0]!;
}

function adaptiveWeaknessSignals(
  evidence: AppliedEngineeringAdaptiveEvidence
): AppliedEngineeringProductionSignal[] {
  const dimension = Object.entries(evidence.assessmentScores).sort(
    (left, right) => left[1] - right[1]
  )[0]?.[0];
  const byDimension: Record<string, AppliedEngineeringProductionSignal[]> = {
    diagnosisEvidence: ["evidence-selection", "root-cause-reasoning"],
    implementationCorrectness: ["data-integrity", "concurrency-control", "bounded-work"],
    testingVerification: ["testing-verification"],
    productionJudgment: ["retry-safety", "failure-isolation", "caching", "security"],
    ownershipDelivery: ["customer-impact", "observability", "rollout-safety", "rollback-readiness"]
  };
  return [...(byDimension[dimension ?? ""] ?? []), ...evidence.practice.weakSignalKeys].filter(
    (value, index, values) => values.indexOf(value) === index
  );
}

function prioritizedSignals(
  candidate: AppliedEngineeringIncidentRankingCandidate,
  focus: AppliedEngineeringConfirmedFocus
): AppliedEngineeringProductionSignal[] {
  return [
    ...focus.baselineEvidence.weakSignalKeys,
    ...focus.baselineEvidence.unassessedSignalKeys,
    ...candidate.productionSignalKeys
  ]
    .filter((key) => candidate.productionSignalKeys.includes(key))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 4);
}

function firstSelectionReason(
  incident: AppliedEngineeringRankedIncident,
  focus: AppliedEngineeringConfirmedFocus
): string {
  const emphasized =
    incident.emphasizedSignalKeys[0]?.replaceAll("-", " ") ?? "production reasoning";
  const baseline =
    focus.baselineEvidence.state === "UNKNOWN"
      ? "your onboarding evidence is incomplete"
      : focus.baselineEvidence.weakSignalKeys.includes(incident.emphasizedSignalKeys[0]!)
        ? `your onboarding evidence showed a gap in ${emphasized}`
        : `your onboarding evidence has not yet assessed ${emphasized}`;
  return `We chose ${incident.title} because ${baseline}, and it directly supports your ${focus.targetJob} target.`;
}

function foundationFit(signals: readonly AppliedEngineeringProductionSignal[]): number {
  return signals.filter((signal) => FOUNDATION_SIGNALS.has(signal)).length / signals.length;
}

function hitRatio(candidateSignals: Set<string>, targets: readonly string[]): number {
  const unique = [...new Set(targets)];
  if (unique.length === 0) return 0;
  return unique.filter((key) => candidateSignals.has(key)).length / unique.length;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function bounded(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
