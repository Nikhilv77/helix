import type {
  CandidateInterviewProfile,
  PersonalizedInterviewPlan,
  RoleFamily,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import type { CandidatePerformanceProfile } from "@/lib/interviews/performance-profile";
import type { CandidatePracticeEvidence } from "@/lib/practice/practice-evidence";
import type { CandidateProfile, Role } from "@/lib/shared/types";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import type { ProfileService } from "../profile/profile.service";
import type { PersonalizedInterviewPlanGenerator } from "./personalized-plan-generator";
import type { PersonalizedPerformanceStore } from "./personalized-performance-store";
import type { PracticeEvidenceStore } from "../practice/practice-evidence-store";
import type { PersonalizedPlanningStore } from "./personalized-planning-store";
import type { TargetRoleRelevanceContext } from "./relevance-engine";

type PlanningStore = Pick<
  PersonalizedPlanningStore,
  "ensureCandidateProfile" | "getActivePlan" | "saveReadyPlan"
>;
type PlanGenerator = Pick<PersonalizedInterviewPlanGenerator, "generate">;
type ProfileReader = Pick<ProfileService, "get">;
type PerformanceReader = Pick<PersonalizedPerformanceStore, "refresh">;
type PracticeEvidenceReader = Pick<PracticeEvidenceStore, "refresh">;

export interface PersonalizedBlueprintSelection {
  plan: PersonalizedInterviewPlan;
  blueprint: SessionBlueprint;
}

/**
 * Application boundary for the personalized roadmap. It is the only layer
 * that decides whether an existing plan can be reused or a new immutable
 * revision must be generated and published.
 */
export class PersonalizedInterviewPlanningService {
  constructor(
    private readonly store: PlanningStore,
    private readonly generator: PlanGenerator,
    private readonly profiles: ProfileReader,
    private readonly performanceProfiles?: PerformanceReader,
    private readonly practiceEvidence?: PracticeEvidenceReader
  ) {}

  async activePlan(ownerId: string, now = Date.now()): Promise<PersonalizedInterviewPlan> {
    const [candidateProfile, profile, observedPerformanceProfile, practiceEvidence, existing] =
      await Promise.all([
        this.store.ensureCandidateProfile(ownerId, now),
        this.profiles.get(ownerId),
        this.performanceProfiles?.refresh(ownerId, now) ?? Promise.resolve(null),
        this.practiceEvidence?.refresh(ownerId, now) ?? Promise.resolve(null),
        this.store.getActivePlan(ownerId)
      ]);
    const performanceProfile =
      observedPerformanceProfile ?? baselinePerformanceProfile(profile, candidateProfile);
    const targetRole =
      !profile.targetRole && existing
        ? existing.sourceSnapshot.targetRole
        : targetRoleContext(profile, candidateProfile);
    if (
      existing &&
      (matchesCurrentInputs(
        existing,
        candidateProfile,
        targetRole,
        performanceProfile,
        practiceEvidence
      ) ||
        matchesInputsExceptResume(existing, targetRole, performanceProfile, practiceEvidence))
    ) {
      return existing;
    }

    const generated = this.generator.generate({
      profile: candidateProfile,
      targetRole,
      performance: performanceProfile
        ? {
            snapshot: {
              id: performanceProfile.id,
              revision: performanceProfile.revision
            },
            skills: performanceProfile.skills
          }
        : null,
      practiceEvidence: practiceEvidence
        ? {
            snapshot: {
              id: practiceEvidence.id,
              revision: practiceEvidence.revision
            },
            skills: practiceEvidence.skills
          }
        : null,
      generatedAt: now
    }).plan;

    try {
      return await this.store.saveReadyPlan(ownerId, generated);
    } catch (error) {
      // Concurrent first loads may both generate. The store's unique READY
      // constraint picks a winner; reuse it if it represents these inputs.
      const winner = await this.store.getActivePlan(ownerId).catch(() => null);
      if (
        winner &&
        matchesCurrentInputs(
          winner,
          candidateProfile,
          targetRole,
          performanceProfile,
          practiceEvidence
        )
      ) {
        return winner;
      }
      throw error;
    }
  }

  async blueprint(
    ownerId: string,
    blueprintId: string,
    expectedPlanId?: string | null,
    now = Date.now()
  ): Promise<PersonalizedBlueprintSelection> {
    const plan = await this.activePlan(ownerId, now);
    if (expectedPlanId && plan.id !== expectedPlanId) {
      throw new ConflictErrorException(
        "PERSONALIZED_PLAN_CHANGED",
        "Your interview plan changed. Choose the session again from the latest roadmap.",
        { expectedPlanId, activePlanId: plan.id }
      );
    }

    const blueprint = plan.sessions.find((session) => session.id === blueprintId);
    if (!blueprint) {
      throw new NotFoundErrorException(
        "INTERVIEW_BLUEPRINT_NOT_FOUND",
        "This interview session is not part of your active plan.",
        { blueprintId, planId: plan.id }
      );
    }

    return { plan, blueprint };
  }
}

/**
 * A baseline is intentionally sparse and low-confidence, but it is still real
 * evidence. Until completed interviews exist, let it steer the first plan.
 */
function baselinePerformanceProfile(
  profile: CandidateProfile,
  candidate: CandidateInterviewProfile
): CandidatePerformanceProfile | null {
  // Older test fixtures and profiles predate this checkpoint. They simply
  // have no baseline evidence rather than blocking plan reads.
  const onboarding = profile.preparationOnboarding;
  const baseline = onboarding?.skillProfile;
  const completedAt = onboarding?.completedAt;
  if (!baseline || !completedAt) return null;

  const firstSkill = candidate.skills[0]?.key ?? "role-fundamentals";
  const projectSkill = candidate.importantProjects[0]?.skillKeys[0] ?? firstSkill;
  const skillKeyByArea = {
    dsa: "problem-solving",
    "core-technical": firstSkill,
    "applied-engineering": projectSkill,
    "architecture-design": projectSkill
  } as const;
  const aggregate = new Map<string, { totalScore: number; totalConfidence: number; count: number }>();
  for (const signal of baseline.signals) {
    if (signal.evidence !== "baseline") continue;
    const score = baselinePlanningScore(signal.topics);
    if (score === null) continue;
    const skillKey = skillKeyByArea[signal.areaId];
    const existing = aggregate.get(skillKey) ?? { totalScore: 0, totalConfidence: 0, count: 0 };
    aggregate.set(skillKey, {
      totalScore: existing.totalScore + score,
      totalConfidence: existing.totalConfidence + signal.confidence,
      count: existing.count + 1
    });
  }
  const skills = [...aggregate.entries()].map(([skillKey, value]) => ({
    skillKey,
    // This is an internal ordering hint only. It is never stored as or shown
    // as a readiness score; real attempts replace it on the next plan build.
    score: Math.round(value.totalScore / value.count),
    confidence: Math.min(0.4, value.totalConfidence / value.count),
    sampleSize: 1,
    lastObservedAt: baseline.generatedAt
  }));
  if (!skills.length) return null;

  const id = `baseline-${completedAt}`;
  return {
    schemaVersion: 3,
    id,
    revision: 1,
    sourceSessionFingerprint: id,
    generatedAt: baseline.generatedAt,
    completedSessionCount: 1,
    answeredQuestionCount: skills.length,
    sourceSessionIds: [id],
    skills: skills.map((skill) => ({
      ...skill,
      trend: null,
      topicKeys: [skill.skillKey],
      rubricPerformance: []
    }))
  };
}

/** Converts qualitative baseline familiarity into a deliberately narrow plan-ordering hint. */
function baselinePlanningScore(
  topics: Array<{ label: string; familiarity: "familiar" | "needs-refresh" | "unknown" }> | undefined
): number | null {
  const observed = topics?.filter((topic) => topic.familiarity !== "unknown") ?? [];
  if (!observed.length) return null;
  const total = observed.reduce(
    (sum, topic) => sum + (topic.familiarity === "familiar" ? 60 : 40),
    0
  );
  return total / observed.length;
}

function matchesInputsExceptResume(
  plan: PersonalizedInterviewPlan,
  targetRole: TargetRoleRelevanceContext,
  performanceProfile: CandidatePerformanceProfile | null,
  practiceEvidence: CandidatePracticeEvidence | null
): boolean {
  const source = plan.sourceSnapshot;
  return (
    source.targetRole.title === targetRole.title &&
    source.targetRole.family === targetRole.family &&
    source.targetRole.source === targetRole.source &&
    source.jobDescription === null &&
    matchesPerformanceSnapshot(source.performanceProfile, performanceProfile) &&
    matchesPracticeSnapshot(source.practiceEvidence, practiceEvidence)
  );
}

export function targetRoleContext(
  profile: Pick<CandidateProfile, "targetRole">,
  candidateProfile: CandidateInterviewProfile
): TargetRoleRelevanceContext {
  if (!profile.targetRole) {
    return {
      title: candidateProfile.inferredRole.title,
      family: candidateProfile.inferredRole.family,
      source: "inferred",
      confidence: candidateProfile.inferredRole.confidence
    };
  }

  return {
    title: TARGET_ROLE_TITLES[profile.targetRole],
    family: roleFamily(profile.targetRole),
    source: "declared",
    confidence: 1
  };
}

const TARGET_ROLE_TITLES: Record<Role, string> = {
  backend: "Backend Engineer",
  frontend: "Frontend Engineer",
  fullstack: "Full Stack Engineer",
  data: "Data Engineer",
  "ai-ml": "AI Engineer",
  pm: "Product Manager"
};

function roleFamily(role: Role): RoleFamily {
  return role === "pm" ? "product" : role;
}

function matchesCurrentInputs(
  plan: PersonalizedInterviewPlan,
  profile: CandidateInterviewProfile,
  targetRole: TargetRoleRelevanceContext,
  performanceProfile: CandidatePerformanceProfile | null,
  practiceEvidence: CandidatePracticeEvidence | null
): boolean {
  const source = plan.sourceSnapshot;
  return (
    source.candidateProfile.id === profile.id &&
    source.candidateProfile.revision === profile.revision &&
    source.candidateProfile.sourceResumeFingerprint === profile.sourceResumeFingerprint &&
    source.targetRole.title === targetRole.title &&
    source.targetRole.family === targetRole.family &&
    source.targetRole.source === targetRole.source &&
    source.jobDescription === null &&
    matchesPerformanceSnapshot(source.performanceProfile, performanceProfile) &&
    matchesPracticeSnapshot(source.practiceEvidence, practiceEvidence)
  );
}

function matchesPracticeSnapshot(
  snapshot: PersonalizedInterviewPlan["sourceSnapshot"]["practiceEvidence"],
  evidence: CandidatePracticeEvidence | null
): boolean {
  if (!snapshot || !evidence) return !snapshot && evidence === null;
  return snapshot.id === evidence.id && snapshot.revision === evidence.revision;
}

function matchesPerformanceSnapshot(
  snapshot: PersonalizedInterviewPlan["sourceSnapshot"]["performanceProfile"],
  profile: CandidatePerformanceProfile | null
): boolean {
  if (!snapshot || !profile) return snapshot === null && profile === null;
  return snapshot.id === profile.id && snapshot.revision === profile.revision;
}
