import { PersonalizedInterviewPlanStatus, PersonalizedInterviewSessionKind } from "@prisma/client";
import type {
  CandidateInterviewProfile,
  InterviewSessionKind,
  PersonalizedInterviewPlan,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import type { CandidateProfile, CandidateResume } from "@/lib/shared/types";
import type { PrismaService } from "../database/prisma.service";
import { compileCandidateInterviewProfile } from "./candidate-profile-compiler";
import { PersonalizedPlanningStore } from "./personalized-planning-store";

const NOW = Date.UTC(2026, 7, 24, 12);
const OWNER_ID = "user:test-candidate";
const PROFILE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAN_ID = "11111111-1111-4111-8111-111111111111";

function resume(overrides: Partial<CandidateResume> = {}): CandidateResume {
  return {
    fileName: "candidate.pdf",
    uploadedAt: NOW,
    confidence: 93,
    fullName: "Test Candidate",
    skills: ["TypeScript", "React"],
    warnings: [],
    experience: [
      {
        organization: "Product Co",
        role: "Frontend Engineer",
        period: "2023 - Present",
        location: "",
        summary: "Built production React applications.",
        achievements: [],
        skills: ["TypeScript", "React.js"]
      }
    ],
    education: [],
    projects: [],
    achievements: [],
    practiceQuestions: [],
    roadmap: [],
    document: {
      format: "pdf",
      pageCount: 1,
      pageCountEstimated: false,
      sections: ["experience", "skills"]
    },
    evidence: {
      dateRanges: 1,
      achievementLines: 1,
      quantifiedAchievements: 0,
      experienceEntries: 1,
      projectEntries: 0,
      educationEntries: 0
    },
    interviewKit: null,
    ...overrides
  };
}

function candidateProfile(candidateResume: CandidateResume | null = resume()): CandidateProfile {
  return {
    targetRole: "frontend",
    level: "3-5",
    targetCompany: "",
    targetDate: null,
    headline: "Frontend engineer",
    context: "Builds production React applications.",
    focusAreas: ["Technical depth"],
    stories: [],
    coverImage: null,
    profileImage: null,
    workspaceAccent: "ember",
    teacherId: null,
    helpNotificationsEnabled: true,
    teacherNotificationsEnabled: true,
    updatedAt: NOW,
    completeness: 80,
    onboardingCompletedAt: NOW,
    resume: candidateResume
  };
}

function compiledProfile(revision = 1): CandidateInterviewProfile {
  return compileCandidateInterviewProfile({
    resume: resume(),
    headline: "Frontend engineer",
    selectedRole: "frontend",
    selectedLevel: "3-5",
    profileId: PROFILE_ID,
    revision,
    generatedAt: NOW
  });
}

function profileRecord(profile = compiledProfile()) {
  return {
    id: profile.id,
    ownerId: OWNER_ID,
    revision: profile.revision,
    schemaVersion: profile.schemaVersion,
    sourceResumeFingerprint: profile.sourceResumeFingerprint,
    profile,
    generatedAt: new Date(profile.generatedAt),
    createdAt: new Date(profile.generatedAt)
  };
}

function blueprint(kind: InterviewSessionKind, order: number, id: string): SessionBlueprint {
  return {
    id,
    kind,
    order,
    title: `${kind} · TypeScript`,
    subtitle: "Personalized from resume evidence",
    durationMinutes: 35,
    difficulty: "intermediate",
    rationale: "Covers the candidate's target role and strongest evidence.",
    topics: [
      {
        key: "typescript",
        label: "TypeScript",
        targetPercent: 100,
        skillKeys: ["typescript"],
        objectives: ["Explain language and engineering trade-offs"]
      }
    ],
    structure: [
      {
        kind: "core",
        questionCount: 4,
        formats: ["spoken"],
        purpose: "Test technical depth."
      }
    ],
    followUpPolicy: {
      maxPerQuestion: 2,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: [
      {
        key: "technical-depth",
        label: "Technical depth",
        weightPercent: 100,
        strongSignals: ["Explains mechanisms and trade-offs"],
        weakSignals: ["Uses terminology without explanation"]
      }
    ]
  };
}

function plan(profile = compiledProfile()): PersonalizedInterviewPlan {
  const kinds = [
    "problem-solving",
    "core-technical",
    "applied-engineering",
    "architecture-system-design",
    "final-mock"
  ] as const;
  return {
    schemaVersion: 1,
    id: PLAN_ID,
    revision: 1,
    status: "draft",
    generatedAt: NOW,
    sourceSnapshot: {
      candidateProfile: {
        id: profile.id,
        revision: profile.revision,
        sourceResumeFingerprint: profile.sourceResumeFingerprint
      },
      targetRole: {
        title: "Frontend Engineer",
        family: "frontend",
        source: "declared"
      },
      jobDescription: null,
      performanceProfile: null
    },
    rationale: "Prioritizes the candidate's target frontend role and grounded experience.",
    sessions: kinds.map((kind, index) =>
      blueprint(kind, index + 1, `${index + 2}0000000-0000-4000-8000-00000000000${index + 1}`)
    )
  };
}

function createPrismaMock() {
  const mock = {
    candidateInterviewProfileVersion: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn()
    },
    personalizedInterviewPlanVersion: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn()
    },
    candidatePerformanceProfileVersion: {
      findFirst: vi.fn()
    },
    candidatePracticeEvidenceVersion: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn()
  };
  mock.$transaction.mockImplementation(
    async (operation: (transaction: typeof mock) => Promise<unknown>) => operation(mock)
  );
  return mock;
}

