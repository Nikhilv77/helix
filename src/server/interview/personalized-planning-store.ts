import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type {
  CandidateInterviewProfile,
  InterviewSessionKind,
  PersonalizedInterviewPlan,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import {
  CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION,
  parseCandidateInterviewProfile,
  parsePersonalizedInterviewPlan
} from "@/lib/interviews/personalized-plan";
import { BadRequestErrorException } from "../common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import type { PrismaService } from "../database/prisma.service";
import type { ProfileService } from "../profile/profile.service";
import { compileCandidateInterviewProfile } from "./candidate-profile-compiler";

type StoredPlan = Prisma.PersonalizedInterviewPlanVersionGetPayload<{
  include: { sessionBlueprints: true };
}>;

type ProfileReader = Pick<ProfileService, "get">;

const SESSION_KIND_TO_DATABASE = {
  "problem-solving": "PROBLEM_SOLVING",
  "core-technical": "CORE_TECHNICAL",
  "applied-engineering": "APPLIED_ENGINEERING",
  "architecture-system-design": "ARCHITECTURE_SYSTEM_DESIGN",
  "final-mock": "FINAL_MOCK"
} as const satisfies Record<InterviewSessionKind, StoredPlan["sessionBlueprints"][number]["kind"]>;

/**
 * Durable boundary for the dynamic planning pipeline.
 *
 * Profile and plan rows are immutable snapshots. Only plan status changes:
 * publishing a new READY revision atomically marks the old READY plan as
 * SUPERSEDED. Existing users are backfilled from CandidateProfile.resume on
 * their first call to ensureCandidateProfile.
 */
export class PersonalizedPlanningStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReader
  ) {}

  async ensureCandidateProfile(
    ownerId: string,
    now = Date.now()
  ): Promise<CandidateInterviewProfile> {
    return this.ensureCandidateProfileVersion(ownerId, now);
  }

  /**
   * Resolves the immutable resume profile without reconciling Interview plans.
   * Resume replacement and Resume Roast must use this side-effect-free path.
   */
  async ensureCandidateProfileVersion(
    ownerId: string,
    now = Date.now()
  ): Promise<CandidateInterviewProfile> {
    const source = await this.profiles.get(ownerId);
    if (!source.resume) {
      throw new BadRequestErrorException(
        "RESUME_REQUIRED",
        "Upload a resume before creating a personalized interview profile.",
        { ownerId }
      );
    }
    const resume = source.resume;

    // Compile once to obtain the content fingerprint. Its temporary identity
    // is discarded unless this resume needs a new immutable revision.
    const probe = compileCandidateInterviewProfile({
      resume,
      headline: source.headline,
      selectedRole: source.targetRole,
      selectedLevel: source.level,
      profileId: randomUUID(),
      revision: 1,
      generatedAt: now,
      sourceResumeFingerprint: resume.contentFingerprint ?? undefined
    });
    const existing = await this.prisma.candidateInterviewProfileVersion.findUnique({
      where: {
        ownerId_sourceResumeFingerprint_schemaVersion: {
          ownerId,
          sourceResumeFingerprint: probe.sourceResumeFingerprint,
          schemaVersion: CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION
        }
      }
    });

    if (existing) {
      return profileFromRecord(existing);
    }

    const stored = await this.prisma.$transaction(async (transaction) => {
      // Recheck inside the transaction so concurrent first visits converge on
      // the same fingerprint-backed row.
      const duplicate = await transaction.candidateInterviewProfileVersion.findUnique({
        where: {
          ownerId_sourceResumeFingerprint_schemaVersion: {
            ownerId,
            sourceResumeFingerprint: probe.sourceResumeFingerprint,
            schemaVersion: CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION
          }
        }
      });
      if (duplicate) return duplicate;

      const latest = await transaction.candidateInterviewProfileVersion.findFirst({
        where: { ownerId },
        orderBy: { revision: "desc" },
        select: { revision: true }
      });
      const profile = compileCandidateInterviewProfile({
        resume,
        headline: source.headline,
        selectedRole: source.targetRole,
        selectedLevel: source.level,
        profileId: randomUUID(),
        revision: (latest?.revision ?? 0) + 1,
        generatedAt: now,
        sourceResumeFingerprint: probe.sourceResumeFingerprint
      });

      return transaction.candidateInterviewProfileVersion.create({
        data: {
          id: profile.id,
          ownerId,
          revision: profile.revision,
          schemaVersion: profile.schemaVersion,
          sourceResumeFingerprint: profile.sourceResumeFingerprint,
          profile: toJson(profile),
          generatedAt: new Date(profile.generatedAt)
        }
      });
    });
    return profileFromRecord(stored);
  }

  async getLatestCandidateProfile(ownerId: string): Promise<CandidateInterviewProfile | null> {
    const stored = await this.prisma.candidateInterviewProfileVersion.findFirst({
      where: { ownerId },
      orderBy: { revision: "desc" }
    });
    return stored ? profileFromRecord(stored) : null;
  }

  async saveReadyPlan(
    ownerId: string,
    candidate: PersonalizedInterviewPlan
  ): Promise<PersonalizedInterviewPlan> {
    const parsed = parsePersonalizedInterviewPlan(candidate);
    requireUuid(parsed.id, "plan.id");
    parsed.sessions.forEach((session, index) =>
      requireUuid(session.id, `plan.sessions[${index}].id`)
    );

    const storedProfile = await this.prisma.candidateInterviewProfileVersion.findFirst({
      where: { id: parsed.sourceSnapshot.candidateProfile.id, ownerId }
    });
    if (!storedProfile) {
      throw new NotFoundErrorException(
        "INTERVIEW_PROFILE_VERSION_NOT_FOUND",
        "The candidate profile revision for this plan was not found.",
        { profileVersionId: parsed.sourceSnapshot.candidateProfile.id }
      );
    }

    const profile = profileFromRecord(storedProfile);
    requireMatchingProfileSnapshot(parsed, profile);
    await this.requireOwnedPerformanceSnapshot(ownerId, parsed);
    await this.requireOwnedPracticeEvidenceSnapshot(ownerId, parsed);

    const stored = await this.prisma.$transaction(async (transaction) => {
      const latest = await transaction.personalizedInterviewPlanVersion.findFirst({
        where: { ownerId },
        orderBy: { revision: "desc" },
        select: { revision: true }
      });
      const ready = parsePersonalizedInterviewPlan({
        ...parsed,
        revision: (latest?.revision ?? 0) + 1,
        status: "ready"
      });
      const supersededAt = new Date();

      await transaction.personalizedInterviewPlanVersion.updateMany({
        where: { ownerId, status: "READY" },
        data: {
          status: "SUPERSEDED",
          supersededAt
        }
      });

      return transaction.personalizedInterviewPlanVersion.create({
        data: {
          id: ready.id,
          ownerId,
          profileVersionId: profile.id,
          revision: ready.revision,
          schemaVersion: ready.schemaVersion,
          status: "READY",
          sourceSnapshot: toJson(ready.sourceSnapshot),
          rationale: ready.rationale,
          generatedAt: new Date(ready.generatedAt),
          sessionBlueprints: {
            create: ready.sessions.map(blueprintData)
          }
        },
        include: {
          sessionBlueprints: { orderBy: { order: "asc" } }
        }
      });
    });

    return planFromRecord(stored);
  }

  async getActivePlan(ownerId: string): Promise<PersonalizedInterviewPlan | null> {
    const stored = await this.prisma.personalizedInterviewPlanVersion.findFirst({
      where: { ownerId, status: "READY" },
      orderBy: { revision: "desc" },
      include: { sessionBlueprints: { orderBy: { order: "asc" } } }
    });
    return stored ? planFromRecord(stored) : null;
  }

  async getPlan(ownerId: string, id: string): Promise<PersonalizedInterviewPlan | null> {
    const stored = await this.prisma.personalizedInterviewPlanVersion.findFirst({
      where: { id, ownerId },
      include: { sessionBlueprints: { orderBy: { order: "asc" } } }
    });
    return stored ? planFromRecord(stored) : null;
  }

  private async requireOwnedPerformanceSnapshot(
    ownerId: string,
    plan: PersonalizedInterviewPlan
  ): Promise<void> {
    const snapshot = plan.sourceSnapshot.performanceProfile;
    if (!snapshot) return;
    const stored = await this.prisma.candidatePerformanceProfileVersion.findFirst({
      where: { id: snapshot.id, ownerId },
      select: { id: true, revision: true }
    });
    if (!stored) {
      throw new NotFoundErrorException(
        "PERFORMANCE_PROFILE_VERSION_NOT_FOUND",
        "The demonstrated performance revision for this plan was not found.",
        { performanceProfileVersionId: snapshot.id }
      );
    }
    if (stored.revision !== snapshot.revision) {
      throw new ConflictErrorException(
        "PERFORMANCE_PROFILE_SNAPSHOT_MISMATCH",
        "The plan does not reference the exact demonstrated performance revision.",
        { performanceProfileVersionId: snapshot.id }
      );
    }
  }

  private async requireOwnedPracticeEvidenceSnapshot(
    ownerId: string,
    plan: PersonalizedInterviewPlan
  ): Promise<void> {
    const snapshot = plan.sourceSnapshot.practiceEvidence;
    if (!snapshot) return;
    const stored = await this.prisma.candidatePracticeEvidenceVersion.findFirst({
      where: { id: snapshot.id, ownerId },
      select: { id: true, revision: true }
    });
    if (!stored) {
      throw new NotFoundErrorException(
        "PRACTICE_EVIDENCE_VERSION_NOT_FOUND",
        "The verified Practice evidence revision for this plan was not found.",
        { practiceEvidenceVersionId: snapshot.id }
      );
    }
    if (stored.revision !== snapshot.revision) {
      throw new ConflictErrorException(
        "PRACTICE_EVIDENCE_SNAPSHOT_MISMATCH",
        "The plan does not reference the exact verified Practice evidence revision.",
        { practiceEvidenceVersionId: snapshot.id }
      );
    }
  }
}

