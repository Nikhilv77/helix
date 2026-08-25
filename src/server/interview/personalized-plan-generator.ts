import { randomUUID } from "node:crypto";
import type {
  BlueprintDifficulty,
  BlueprintRubricDimension,
  BlueprintStage,
  BlueprintTopic,
  CandidateInterviewProfile,
  InterviewPlanSourceSnapshot,
  InterviewSessionKind,
  PersonalizedInterviewPlan,
  RoleFamily,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import {
  INTERVIEW_SESSION_KINDS,
  PERSONALIZED_INTERVIEW_PLAN_SCHEMA_VERSION,
  parsePersonalizedInterviewPlan
} from "@/lib/interviews/personalized-plan";
import {
  BEHAVIORAL_SKILL_PREFIX,
  DSA_PATTERN_SKILL_PREFIX,
  PROBLEM_SOLVING_SKILL_KEY
} from "@/lib/interviews/performance-profile";
import type {
  DemonstratedSkillPerformance,
  JobDescriptionRelevanceContext,
  RankedDomainRelevance,
  RankedSkillRelevance,
  RelevanceEngineResult,
  TargetRoleRelevanceContext
} from "./relevance-engine";
import { rankCandidateInterviewRelevance } from "./relevance-engine";

type JobDescriptionSnapshot = NonNullable<InterviewPlanSourceSnapshot["jobDescription"]>;
type PerformanceProfileSnapshot = NonNullable<InterviewPlanSourceSnapshot["performanceProfile"]>;

export interface PersonalizedPlanJobDescriptionInput {
  relevance: JobDescriptionRelevanceContext;
  snapshot: JobDescriptionSnapshot;
}

export interface PersonalizedPlanPerformanceInput {
  skills: DemonstratedSkillPerformance[];
  snapshot: PerformanceProfileSnapshot;
}

export interface GeneratePersonalizedInterviewPlanInput {
  profile: CandidateInterviewProfile;
  targetRole: TargetRoleRelevanceContext;
  jobDescription?: PersonalizedPlanJobDescriptionInput | null;
  performance?: PersonalizedPlanPerformanceInput | null;
  generatedAt?: number;
  /** Injectable so tests and replay jobs can produce deterministic identities. */
  idFactory?: () => string;
}

export interface PersonalizedInterviewPlanGeneration {
  plan: PersonalizedInterviewPlan;
  /** The exact ranking used to allocate topics, useful for audit and previews. */
  relevance: RelevanceEngineResult;
}

interface GenerationContext {
  relevance: RelevanceEngineResult;
  targetRole: TargetRoleRelevanceContext;
  roleLabel: string;
  language: RankedSkillRelevance | null;
  frontendSkills: RankedSkillRelevance[];
  backendSkills: RankedSkillRelevance[];
  coreSkills: RankedSkillRelevance[];
  primaryDomain: RankedDomainRelevance | null;
  importantProject: CandidateInterviewProfile["importantProjects"][number] | null;
  performanceSkills: DemonstratedSkillPerformance[];
}

interface TopicSeed {
  key: string;
  label: string;
  skillKeys: string[];
  score: number;
  objectives: string[];
}

const ROLE_LABELS: Record<RoleFamily, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full Stack",
  mobile: "Mobile",
  data: "Data",
  "ai-ml": "AI",
  "devops-platform": "Platform",
  security: "Security",
  qa: "Quality Engineering",
  product: "Product",
  other: "Software Engineering"
};

const PRIMARY_DOMAIN_BY_ROLE: Partial<Record<RoleFamily, string>> = {
  frontend: "frontend-engineering",
  backend: "backend-engineering",
  fullstack: "frontend-engineering",
  mobile: "mobile-engineering",
  data: "data-engineering",
  "ai-ml": "applied-ai",
  "devops-platform": "cloud-platform"
};

const BACKEND_FRAMEWORK_LANGUAGE: Record<string, string[]> = {
  "spring-boot": ["java", "kotlin"],
  laravel: ["php"],
  django: ["python"],
  fastapi: ["python"],
  flask: ["python"],
  dotnet: ["c-sharp"],
  "aspnet-core": ["c-sharp"],
  "ruby-on-rails": ["ruby"],
  nodejs: ["typescript", "javascript"],
  express: ["typescript", "javascript"]
};

const SHORT_LABELS: Record<string, string> = {
  llm: "LLM",
  rag: "RAG",
  "machine-learning": "ML",
  "vector-databases": "Vector Databases",
  "c-sharp": "C#",
  "c-plus-plus": "C++"
};

