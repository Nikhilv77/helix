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
    const [candidateProfile, profile, performanceProfile, practiceEvidence, existing] =
      await Promise.all([
        this.store.ensureCandidateProfile(ownerId, now),
        this.profiles.get(ownerId),
        this.performanceProfiles?.refresh(ownerId, now) ?? Promise.resolve(null),
        this.practiceEvidence?.refresh(ownerId, now) ?? Promise.resolve(null),
        this.store.getActivePlan(ownerId)
      ]);
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