function profileFromRecord(record: {
  id: string;
  revision: number;
  schemaVersion: number;
  sourceResumeFingerprint: string;
  generatedAt: Date;
  profile: Prisma.JsonValue;
}): CandidateInterviewProfile {
  const profile = parseCandidateInterviewProfile(record.profile);
  if (
    profile.id !== record.id ||
    profile.revision !== record.revision ||
    profile.schemaVersion !== record.schemaVersion ||
    profile.sourceResumeFingerprint !== record.sourceResumeFingerprint ||
    profile.generatedAt !== record.generatedAt.getTime()
  ) {
    throw new ConflictErrorException(
      "INTERVIEW_PROFILE_SNAPSHOT_MISMATCH",
      "Stored candidate profile metadata does not match its immutable snapshot.",
      { profileVersionId: record.id }
    );
  }
  return profile;
}

function planFromRecord(record: StoredPlan): PersonalizedInterviewPlan {
  return parsePersonalizedInterviewPlan({
    schemaVersion: record.schemaVersion,
    id: record.id,
    revision: record.revision,
    status: planStatus(record.status),
    generatedAt: record.generatedAt.getTime(),
    sourceSnapshot: record.sourceSnapshot,
    rationale: record.rationale,
    sessions: record.sessionBlueprints
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((session) => session.blueprint)
  });
}