/**
 * Builds a validated five-session roadmap without generating interview
 * questions. The later interviewer may adapt follow-ups, but every question
 * must stay inside the topics and policy established here.
 */
export class PersonalizedInterviewPlanGenerator {
  generate(input: GeneratePersonalizedInterviewPlanInput): PersonalizedInterviewPlanGeneration {
    const generatedAt = input.generatedAt ?? Date.now();
    const idFactory = input.idFactory ?? randomUUID;
    const relevance = rankCandidateInterviewRelevance({
      profile: input.profile,
      targetRole: input.targetRole,
      jobDescription: input.jobDescription?.relevance ?? null,
      performance: input.performance?.skills ?? [],
      now: generatedAt
    });
    const context = generationContext(relevance, input.targetRole, input.performance?.skills ?? []);
    const sessions = INTERVIEW_SESSION_KINDS.map((kind, index) =>
      buildSession(kind, index + 1, idFactory(), context)
    );

    const plan = parsePersonalizedInterviewPlan({
      schemaVersion: PERSONALIZED_INTERVIEW_PLAN_SCHEMA_VERSION,
      id: idFactory(),
      revision: 1,
      status: "draft",
      generatedAt,
      sourceSnapshot: {
        candidateProfile: {
          id: input.profile.id,
          revision: input.profile.revision,
          sourceResumeFingerprint: input.profile.sourceResumeFingerprint
        },
        targetRole: {
          title: input.targetRole.title,
          family: input.targetRole.family,
          source: input.targetRole.source
        },
        jobDescription: input.jobDescription?.snapshot ?? null,
        performanceProfile: input.performance?.snapshot ?? null
      },
      rationale: planRationale(context, input),
      sessions
    });

    return { plan, relevance };
  }
}

function generationContext(
  relevance: RelevanceEngineResult,
  targetRole: TargetRoleRelevanceContext,
  performanceSkills: DemonstratedSkillPerformance[]
): GenerationContext {
  const rankedSkills = relevance.rankedSkills;
  const skillsForDomain = (key: string) => {
    const skillKeys = new Set(
      relevance.profile.domains.find((domain) => domain.key === key)?.skillKeys ?? []
    );
    return rankedSkills.filter((skill) => skillKeys.has(skill.key));
  };
  const frontendSkills = skillsForDomain("frontend-engineering");
  const backendDomainSkills = skillsForDomain("backend-engineering");
  const backendFramework = backendDomainSkills.find((skill) => skill.category === "framework");
  const backendLanguage = backendFramework
    ? rankedSkills.find((skill) =>
        (BACKEND_FRAMEWORK_LANGUAGE[backendFramework.key] ?? []).includes(skill.key)
      )
    : null;
  const backendSkills = uniqueSkills([
    ...(backendLanguage ? [backendLanguage] : []),
    ...backendDomainSkills,
    ...rankedSkills.filter((skill) =>
      ["database", "architecture", "infrastructure"].includes(skill.category)
    )
  ]);
  const coreSkills = coreSkillSelection(
    targetRole.family,
    rankedSkills,
    frontendSkills,
    backendSkills
  );
  const preferredDomainKey = PRIMARY_DOMAIN_BY_ROLE[targetRole.family];
  const primaryDomain =
    relevance.rankedDomains.find((domain) => domain.key === preferredDomainKey) ??
    relevance.rankedDomains[0] ??
    null;

  return {
    relevance,
    targetRole,
    roleLabel: ROLE_LABELS[targetRole.family],
    language: chooseInterviewLanguage(rankedSkills, backendLanguage ?? null),
    frontendSkills,
    backendSkills,
    coreSkills,
    primaryDomain,
    importantProject: relevance.profile.importantProjects[0] ?? null,
    performanceSkills
  };
}

function coreSkillSelection(
  family: RoleFamily,
  rankedSkills: RankedSkillRelevance[],
  frontendSkills: RankedSkillRelevance[],
  backendSkills: RankedSkillRelevance[]
): RankedSkillRelevance[] {
  if (family === "fullstack" && frontendSkills.length) {
    return preferFramework(frontendSkills).slice(0, 4);
  }
  if (family === "frontend" && frontendSkills.length) {
    return preferFramework(frontendSkills).slice(0, 4);
  }
  if (family === "backend" && backendSkills.length) return backendSkills.slice(0, 4);
  if (family === "ai-ml") {
    const aiSkills = rankedSkills.filter((skill) => skill.category === "ai-ml");
    return uniqueSkills([
      ...preferKeys(aiSkills, ["llm", "rag", "machine-learning"]),
      ...rankedSkills.filter((skill) => skill.category === "framework"),
      ...rankedSkills.filter((skill) => skill.category === "language")
    ]).slice(0, 4);
  }
  return rankedSkills.slice(0, 4);
}

