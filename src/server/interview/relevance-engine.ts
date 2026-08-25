import type {
  CandidateDomain,
  CandidateInterviewProfile,
  CandidateSkill,
  RelevanceSignal,
  RoleFamily,
  SkillCategory,
  SkillRelevanceScore
} from "@/lib/interviews/personalized-plan";
import { parseCandidateInterviewProfile } from "@/lib/interviews/personalized-plan";

export const RELEVANCE_POLICY_VERSION = "relevance-v1" as const;

export interface WeightedRelevanceKey {
  /** Canonical skill/domain key from CandidateInterviewProfile. */
  key: string;
  importance: number;
  reason?: string;
}

export interface TargetRoleRelevanceContext {
  title: string;
  family: RoleFamily;
  source: "declared" | "inferred" | "job-description";
  confidence?: number;
  /** Explicit target technologies, when known. */
  skillPriorities?: WeightedRelevanceKey[];
  /** Explicit target domains, when known. */
  domainPriorities?: WeightedRelevanceKey[];
}

/**
 * A normalized JD contract for the future JD parser. The relevance engine can
 * consume it now without owning document extraction or storage.
 */
export interface JobDescriptionRelevanceContext {
  confidence: number;
  requiredSkills: WeightedRelevanceKey[];
  preferredSkills: WeightedRelevanceKey[];
  domainPriorities: WeightedRelevanceKey[];
}

export interface DemonstratedSkillPerformance {
  skillKey: string;
  /** Demonstrated proficiency, not interview relevance. */
  score: number;
  confidence: number;
  sampleSize: number;
  lastObservedAt: number;
}

export interface RelevanceEngineInput {
  profile: CandidateInterviewProfile;
  targetRole: TargetRoleRelevanceContext;
  jobDescription?: JobDescriptionRelevanceContext | null;
  performance?: DemonstratedSkillPerformance[];
  now?: number;
}

export type DifficultyAdjustment = "decrease" | "maintain" | "increase";

export interface RankedSkillRelevance {
  rank: number;
  key: string;
  label: string;
  category: SkillCategory;
  relevanceScore: number;
  /** Relevance plus weakness/strength adaptation for future coverage. */
  coveragePriorityScore: number;
  difficultyAdjustment: DifficultyAdjustment;
  adaptationReason: string | null;
  demonstratedScore: number | null;
}

export interface RankedDomainRelevance {
  rank: number;
  key: string;
  label: string;
  relevanceScore: number;
  coveragePriorityScore: number;
}

export interface RelevanceEngineResult {
  policyVersion: typeof RELEVANCE_POLICY_VERSION;
  profile: CandidateInterviewProfile;
  rankedSkills: RankedSkillRelevance[];
  rankedDomains: RankedDomainRelevance[];
}

interface RelevanceWeights {
  targetRole: number;
  jobDescription: number;
  workExperience: number;
  project: number;
  repeatedUse: number;
  recency: number;
  skillsMention: number;
}

interface StrengthResult {
  strength: number;
  reason: string;
}

const WITHOUT_JOB_DESCRIPTION: RelevanceWeights = {
  targetRole: 0.42,
  jobDescription: 0,
  workExperience: 0.28,
  project: 0.16,
  repeatedUse: 0.06,
  recency: 0.04,
  skillsMention: 0.04
};

const WITH_JOB_DESCRIPTION: RelevanceWeights = {
  targetRole: 0.28,
  jobDescription: 0.34,
  workExperience: 0.19,
  project: 0.1,
  repeatedUse: 0.04,
  recency: 0.025,
  skillsMention: 0.025
};

const ROLE_DOMAIN_AFFINITY: Record<RoleFamily, Record<string, number>> = {
  frontend: { "frontend-engineering": 1, "distributed-architecture": 0.15 },
  backend: {
    "backend-engineering": 1,
    "distributed-architecture": 0.72,
    "data-engineering": 0.5,
    "cloud-platform": 0.4
  },
  fullstack: {
    "frontend-engineering": 1,
    "backend-engineering": 1,
    "data-engineering": 0.42,
    "distributed-architecture": 0.4,
    "cloud-platform": 0.25
  },
  mobile: { "mobile-engineering": 1, "backend-engineering": 0.2 },
  data: {
    "data-engineering": 1,
    "distributed-architecture": 0.55,
    "cloud-platform": 0.4,
    "applied-ai": 0.25
  },
  "ai-ml": {
    "applied-ai": 1,
    "data-engineering": 0.65,
    "backend-engineering": 0.45,
    "cloud-platform": 0.3,
    "distributed-architecture": 0.25
  },
  "devops-platform": {
    "cloud-platform": 1,
    "distributed-architecture": 0.7,
    "backend-engineering": 0.3
  },
  security: {
    "cloud-platform": 0.55,
    "backend-engineering": 0.45,
    "distributed-architecture": 0.35
  },
  qa: { "frontend-engineering": 0.35, "backend-engineering": 0.3 },
  product: {},
  other: {}
};