function blueprintData(blueprint: SessionBlueprint) {
  return {
    id: blueprint.id,
    kind: SESSION_KIND_TO_DATABASE[blueprint.kind],
    order: blueprint.order,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    durationMinutes: blueprint.durationMinutes,
    difficulty: blueprint.difficulty,
    blueprint: toJson(blueprint)
  };
}

function requireMatchingProfileSnapshot(
  plan: PersonalizedInterviewPlan,
  profile: CandidateInterviewProfile
): void {
  const snapshot = plan.sourceSnapshot.candidateProfile;
  if (
    snapshot.id === profile.id &&
    snapshot.revision === profile.revision &&
    snapshot.sourceResumeFingerprint === profile.sourceResumeFingerprint
  ) {
    return;
  }

  throw new ConflictErrorException(
    "INTERVIEW_PROFILE_SNAPSHOT_MISMATCH",
    "The plan does not reference the exact candidate profile revision it was generated from.",
    { profileVersionId: profile.id }
  );
}

function planStatus(status: StoredPlan["status"]): PersonalizedInterviewPlan["status"] {
  if (status === "READY") return "ready";
  if (status === "SUPERSEDED") return "superseded";
  return "draft";
}

function requireUuid(value: string, field: string): void {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return;
  }
  throw new BadRequestErrorException(
    "PERSONALIZED_PLAN_ID_INVALID",
    `${field} must be a UUID before the plan can be persisted.`,
    { field }
  );
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