function buildSession(
  kind: InterviewSessionKind,
  order: number,
  id: string,
  context: GenerationContext
): SessionBlueprint {
  const definition = sessionDefinition(kind, context);
  return {
    id,
    kind,
    order,
    title: definition.title,
    subtitle: definition.subtitle,
    durationMinutes: definition.durationMinutes,
    difficulty: kind === "final-mock" ? "adaptive" : difficultyFor(context, definition.skillKeys),
    rationale: definition.rationale,
    topics: weightedTopics(definition.topicSeeds, context),
    structure: sessionStructure(kind),
    followUpPolicy: {
      maxPerQuestion: kind === "final-mock" ? 3 : 2,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: sessionRubric(kind)
  };
}

function sessionDefinition(kind: InterviewSessionKind, context: GenerationContext) {
  if (kind === "problem-solving") return problemSolvingDefinition(context);
  if (kind === "core-technical") return coreTechnicalDefinition(context);
  if (kind === "applied-engineering") return appliedEngineeringDefinition(context);
  if (kind === "architecture-system-design") return architectureDefinition(context);
  return finalMockDefinition(context);
}

function problemSolvingDefinition(context: GenerationContext) {
  const language = context.language;
  const label = language ? displayLabel(language) : context.roleLabel;
  const topicSeeds: TopicSeed[] = language
    ? [
        skillTopic(language, [
          `Solve implementation problems clearly in ${displayLabel(language)}`,
          "Explain complexity, edge cases, and correctness"
        ]),
        {
          key: "algorithmic-reasoning",
          label: "Algorithmic Reasoning",
          skillKeys: [language.key],
          score: Math.max(35, language.coveragePriorityScore * 0.8),
          objectives: ["Choose suitable data structures and improve a straightforward solution"]
        }
      ]
    : [genericTopic("algorithmic-reasoning", "Algorithmic Reasoning")];

  return {
    title: `Problem Solving · ${label}`,
    subtitle: "Reasoning, correctness, and implementation under interview constraints",
    durationMinutes: 35,
    rationale: language
      ? `${displayLabel(language)} is the strongest relevant language for demonstrating problem-solving ability.`
      : "No interview language has enough evidence yet, so this session starts language-agnostic.",
    topicSeeds,
    skillKeys: language ? [language.key] : []
  };
}

function coreTechnicalDefinition(context: GenerationContext) {
  const selected = context.coreSkills.slice(0, 4);
  return {
    title: coreTechnicalTitle(context, selected),
    subtitle: "Mechanisms, trade-offs, and depth across the highest-priority technical evidence",
    durationMinutes: 35,
    rationale: selected.length
      ? `Deepens the highest-ranked target-role evidence: ${selected.map(displayLabel).join(", ")}.`
      : `Establishes the technical fundamentals expected of a ${context.targetRole.title}.`,
    topicSeeds: selected.length
      ? selected.map((skill) =>
          skillTopic(skill, [
            `Explain how ${displayLabel(skill)} behaves beyond surface-level usage`,
            `Defend implementation choices and trade-offs involving ${displayLabel(skill)}`
          ])
        )
      : [genericTopic("technical-foundations", `${context.roleLabel} Foundations`)],
    skillKeys: selected.map((skill) => skill.key)
  };
}

function appliedEngineeringDefinition(context: GenerationContext) {
  const selected = appliedSkillSelection(context).slice(0, 3);
  const topicSeeds = uniqueTopicSeeds([
    ...(context.primaryDomain
      ? [
          domainTopic(context.primaryDomain, context, [
            `Apply ${context.primaryDomain.label.toLowerCase()} judgement to a realistic delivery scenario`,
            "Diagnose failure modes and choose pragmatic trade-offs"
          ])
        ]
      : []),
    ...selected.map((skill) =>
      skillTopic(skill, [
        `Use ${displayLabel(skill)} in a production-oriented scenario`,
        "Consider testing, observability, failure handling, and maintainability"
      ])
    )
  ]);
  const project = context.importantProject;

  return {
    title: appliedEngineeringTitle(context, selected),
    subtitle: project
      ? `Production scenarios grounded in ${project.name}`
      : "Production scenarios grounded in the candidate's strongest technical evidence",
    durationMinutes: 40,
    rationale: project
      ? `Uses ${project.name} as an evidence anchor while testing production engineering judgement.`
      : `Tests whether ${context.roleLabel.toLowerCase()} knowledge transfers to realistic engineering constraints.`,
    topicSeeds: topicSeeds.length
      ? topicSeeds
      : [genericTopic("applied-engineering", `${context.roleLabel} Engineering`)],
    skillKeys: selected.map((skill) => skill.key)
  };
}

function architectureDefinition(context: GenerationContext) {
  const selected = architectureSkillSelection(context).slice(0, 3);
  const domainSelections = uniqueDomains([
    ...(context.primaryDomain ? [context.primaryDomain] : []),
    ...context.relevance.rankedDomains
  ]).slice(0, 2);
  const topicSeeds = uniqueTopicSeeds([
    ...domainSelections.map((domain) =>
      domainTopic(domain, context, [
        `Design boundaries, data flow, and failure handling for ${domain.label.toLowerCase()}`,
        "Reason about scale, reliability, security, and operational trade-offs"
      ])
    ),
    ...selected.map((skill) =>
      skillTopic(skill, [
        `Place ${displayLabel(skill)} deliberately within a larger system`,
        "Explain alternatives, bottlenecks, and failure modes"
      ])
    )
  ]);

  return {
    title: `${context.roleLabel} System Design`,
    subtitle: "Architecture decisions, constraints, scale, and failure modes",
    durationMinutes: 45,
    rationale: context.primaryDomain
      ? `Moves from component knowledge into system-level reasoning around ${context.primaryDomain.label}.`
      : `Tests architecture judgement appropriate for the ${context.targetRole.title} target.`,
    topicSeeds: topicSeeds.length
      ? topicSeeds
      : [genericTopic("system-design", `${context.roleLabel} System Design`)],
    skillKeys: selected.map((skill) => skill.key)
  };
}

function finalMockDefinition(context: GenerationContext) {
  const selected = context.relevance.rankedSkills.slice(0, 4);
  const dsaTopic = finalMockDsaTopic(context.performanceSkills);
  const behavioralTopic = finalMockBehavioralTopic(context.performanceSkills);
  const adaptiveEvidence = [dsaTopic ? "DSA" : null, behavioralTopic ? "behavioral" : null].filter(
    (value): value is string => Boolean(value)
  );
  const topicSeeds = uniqueTopicSeeds([
    ...(dsaTopic ? [dsaTopic] : []),
    ...(behavioralTopic ? [behavioralTopic] : []),
    ...(context.primaryDomain
      ? [
          domainTopic(context.primaryDomain, context, [
            "Connect technical depth, applied judgement, and system-level reasoning",
            "Respond to adaptive follow-ups without leaving the target role"
          ])
        ]
      : []),
    ...selected.map((skill) =>
      skillTopic(skill, [
        `Demonstrate interview-ready command of ${displayLabel(skill)}`,
        "Move from fundamentals to harder follow-ups when evidence is strong"
      ])
    )
  ]).slice(0, 4);

  return {
    title: finalMockTitle(context),
    subtitle: "A mixed, adaptive rehearsal across the complete personalized plan",
    durationMinutes: 50,
    rationale: selected.length
      ? adaptiveEvidence.length
        ? `Rehearses the strongest technical signals together with demonstrated ${adaptiveEvidence.join(" and ")} evidence: ${selected.map(displayLabel).join(", ")}.`
        : `Rehearses the strongest and highest-coverage signals together: ${selected.map(displayLabel).join(", ")}.`
      : `Runs an adaptive end-to-end rehearsal for the ${context.targetRole.title} target.`,
    topicSeeds: topicSeeds.length
      ? topicSeeds
      : [genericTopic("role-readiness", `${context.roleLabel} Readiness`)],
    skillKeys: selected.map((skill) => skill.key)
  };
}

function finalMockDsaTopic(performance: DemonstratedSkillPerformance[]): TopicSeed | null {
  const overall = performance.find((skill) => skill.skillKey === PROBLEM_SOLVING_SKILL_KEY);
  if (!overall) return null;
  const weakestPattern = performance
    .filter((skill) => skill.skillKey.startsWith(DSA_PATTERN_SKILL_PREFIX))
    .sort((left, right) => left.score - right.score || right.sampleSize - left.sampleSize)[0];
  const pattern = weakestPattern?.skillKey.slice(DSA_PATTERN_SKILL_PREFIX.length) ?? "algorithms";
  const label = titleCase(pattern);

  return {
    key: "adaptive-problem-solving",
    label: `Problem Solving · ${label}`,
    skillKeys: [PROBLEM_SOLVING_SKILL_KEY, ...(weakestPattern ? [weakestPattern.skillKey] : [])],
    score: adaptiveCoverageScore(overall.score),
    objectives:
      overall.score >= 82
        ? [
            `Solve a harder ${label.toLowerCase()} problem and defend the optimality of the approach`,
            "Explain correctness, complexity, and edge cases under follow-up pressure"
          ]
        : [
            `Strengthen the approach to a ${label.toLowerCase()} problem before implementation`,
            "Make complexity, correctness, and edge-case reasoning explicit"
          ]
  };
}

function finalMockBehavioralTopic(performance: DemonstratedSkillPerformance[]): TopicSeed | null {
  const weakest = performance
    .filter((skill) => skill.skillKey.startsWith(BEHAVIORAL_SKILL_PREFIX))
    .sort((left, right) => left.score - right.score || right.sampleSize - left.sampleSize)[0];
  if (!weakest) return null;
  const dimension = weakest.skillKey.slice(BEHAVIORAL_SKILL_PREFIX.length);
  const label = titleCase(dimension);

  return {
    key: `adaptive-behavioral-${dimension}`,
    label: `Behavioral · ${label}`,
    skillKeys: [weakest.skillKey],
    score: adaptiveCoverageScore(weakest.score),
    objectives: [
      behavioralObjective(dimension),
      "Deliver a concise evidence chain grounded in a real resume example"
    ]
  };
}

function adaptiveCoverageScore(score: number): number {
  if (score < 65) return 120 - score;
  if (score >= 82) return 38;
  return 58;
}

function behavioralObjective(dimension: string): string {
  if (dimension === "ownership") return "Make personal scope and contribution unmistakable";
  if (dimension === "decision") return "Explain the decision, rejected alternatives, and trade-off";
  if (dimension === "outcome") return "Connect the work to a measurable result or learning";
  return "Use concrete constraints, details, and evidence rather than general claims";
}

function titleCase(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function coreTechnicalTitle(context: GenerationContext, selected: RankedSkillRelevance[]): string {
  if (context.targetRole.family === "frontend" || context.targetRole.family === "fullstack") {
    const framework = context.frontendSkills.find((skill) => skill.category === "framework");
    return framework
      ? `${displayLabel(framework)} & Frontend Engineering`
      : "Frontend Engineering Deep Dive";
  }

  if (context.targetRole.family === "ai-ml") {
    const aiSkills = preferKeys(
      selected.filter((skill) => skill.category === "ai-ml"),
      ["llm", "rag", "machine-learning"]
    ).slice(0, 2);
    if (aiSkills.length >= 2) return `${aiSkills.map(displayLabel).join(" & ")} Engineering`;
    if (aiSkills[0]) return `${displayLabel(aiSkills[0])} Engineering Deep Dive`;
    return "AI & ML Engineering Deep Dive";
  }

  const pair = stackPair(selected);
  if (pair.length >= 2) return `${pair.map(displayLabel).join(" & ")} Deep Dive`;
  if (pair[0]) return `${displayLabel(pair[0])} Deep Dive`;
  return `${context.roleLabel} Technical Deep Dive`;
}

function appliedEngineeringTitle(
  context: GenerationContext,
  selected: RankedSkillRelevance[]
): string {
  if (context.targetRole.family === "fullstack") {
    const pair = stackPair(selected.length ? selected : context.backendSkills);
    if (pair.length >= 2) return pair.map(displayLabel).join(" & ");
    return "Full Stack Engineering";
  }

  const titles: Partial<Record<RoleFamily, string>> = {
    frontend: "Production Frontend Engineering",
    backend: "Backend Engineering",
    mobile: "Mobile Engineering",
    data: "Applied Data Engineering",
    "ai-ml": "Applied AI Engineering",
    "devops-platform": "Platform Engineering",
    security: "Applied Security Engineering",
    qa: "Production Quality Engineering",
    product: "Applied Product Thinking"
  };
  return titles[context.targetRole.family] ?? "Applied Software Engineering";
}

function finalMockTitle(context: GenerationContext): string {
  if (context.targetRole.family === "backend") {
    const framework = context.backendSkills.find((skill) => skill.category === "framework");
    return framework ? `${displayLabel(framework)} Backend Mock` : "Backend Engineer Mock";
  }
  const titles: Partial<Record<RoleFamily, string>> = {
    frontend: "Frontend Engineer Mock",
    fullstack: "Full Stack Mock",
    mobile: "Mobile Engineer Mock",
    data: "Data Engineer Mock",
    "ai-ml": "AI Engineer Mock",
    "devops-platform": "Platform Engineer Mock",
    security: "Security Engineer Mock",
    qa: "Quality Engineer Mock",
    product: "Product Manager Mock"
  };
  return titles[context.targetRole.family] ?? "Software Engineer Mock";
}

function appliedSkillSelection(context: GenerationContext): RankedSkillRelevance[] {
  if (context.targetRole.family === "fullstack" && context.backendSkills.length) {
    return context.backendSkills;
  }
  const projectKeys = new Set(context.importantProject?.skillKeys ?? []);
  return uniqueSkills([
    ...context.relevance.rankedSkills.filter((skill) => projectKeys.has(skill.key)),
    ...context.relevance.rankedSkills.filter((skill) =>
      ["database", "cloud", "infrastructure", "testing", "architecture"].includes(skill.category)
    ),
    ...context.relevance.rankedSkills
  ]);
}

function architectureSkillSelection(context: GenerationContext): RankedSkillRelevance[] {
  return uniqueSkills([
    ...context.relevance.rankedSkills.filter((skill) => skill.category === "architecture"),
    ...context.relevance.rankedSkills.filter((skill) =>
      ["database", "cloud", "infrastructure", "devops"].includes(skill.category)
    ),
    ...context.relevance.rankedSkills
  ]);
}

function chooseInterviewLanguage(
  rankedSkills: RankedSkillRelevance[],
  backendLanguage: RankedSkillRelevance | null
): RankedSkillRelevance | null {
  if (backendLanguage) return backendLanguage;
  return rankedSkills.find((skill) => skill.category === "language") ?? rankedSkills[0] ?? null;
}

function preferFramework(skills: RankedSkillRelevance[]): RankedSkillRelevance[] {
  return uniqueSkills([...skills.filter((skill) => skill.category === "framework"), ...skills]);
}

function preferKeys(skills: RankedSkillRelevance[], keys: string[]): RankedSkillRelevance[] {
  const preferred = keys.flatMap((key) => {
    const match = skills.find((skill) => skill.key === key);
    return match ? [match] : [];
  });
  return uniqueSkills([...preferred, ...skills]);
}

function stackPair(skills: RankedSkillRelevance[]): RankedSkillRelevance[] {
  const framework = skills.find((skill) => skill.category === "framework");
  const preferredLanguages = framework ? (BACKEND_FRAMEWORK_LANGUAGE[framework.key] ?? []) : [];
  const language =
    preferredLanguages
      .map((key) => skills.find((skill) => skill.key === key))
      .find((skill): skill is RankedSkillRelevance => Boolean(skill)) ??
    skills.find((skill) => skill.category === "language");
  return uniqueSkills([
    ...(language ? [language] : []),
    ...(framework ? [framework] : []),
    ...skills
  ]).slice(0, 2);
}

function skillTopic(skill: RankedSkillRelevance, objectives: string[]): TopicSeed {
  return {
    key: skill.key,
    label: displayLabel(skill),
    skillKeys: [skill.key],
    score: Math.max(1, skill.coveragePriorityScore),
    objectives
  };
}

function domainTopic(
  domain: RankedDomainRelevance,
  context: GenerationContext,
  objectives: string[]
): TopicSeed {
  const skillKeys =
    context.relevance.profile.domains.find((candidateDomain) => candidateDomain.key === domain.key)
      ?.skillKeys ?? [];
  return {
    key: domain.key,
    label: domain.label,
    skillKeys,
    score: Math.max(1, domain.coveragePriorityScore),
    objectives
  };
}

function genericTopic(key: string, label: string): TopicSeed {
  return {
    key,
    label,
    skillKeys: [],
    score: 100,
    objectives: [
      `Demonstrate ${label.toLowerCase()} at the expected role level`,
      "State assumptions, make a decision, and explain the trade-off"
    ]
  };
}

function weightedTopics(seeds: TopicSeed[], context: GenerationContext): BlueprintTopic[] {
  const values = uniqueTopicSeeds(seeds).slice(0, 4);
  const usable = values.length
    ? values
    : [genericTopic("role-fundamentals", `${context.roleLabel} Fundamentals`)];
  const weights = distributePercent(usable.map((seed) => seed.score));
  return usable.map((seed, index) => ({
    key: seed.key,
    label: seed.label,
    targetPercent: weights[index] ?? 1,
    skillKeys: [...new Set(seed.skillKeys)],
    objectives: seed.objectives
  }));
}

function distributePercent(scores: number[]): number[] {
  if (scores.length === 1) return [100];
  const minimum = 10;
  const available = 100 - scores.length * minimum;
  const safeScores = scores.map((score) => Math.max(0.001, score));
  const total = safeScores.reduce((sum, score) => sum + score, 0);
  const exact = safeScores.map((score) => minimum + (score / total) * available);
  const result = exact.map(Math.floor);
  let remaining = 100 - result.reduce((sum, weight) => sum + weight, 0);
  const fractionalOrder = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; remaining > 0; index += 1, remaining -= 1) {
    const target = fractionalOrder[index % fractionalOrder.length];
    if (target) result[target.index] = (result[target.index] ?? 0) + 1;
  }
  return result;
}

function difficultyFor(
  context: GenerationContext,
  selectedSkillKeys: string[]
): BlueprintDifficulty {
  const baseByExperience: Record<
    CandidateInterviewProfile["experience"]["band"],
    BlueprintDifficulty
  > = {
    fresher: "foundational",
    junior: "foundational",
    mid: "intermediate",
    senior: "advanced",
    "staff-plus": "advanced",
    unknown: "adaptive"
  };
  const base = baseByExperience[context.relevance.profile.experience.band];
  if (base === "adaptive") return base;

  const selected = context.relevance.rankedSkills.filter((skill) =>
    selectedSkillKeys.includes(skill.key)
  );
  const increases = selected.filter((skill) => skill.difficultyAdjustment === "increase").length;
  const decreases = selected.filter((skill) => skill.difficultyAdjustment === "decrease").length;
  if (increases > decreases) return increaseDifficulty(base);
  if (decreases > increases) return decreaseDifficulty(base);
  return base;
}

function increaseDifficulty(value: BlueprintDifficulty): BlueprintDifficulty {
  if (value === "foundational") return "intermediate";
  if (value === "intermediate") return "advanced";
  return value;
}

function decreaseDifficulty(value: BlueprintDifficulty): BlueprintDifficulty {
  if (value === "advanced") return "intermediate";
  if (value === "intermediate") return "foundational";
  return value;
}

function sessionStructure(kind: InterviewSessionKind): BlueprintStage[] {
  const structures: Record<InterviewSessionKind, BlueprintStage[]> = {
    "problem-solving": [
      stage("warm-up", 1, ["spoken"], "Clarify the problem and establish an initial approach."),
      stage(
        "core",
        3,
        ["code", "spoken"],
        "Implement and reason about progressively harder cases."
      ),
      stage(
        "scenario",
        2,
        ["spoken", "code"],
        "Test edge cases, complexity, and improvement choices."
      )
    ],
    "core-technical": [
      stage("warm-up", 1, ["spoken"], "Establish practical familiarity with the primary topic."),
      stage(
        "core",
        4,
        ["spoken", "typed"],
        "Probe mechanisms, constraints, and technical trade-offs."
      ),
      stage(
        "scenario",
        2,
        ["spoken"],
        "Apply the concepts to a realistic failure or design choice."
      )
    ],
    "applied-engineering": [
      stage("warm-up", 1, ["spoken"], "Anchor the discussion in a concrete delivery context."),
      stage("core", 2, ["spoken", "typed"], "Establish implementation depth and ownership."),
      stage(
        "scenario",
        3,
        ["spoken", "code"],
        "Work through production constraints and failure modes."
      ),
      stage("reflection", 1, ["spoken"], "Evaluate impact and what the candidate would change.")
    ],
    "architecture-system-design": [
      stage("warm-up", 1, ["spoken"], "Clarify requirements, assumptions, and success criteria."),
      stage(
        "design",
        3,
        ["diagram", "spoken"],
        "Design components, boundaries, storage, and data flow."
      ),
      stage(
        "scenario",
        2,
        ["spoken", "diagram"],
        "Stress the design with scale and failure scenarios."
      )
    ],
    "final-mock": [
      stage("warm-up", 1, ["spoken"], "Open with a focused role-relevant question."),
      stage(
        "mixed",
        4,
        ["spoken", "typed", "code"],
        "Mix technical depth and applied problem solving."
      ),
      stage("design", 2, ["diagram", "spoken"], "Test system-level reasoning and trade-offs."),
      stage("reflection", 1, ["spoken"], "Close on judgement, impact, and self-correction.")
    ]
  };
  return structures[kind];
}

function stage(
  kind: BlueprintStage["kind"],
  questionCount: number,
  formats: BlueprintStage["formats"],
  purpose: string
): BlueprintStage {
  return { kind, questionCount, formats, purpose };
}

function sessionRubric(kind: InterviewSessionKind): BlueprintRubricDimension[] {
  const rubrics: Record<InterviewSessionKind, BlueprintRubricDimension[]> = {
    "problem-solving": [
      rubric(
        "reasoning",
        "Problem-solving approach",
        40,
        "Builds a clear path from constraints to solution",
        "Starts coding without a coherent approach"
      ),
      rubric(
        "correctness",
        "Correctness & complexity",
        40,
        "Handles edge cases and states defensible complexity",
        "Misses correctness issues or cannot analyze complexity"
      ),
      rubric(
        "communication",
        "Communication",
        20,
        "Explains assumptions and decisions while working",
        "Leaves reasoning implicit or difficult to follow"
      )
    ],
    "core-technical": [
      rubric(
        "technical-depth",
        "Technical depth",
        50,
        "Explains mechanisms, limitations, and trade-offs",
        "Uses terminology without explaining behavior"
      ),
      rubric(
        "judgement",
        "Engineering judgement",
        30,
        "Chooses an approach that fits the stated constraints",
        "Presents one tool as universally correct"
      ),
      rubric(
        "communication",
        "Communication",
        20,
        "Structures answers and makes assumptions explicit",
        "Gives unstructured or ambiguous answers"
      )
    ],
    "applied-engineering": [
      rubric(
        "execution",
        "Applied execution",
        40,
        "Turns requirements into a workable implementation path",
        "Cannot connect concepts to implementation"
      ),
      rubric(
        "production-judgement",
        "Production judgement",
        35,
        "Anticipates failures, observability, and operational cost",
        "Focuses only on the happy path"
      ),
      rubric(
        "quality",
        "Quality & ownership",
        25,
        "Addresses testing, maintainability, and personal decisions",
        "Cannot defend quality or ownership boundaries"
      )
    ],
    "architecture-system-design": [
      rubric(
        "architecture",
        "Architecture",
        40,
        "Creates coherent boundaries and data flow",
        "Produces disconnected components without clear responsibilities"
      ),
      rubric(
        "trade-offs",
        "Trade-off analysis",
        35,
        "Compares alternatives against explicit constraints",
        "Makes choices without considering alternatives"
      ),
      rubric(
        "reliability",
        "Scale & reliability",
        25,
        "Identifies bottlenecks, failures, and recovery paths",
        "Assumes ideal conditions or unlimited scale"
      )
    ],
    "final-mock": [
      rubric(
        "technical-depth",
        "Technical depth",
        35,
        "Sustains accurate depth under follow-up questions",
        "Answers weaken when probed beyond terminology"
      ),
      rubric(
        "problem-solving",
        "Problem solving",
        25,
        "Adapts a structured approach as constraints change",
        "Loses structure when the scenario changes"
      ),
      rubric(
        "system-thinking",
        "System thinking",
        25,
        "Connects component decisions to system outcomes",
        "Treats decisions in isolation"
      ),
      rubric(
        "communication",
        "Communication",
        15,
        "Communicates concise assumptions and trade-offs",
        "Makes the interviewer reconstruct the reasoning"
      )
    ]
  };
  return rubrics[kind];
}

function rubric(
  key: string,
  label: string,
  weightPercent: number,
  strongSignal: string,
  weakSignal: string
): BlueprintRubricDimension {
  return {
    key,
    label,
    weightPercent,
    strongSignals: [strongSignal],
    weakSignals: [weakSignal]
  };
}

function planRationale(
  context: GenerationContext,
  input: GeneratePersonalizedInterviewPlanInput
): string {
  const skills = context.relevance.rankedSkills.slice(0, 4).map(displayLabel);
  const domain = context.primaryDomain?.label;
  const sourceSignals = [
    input.jobDescription ? "the target job description" : "the target role",
    "substantial resume evidence",
    input.performance ? "demonstrated interview performance" : null
  ].filter((value): value is string => Boolean(value));
  const focus = [...skills, ...(domain ? [domain] : [])];
  return `Built for ${context.targetRole.title} from ${sourceSignals.join(", ")}. ${
    focus.length
      ? `The five-session progression prioritizes ${focus.join(", ")}.`
      : "The five-session progression starts with role-level fundamentals because technical evidence is sparse."
  }`;
}

function displayLabel(skill: Pick<RankedSkillRelevance, "key" | "label">): string {
  return SHORT_LABELS[skill.key] ?? skill.label;
}

function uniqueSkills(skills: RankedSkillRelevance[]): RankedSkillRelevance[] {
  return uniqueBy(skills, (skill) => skill.key);
}

function uniqueDomains(domains: RankedDomainRelevance[]): RankedDomainRelevance[] {
  return uniqueBy(domains, (domain) => domain.key);
}

function uniqueTopicSeeds(seeds: TopicSeed[]): TopicSeed[] {
  return uniqueBy(seeds, (seed) => seed.key);
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFor(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