function storeWith(mock: ReturnType<typeof createPrismaMock>, profile = candidateProfile()) {
  return new PersonalizedPlanningStore(mock as unknown as PrismaService, {
    get: vi.fn().mockResolvedValue(profile)
  });
}

describe("PersonalizedPlanningStore profile versions", () => {
  it("returns the fingerprint-matched revision without creating a duplicate", async () => {
    const mock = createPrismaMock();
    const stored = profileRecord();
    mock.candidateInterviewProfileVersion.findUnique.mockResolvedValue(stored);
    const store = storeWith(mock);

    await expect(store.ensureCandidateProfile(OWNER_ID, NOW)).resolves.toEqual(compiledProfile());
    expect(mock.$transaction).not.toHaveBeenCalled();
    expect(mock.personalizedInterviewPlanVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: OWNER_ID,
          profileVersionId: { not: PROFILE_ID }
        })
      })
    );
  });

  it("lazily backfills an existing candidate and increments the immutable revision", async () => {
    const mock = createPrismaMock();
    mock.candidateInterviewProfileVersion.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mock.candidateInterviewProfileVersion.findFirst.mockResolvedValue({ revision: 2 });
    mock.candidateInterviewProfileVersion.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        createdAt: new Date(NOW)
      })
    );
    const store = storeWith(mock);

    const created = await store.ensureCandidateProfile(OWNER_ID, NOW);

    expect(created.revision).toBe(3);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mock.candidateInterviewProfileVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: OWNER_ID,
        revision: 3,
        sourceResumeFingerprint: expect.stringMatching(/^sha256-/)
      })
    });
  });

  it("requires a stored resume before lazy backfill", async () => {
    const mock = createPrismaMock();
    const store = storeWith(mock, candidateProfile(null));

    await expect(store.ensureCandidateProfile(OWNER_ID, NOW)).rejects.toMatchObject({
      code: "RESUME_REQUIRED"
    });
    expect(mock.candidateInterviewProfileVersion.findUnique).not.toHaveBeenCalled();
  });
});