const ROLE_CATEGORY_AFFINITY: Record<RoleFamily, Partial<Record<SkillCategory, number>>> = {
  frontend: { language: 0.35, framework: 0.25, testing: 0.35, architecture: 0.2 },
  backend: {
    language: 0.3,
    database: 0.42,
    infrastructure: 0.35,
    architecture: 0.48,
    testing: 0.2
  },
  fullstack: {
    language: 0.35,
    framework: 0.25,
    database: 0.32,
    architecture: 0.32,
    testing: 0.25
  },
  mobile: { language: 0.35, framework: 0.35, testing: 0.2 },
  data: { language: 0.3, database: 0.6, infrastructure: 0.3, architecture: 0.3 },
  "ai-ml": { "ai-ml": 0.8, language: 0.25, database: 0.3, framework: 0.2 },
  "devops-platform": { cloud: 0.8, infrastructure: 0.8, devops: 0.8, architecture: 0.35 },
  security: { cloud: 0.4, infrastructure: 0.45, architecture: 0.45, domain: 0.7 },
  qa: { testing: 0.9, language: 0.2, tool: 0.4 },
  product: { domain: 0.45, tool: 0.15 },
  other: { language: 0.15, framework: 0.1 }
};

export function rankCandidateInterviewRelevance(
  input: RelevanceEngineInput
): RelevanceEngineResult {
  const now = input.now ?? Date.now();
  const hasJobDescription = hasJobRequirements(input.jobDescription);
  const weights = hasJobDescription ? WITH_JOB_DESCRIPTION : WITHOUT_JOB_DESCRIPTION;
  const domainsBySkill = indexDomainsBySkill(input.profile.domains);
  const performanceBySkill = new Map(
    (input.performance ?? []).map((performance) => [
      canonicalKey(performance.skillKey),
      performance
    ])
  );

  const rescoredSkills = input.profile.skills.map((candidateSkill) =>
    rescoreSkill({
      candidateSkill,
      profile: input.profile,
      targetRole: input.targetRole,
      jobDescription: hasJobDescription ? (input.jobDescription ?? null) : null,
      weights,
      domainKeys: domainsBySkill.get(candidateSkill.key) ?? []
    })
  );
  const rescoredDomains = rescoreDomains(input.profile.domains, rescoredSkills);
  const profile = parseCandidateInterviewProfile({
    ...input.profile,
    skills: rescoredSkills,
    domains: rescoredDomains
  });

  const rankedSkills = rescoredSkills
    .map((candidateSkill) =>
      adaptSkill(candidateSkill, performanceBySkill.get(candidateSkill.key) ?? null, now)
    )
    .sort(
      (left, right) =>
        right.coveragePriorityScore - left.coveragePriorityScore ||
        right.relevanceScore - left.relevanceScore ||
        left.label.localeCompare(right.label)
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
  const coverageBySkill = new Map(
    rankedSkills.map((candidateSkill) => [candidateSkill.key, candidateSkill.coveragePriorityScore])
  );
  const rankedDomains = rescoredDomains
    .map((candidateDomain) => ({
      rank: 0,
      key: candidateDomain.key,
      label: candidateDomain.label,
      relevanceScore: candidateDomain.relevance.score,
      coveragePriorityScore: roundScore(
        average(
          candidateDomain.skillKeys.flatMap((key) => {
            const score = coverageBySkill.get(key);
            return score === undefined ? [] : [score];
          }),
          candidateDomain.relevance.score
        )
      )
    }))
    .sort(
      (left, right) =>
        right.coveragePriorityScore - left.coveragePriorityScore ||
        right.relevanceScore - left.relevanceScore ||
        left.label.localeCompare(right.label)
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    policyVersion: RELEVANCE_POLICY_VERSION,
    profile,
    rankedSkills,
    rankedDomains
  };
}

function rescoreSkill(input: {
  candidateSkill: CandidateSkill;
  profile: CandidateInterviewProfile;
  targetRole: TargetRoleRelevanceContext;
  jobDescription: JobDescriptionRelevanceContext | null;
  weights: RelevanceWeights;
  domainKeys: string[];
}): CandidateSkill {
  const { candidateSkill, targetRole, jobDescription, weights, domainKeys } = input;
  const signals: RelevanceSignal[] = [];
  const target = targetRoleStrength(candidateSkill, targetRole, domainKeys);
  if (target.strength > 0) {
    signals.push(
      relevanceSignal(
        "target-role",
        target.strength * clamp01(targetRole.confidence ?? 1),
        weights.targetRole,
        target.reason
      )
    );
  }

  if (jobDescription) {
    const job = jobDescriptionStrength(candidateSkill, jobDescription, domainKeys);
    if (job.strength > 0) {
      signals.push(
        relevanceSignal(
          "job-description",
          job.strength * clamp01(jobDescription.confidence),
          weights.jobDescription,
          job.reason
        )
      );
    }
  }

  const workEvidence = candidateSkill.evidence.filter(
    (evidence) => evidence.sourceKind === "work-experience"
  );
  if (workEvidence.length) {
    const durationMonths = workEvidence.reduce(
      (total, evidence) => total + (evidence.durationMonths ?? 0),
      0
    );
    const occurrences = workEvidence.reduce((total, evidence) => total + evidence.occurrences, 0);
    const strength = clamp01(
      0.5 +
        Math.min(3, workEvidence.length - 1) * 0.14 +
        Math.min(36, durationMonths) / 120 +
        Math.min(4, occurrences - workEvidence.length) * 0.035
    );
    signals.push(
      relevanceSignal(
        "work-experience",
        strength,
        weights.workExperience,
        `${workEvidence.length} professional experience source${workEvidence.length === 1 ? "" : "s"}.`
      )
    );
  }

  const projectEvidence = candidateSkill.evidence.filter(
    (evidence) => evidence.sourceKind === "project"
  );
  if (projectEvidence.length) {
    const projectImportance = projectEvidence.map((evidence) =>
      projectImportanceForSource(input.profile, evidence.sourceId)
    );
    const averageImportance = average(projectImportance, 0.55);
    const strength = clamp01(
      0.35 + averageImportance * 0.4 + Math.min(3, projectEvidence.length - 1) * 0.12
    );
    signals.push(
      relevanceSignal(
        "project",
        strength,
        weights.project,
        `${projectEvidence.length} named project source${projectEvidence.length === 1 ? "" : "s"}.`
      )
    );
  }

  const substantialSources = new Set(
    [...workEvidence, ...projectEvidence].map(
      (evidence) => `${evidence.sourceKind}:${evidence.sourceId ?? evidence.id}`
    )
  ).size;
  if (substantialSources > 1) {
    signals.push(
      relevanceSignal(
        "repeated-use",
        clamp01((substantialSources - 1) / 3),
        weights.repeatedUse,
        `Repeated across ${substantialSources} substantial resume sources.`
      )
    );
  }

  const recencies = workEvidence.flatMap((evidence) =>
    evidence.recencyMonths === null ? [] : [evidence.recencyMonths]
  );
  if (recencies.length) {
    const newestMonths = Math.min(...recencies);
    signals.push(
      relevanceSignal(
        "recency",
        clamp01(1 - newestMonths / 60),
        weights.recency,
        newestMonths === 0
          ? "Used in current professional work."
          : `Most recent professional evidence is ${newestMonths} month${newestMonths === 1 ? "" : "s"} old.`
      )
    );
  }

  if (candidateSkill.evidence.some((evidence) => evidence.sourceKind === "skills-section")) {
    signals.push(
      relevanceSignal(
        "skills-mention",
        1,
        weights.skillsMention,
        "Explicitly listed in the resume skills section."
      )
    );
  }

  if (!signals.length) {
    signals.push(
      relevanceSignal(
        "skills-mention",
        0.2,
        weights.skillsMention,
        "Present in the normalized candidate profile."
      )
    );
  }

  const evidenceConfidence = average(
    candidateSkill.evidence.map((evidence) => evidence.confidence),
    0.5
  );
  const contextualConfidence = average(
    [
      clamp01(targetRole.confidence ?? 1),
      ...(jobDescription ? [clamp01(jobDescription.confidence)] : [])
    ],
    1
  );
  const relevance: SkillRelevanceScore = {
    score: roundScore(signals.reduce((total, signal) => total + signal.contribution, 0)),
    confidence: roundUnit(clamp01(evidenceConfidence * 0.72 + contextualConfidence * 0.28)),
    signals,
    reasons: signals
      .slice()
      .sort((left, right) => right.contribution - left.contribution)
      .slice(0, 4)
      .map((signal) => signal.reason)
  };

  return {
    ...candidateSkill,
    aliases: [...candidateSkill.aliases],
    evidence: candidateSkill.evidence.map((evidence) => ({ ...evidence })),
    primary:
      relevance.score >= 35 &&
      candidateSkill.evidence.some(
        (evidence) =>
          evidence.sourceKind === "work-experience" ||
          evidence.sourceKind === "project" ||
          target.strength >= 0.9
      ),
    relevance
  };
}

function targetRoleStrength(
  candidateSkill: CandidateSkill,
  targetRole: TargetRoleRelevanceContext,
  domainKeys: string[]
): StrengthResult {
  const explicit = findWeightedKey(targetRole.skillPriorities ?? [], candidateSkill.key);
  if (explicit) {
    return {
      strength: explicit.importance,
      reason: explicit.reason || `${candidateSkill.label} is an explicit target-role priority.`
    };
  }

  if (targetTitleMentionsSkill(targetRole.title, candidateSkill)) {
    return {
      strength: 0.95,
      reason: `${candidateSkill.label} is named in the target role.`
    };
  }

  const explicitDomain = strongestDomainPriority(targetRole.domainPriorities ?? [], domainKeys);
  if (explicitDomain) {
    return {
      strength: explicitDomain.importance * 0.9,
      reason:
        explicitDomain.reason ||
        `${candidateSkill.label} supports an explicit target-role domain priority.`
    };
  }

  const familyDomains = ROLE_DOMAIN_AFFINITY[targetRole.family];
  const domainStrength = Math.max(0, ...domainKeys.map((key) => familyDomains[key] ?? 0));
  const categoryStrength = ROLE_CATEGORY_AFFINITY[targetRole.family][candidateSkill.category] ?? 0;
  const strength = Math.max(domainStrength, categoryStrength);
  return {
    strength,
    reason: `${candidateSkill.label} aligns with the ${targetRole.title} target.`
  };
}

function jobDescriptionStrength(
  candidateSkill: CandidateSkill,
  jobDescription: JobDescriptionRelevanceContext,
  domainKeys: string[]
): StrengthResult {
  const required = findWeightedKey(jobDescription.requiredSkills, candidateSkill.key);
  if (required) {
    return {
      strength: required.importance,
      reason: required.reason || `${candidateSkill.label} is required by the job description.`
    };
  }

  const preferred = findWeightedKey(jobDescription.preferredSkills, candidateSkill.key);
  if (preferred) {
    return {
      strength: preferred.importance * 0.72,
      reason: preferred.reason || `${candidateSkill.label} is preferred by the job description.`
    };
  }

  const domainPriority = strongestDomainPriority(jobDescription.domainPriorities, domainKeys);
  if (domainPriority) {
    return {
      strength: domainPriority.importance * 0.65,
      reason: domainPriority.reason || `${candidateSkill.label} supports a job-description domain.`
    };
  }

  return { strength: 0, reason: "" };
}

function adaptSkill(
  candidateSkill: CandidateSkill,
  performance: DemonstratedSkillPerformance | null,
  now: number
): Omit<RankedSkillRelevance, "rank"> {
  const base = candidateSkill.relevance.score;
  if (!performance || performance.sampleSize <= 0) {
    return {
      key: candidateSkill.key,
      label: candidateSkill.label,
      category: candidateSkill.category,
      relevanceScore: base,
      coveragePriorityScore: base,
      difficultyAdjustment: "maintain",
      adaptationReason: null,
      demonstratedScore: null
    };
  }

  const demonstratedScore = clampScore(performance.score);
  const ageMonths = Math.max(0, now - performance.lastObservedAt) / (30 * 24 * 60 * 60 * 1_000);
  const recencyFactor = Math.max(0.55, 1 - ageMonths / 24);
  const sampleFactor = Math.min(1, 0.55 + performance.sampleSize * 0.15);
  const confidence = clamp01(performance.confidence) * recencyFactor * sampleFactor;
  let coveragePriorityScore = base;
  let difficultyAdjustment: DifficultyAdjustment = "maintain";
  let adaptationReason: string;

  if (demonstratedScore < 65) {
    const weakness = (65 - demonstratedScore) / 65;
    const boost = 18 * weakness * confidence * (base / 100);
    coveragePriorityScore = roundScore(base + boost);
    difficultyAdjustment = demonstratedScore < 50 ? "decrease" : "maintain";
    adaptationReason = `${candidateSkill.label} is relevant but demonstrated performance is ${roundScore(demonstratedScore)}; increase coverage${difficultyAdjustment === "decrease" ? " and use a more foundational starting point" : ""}.`;
  } else if (demonstratedScore >= 82) {
    const strength = (demonstratedScore - 82) / 18;
    coveragePriorityScore = roundScore(base - 5 * strength * confidence);
    difficultyAdjustment = "increase";
    adaptationReason = `${candidateSkill.label} is already strong; use harder questions and slightly reduce repetitive coverage.`;
  } else {
    adaptationReason = `${candidateSkill.label} performance is developing at the expected level; keep current coverage and difficulty.`;
  }

  return {
    key: candidateSkill.key,
    label: candidateSkill.label,
    category: candidateSkill.category,
    relevanceScore: base,
    coveragePriorityScore,
    difficultyAdjustment,
    adaptationReason,
    demonstratedScore: roundScore(demonstratedScore)
  };
}

function rescoreDomains(domains: CandidateDomain[], skills: CandidateSkill[]): CandidateDomain[] {
  const skillsByKey = new Map(skills.map((candidateSkill) => [candidateSkill.key, candidateSkill]));
  return domains
    .map((candidateDomain) => {
      const matches = candidateDomain.skillKeys.flatMap((key) => {
        const candidateSkill = skillsByKey.get(key);
        return candidateSkill ? [candidateSkill] : [];
      });
      if (!matches.length) {
        return {
          ...candidateDomain,
          skillKeys: [...candidateDomain.skillKeys],
          evidenceIds: [...candidateDomain.evidenceIds]
        };
      }

      const sorted = matches
        .slice()
        .sort((left, right) => right.relevance.score - left.relevance.score)
        .slice(0, 4);
      return {
        ...candidateDomain,
        skillKeys: [...candidateDomain.skillKeys],
        evidenceIds: [...candidateDomain.evidenceIds],
        relevance: {
          score: roundScore(
            average(sorted.map((candidateSkill) => candidateSkill.relevance.score))
          ),
          confidence: roundUnit(
            average(sorted.map((candidateSkill) => candidateSkill.relevance.confidence))
          ),
          signals: sorted
            .flatMap((candidateSkill) => candidateSkill.relevance.signals)
            .slice(0, 16),
          reasons: [
            `Recalculated from ${sorted.map((candidateSkill) => candidateSkill.label).join(", ")}.`
          ]
        }
      };
    })
    .sort((left, right) => right.relevance.score - left.relevance.score);
}

function indexDomainsBySkill(domains: CandidateDomain[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const candidateDomain of domains) {
    for (const skillKey of candidateDomain.skillKeys) {
      result.set(skillKey, [...(result.get(skillKey) ?? []), candidateDomain.key]);
    }
  }
  return result;
}

function projectImportanceForSource(
  profile: CandidateInterviewProfile,
  sourceId: string | null
): number {
  if (!sourceId) return 0.55;
  return profile.importantProjects.find((project) => project.id === sourceId)?.importance ?? 0.55;
}

function findWeightedKey(
  values: WeightedRelevanceKey[],
  candidateKey: string
): WeightedRelevanceKey | null {
  return (
    values
      .filter((value) => canonicalKey(value.key) === candidateKey)
      .sort((left, right) => right.importance - left.importance)[0] ?? null
  );
}

function strongestDomainPriority(
  values: WeightedRelevanceKey[],
  domainKeys: string[]
): WeightedRelevanceKey | null {
  const candidates = new Set(domainKeys.map(canonicalKey));
  return (
    values
      .filter((value) => candidates.has(canonicalKey(value.key)))
      .sort((left, right) => right.importance - left.importance)[0] ?? null
  );
}

function targetTitleMentionsSkill(title: string, candidateSkill: CandidateSkill): boolean {
  const normalizedTitle = ` ${matchText(title)} `;
  return [candidateSkill.label, ...candidateSkill.aliases].some((value) => {
    const term = matchText(value);
    return term.length >= 3 && normalizedTitle.includes(` ${term} `);
  });
}

function relevanceSignal(
  kind: RelevanceSignal["kind"],
  strength: number,
  weight: number,
  reason: string
): RelevanceSignal {
  const normalizedStrength = roundUnit(clamp01(strength));
  return {
    kind,
    strength: normalizedStrength,
    weight,
    contribution: roundScore(normalizedStrength * weight * 100),
    reason
  };
}

function hasJobRequirements(
  value: JobDescriptionRelevanceContext | null | undefined
): value is JobDescriptionRelevanceContext {
  return Boolean(
    value &&
    (value.requiredSkills.length > 0 ||
      value.preferredSkills.length > 0 ||
      value.domainPriorities.length > 0)
  );
}

function canonicalKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function matchText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function average(values: number[], fallback = 0): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundUnit(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function roundScore(value: number): number {
  return Math.round(clampScore(value) * 10) / 10;
}