describe("PersonalizedPlanningStore plan versions", () => {
  it("publishes five blueprint rows and supersedes the previous READY plan atomically", async () => {
    const mock = createPrismaMock();
    const profile = compiledProfile();
    mock.candidateInterviewProfileVersion.findFirst.mockResolvedValue(profileRecord(profile));
    mock.personalizedInterviewPlanVersion.findFirst.mockResolvedValue({ revision: 4 });
    mock.personalizedInterviewPlanVersion.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        const nested = data.sessionBlueprints as { create: Array<Record<string, unknown>> };
        return {
          ...data,
          sessionBlueprints: nested.create.map((session) => ({
            ...session,
            planVersionId: data.id,
            createdAt: new Date(NOW)
          })),
          createdAt: new Date(NOW),
          updatedAt: new Date(NOW),
          supersededAt: null
        };
      }
    );
    const store = storeWith(mock);

    const saved = await store.saveReadyPlan(OWNER_ID, plan(profile));

    expect(saved).toMatchObject({ id: PLAN_ID, revision: 5, status: "ready" });
    expect(saved.sessions).toHaveLength(5);
    expect(mock.personalizedInterviewPlanVersion.updateMany).toHaveBeenCalledWith({
      where: { ownerId: OWNER_ID, status: PersonalizedInterviewPlanStatus.READY },
      data: expect.objectContaining({ status: PersonalizedInterviewPlanStatus.SUPERSEDED })
    });
    expect(mock.personalizedInterviewPlanVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revision: 5,
          profileVersionId: PROFILE_ID,
          sessionBlueprints: {
            create: expect.arrayContaining([
              expect.objectContaining({
                kind: PersonalizedInterviewSessionKind.PROBLEM_SOLVING,
                order: 1
              }),
              expect.objectContaining({
                kind: PersonalizedInterviewSessionKind.FINAL_MOCK,
                order: 5
              })
            ])
          }
        })
      })
    );
  });

  it("rejects plans built from a different immutable profile snapshot", async () => {
    const mock = createPrismaMock();
    const profile = compiledProfile();
    mock.candidateInterviewProfileVersion.findFirst.mockResolvedValue(profileRecord(profile));
    const mismatched = plan(profile);
    mismatched.sourceSnapshot.candidateProfile.revision = 9;
    const store = storeWith(mock);

    await expect(store.saveReadyPlan(OWNER_ID, mismatched)).rejects.toMatchObject({
      code: "INTERVIEW_PROFILE_SNAPSHOT_MISMATCH"
    });
    expect(mock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an adaptive plan whose performance revision is not owner scoped", async () => {
    const mock = createPrismaMock();
    const profile = compiledProfile();
    mock.candidateInterviewProfileVersion.findFirst.mockResolvedValue(profileRecord(profile));
    mock.candidatePerformanceProfileVersion.findFirst.mockResolvedValue(null);
    const adaptive = plan(profile);
    adaptive.sourceSnapshot.performanceProfile = {
      id: "99999999-9999-4999-8999-999999999999",
      revision: 3
    };
    const store = storeWith(mock);

    await expect(store.saveReadyPlan(OWNER_ID, adaptive)).rejects.toMatchObject({
      code: "PERFORMANCE_PROFILE_VERSION_NOT_FOUND"
    });
    expect(mock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a plan whose Practice evidence revision is not owner scoped", async () => {
    const mock = createPrismaMock();
    const profile = compiledProfile();
    mock.candidateInterviewProfileVersion.findFirst.mockResolvedValue(profileRecord(profile));
    mock.candidatePracticeEvidenceVersion.findFirst.mockResolvedValue(null);
    const adaptive = plan(profile);
    adaptive.sourceSnapshot.practiceEvidence = {
      id: "88888888-8888-4888-8888-888888888888",
      revision: 2
    };
    const store = storeWith(mock);

    await expect(store.saveReadyPlan(OWNER_ID, adaptive)).rejects.toMatchObject({
      code: "PRACTICE_EVIDENCE_VERSION_NOT_FOUND"
    });
    expect(mock.$transaction).not.toHaveBeenCalled();
  });

  it("reconstructs and validates an active plan even when blueprint rows arrive unordered", async () => {
    const mock = createPrismaMock();
    const candidatePlan = plan();
    mock.personalizedInterviewPlanVersion.findFirst.mockResolvedValue({
      id: candidatePlan.id,
      ownerId: OWNER_ID,
      profileVersionId: PROFILE_ID,
      revision: 7,
      schemaVersion: candidatePlan.schemaVersion,
      status: PersonalizedInterviewPlanStatus.READY,
      sourceSnapshot: candidatePlan.sourceSnapshot,
      rationale: candidatePlan.rationale,
      generatedAt: new Date(candidatePlan.generatedAt),
      supersededAt: null,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
      sessionBlueprints: candidatePlan.sessions
        .slice()
        .reverse()
        .map((session) => ({
          id: session.id,
          planVersionId: candidatePlan.id,
          kind:
            session.kind === "problem-solving"
              ? PersonalizedInterviewSessionKind.PROBLEM_SOLVING
              : PersonalizedInterviewSessionKind.FINAL_MOCK,
          order: session.order,
          title: session.title,
          subtitle: session.subtitle,
          durationMinutes: session.durationMinutes,
          difficulty: session.difficulty,
          blueprint: session,
          createdAt: new Date(NOW)
        }))
    });
    const store = storeWith(mock);

    const active = await store.getActivePlan(OWNER_ID);

    expect(active?.revision).toBe(7);
    expect(active?.sessions.map((session) => session.order)).toEqual([1, 2, 3, 4, 5]);
  });
});
