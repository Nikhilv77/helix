import type {
  CandidateInterviewProfile,
  PersonalizedInterviewPlan,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import type { CandidatePerformanceProfile } from "@/lib/interviews/performance-profile";
import type { CandidatePracticeEvidence } from "@/lib/practice/practice-evidence";
import type { CandidateProfile } from "@/lib/shared/types";
import { PersonalizedInterviewPlanningService } from "./personalized-interview-planning.service";
import type { PersonalizedInterviewPlanGenerator } from "./personalized-plan-generator";
import type { PersonalizedPlanningStore } from "./personalized-planning-store";
import type { PersonalizedPerformanceStore } from "./personalized-performance-store";
import type { PracticeEvidenceStore } from "../practice/practice-evidence-store";

const NOW = Date.UTC(2026, 7, 24, 12);
const OWNER_ID = "user:test";
const PROFILE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BLUEPRINT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function candidateProfile(): CandidateInterviewProfile {
  return {
    schemaVersion: 1,
    id: PROFILE_ID,
    revision: 2,
    sourceResumeFingerprint: "sha256-resume",
    generatedAt: NOW,
    headline: "Frontend engineer",
    inferredRole: {
      title: "Frontend Engineer",
      family: "frontend",
      confidence: 0.9,
      rationale: "Recent work centers on frontend engineering."
    },
    experience: { estimatedYears: 3, band: "mid", confidence: 0.9 },
    skills: [],
    domains: [],
    importantProjects: [],
    warnings: []
  };
}

function candidateWorkspaceProfile(targetRole: CandidateProfile["targetRole"] = "frontend") {
  return { targetRole } as CandidateProfile;
}

function performanceProfile(): CandidatePerformanceProfile {
  return {
    schemaVersion: 3,
    id: "99999999-9999-4999-8999-999999999999",
    revision: 4,
    sourceSessionFingerprint: "sha256-completed-sessions",
    generatedAt: NOW,
    completedSessionCount: 1,
    answeredQuestionCount: 4,
    sourceSessionIds: ["session-1"],
    skills: [
      {
        skillKey: "typescript",
        score: 46,
        confidence: 0.8,
        sampleSize: 4,
        lastObservedAt: NOW,
        trend: -8,
        topicKeys: ["typescript"],
        rubricPerformance: [{ rubricKey: "reasoning", score: 46, sampleSize: 4 }]
      }
    ]
  };
}

function practiceEvidence(): CandidatePracticeEvidence {
  return {
    schemaVersion: 1,
    id: "88888888-8888-4888-8888-888888888888",
    revision: 2,
    sourceAttemptFingerprint: "sha256-verified-practice",
    generatedAt: NOW,
    verifiedAttemptCount: 2,
    verifiedQuestionCount: 1,
    sourceAttemptIds: ["attempt-1", "attempt-2"],
    skills: [
      {
        skillKey: "typescript",
        score: 42,
        confidence: 0.64,
        sampleSize: 2,
        lastObservedAt: NOW,
        trend: -10,
        topicKeys: ["typescript"],
        hintsUsed: 2,
        hintDependenceRate: 0.5,
        repeatedAttemptCount: 1,
        retryDependenceRate: 0.5
      }
    ],
    masteryTopics: [],
    weakTopics: [{ topicKey: "typescript", score: 42, sampleSize: 2, lastObservedAt: NOW }],
    recentQuestions: [],
    codeEvidence: []
  };
}

function blueprint(): SessionBlueprint {
  return {
    id: BLUEPRINT_ID,
    kind: "problem-solving",
    order: 1,
    title: "Problem Solving · TypeScript",
    subtitle: "Reasoning and implementation",
    durationMinutes: 35,
    difficulty: "intermediate",
    rationale: "TypeScript is the strongest interview language.",
    topics: [
      {
        key: "typescript",
        label: "TypeScript",
        targetPercent: 100,
        skillKeys: ["typescript"],
        objectives: ["Solve implementation problems clearly"]
      }
    ],
    structure: [{ kind: "core", questionCount: 4, formats: ["code"], purpose: "Test reasoning." }],
    followUpPolicy: {
      maxPerQuestion: 2,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: [
      {
        key: "reasoning",
        label: "Reasoning",
        weightPercent: 100,
        strongSignals: ["Explains choices"],
        weakSignals: ["Cannot explain choices"]
      }
    ]
  };
}

function activePlan(overrides: Partial<PersonalizedInterviewPlan> = {}): PersonalizedInterviewPlan {
  return {
    schemaVersion: 1,
    id: PLAN_ID,
    revision: 3,
    status: "ready",
    generatedAt: NOW,
    sourceSnapshot: {
      candidateProfile: {
        id: PROFILE_ID,
        revision: 2,
        sourceResumeFingerprint: "sha256-resume"
      },
      targetRole: { title: "Frontend Engineer", family: "frontend", source: "declared" },
      jobDescription: null,
      performanceProfile: null
    },
    rationale: "Personalized frontend plan.",
    sessions: [blueprint(), blueprint(), blueprint(), blueprint(), blueprint()].map(
      (session, index) => ({
        ...session,
        id: index === 0 ? BLUEPRINT_ID : `${index}ddddddd-dddd-4ddd-8ddd-dddddddddddd`,
        kind: [
          "problem-solving",
          "core-technical",
          "applied-engineering",
          "architecture-system-design",
          "final-mock"
        ][index] as SessionBlueprint["kind"],
        order: index + 1
      })
    ),
    ...overrides
  };
}

function dependencies(params: {
  storedPlan?: PersonalizedInterviewPlan | null;
  generatedPlan?: PersonalizedInterviewPlan;
  workspaceProfile?: CandidateProfile;
  candidate?: CandidateInterviewProfile;
  performance?: CandidatePerformanceProfile | null;
  practice?: CandidatePracticeEvidence | null;
}) {
  const store = {
    ensureCandidateProfile: vi.fn().mockResolvedValue(params.candidate ?? candidateProfile()),
    getActivePlan: vi.fn().mockResolvedValue(params.storedPlan ?? null),
    saveReadyPlan: vi.fn().mockImplementation(async (_ownerId, plan) => ({
      ...plan,
      revision: 1,
      status: "ready"
    }))
  };
  const generatedPlan = params.generatedPlan ?? activePlan({ status: "draft", revision: 1 });
  const generator = {
    generate: vi.fn().mockReturnValue({ plan: generatedPlan, relevance: {} })
  };
  const profiles = {
    get: vi.fn().mockResolvedValue(params.workspaceProfile ?? candidateWorkspaceProfile())
  };
  const performanceProfiles = {
    refresh: vi.fn().mockResolvedValue(params.performance ?? null)
  };
  const practiceEvidenceStore = {
    refresh: vi.fn().mockResolvedValue(params.practice ?? null)
  };
  const service = new PersonalizedInterviewPlanningService(
    store as unknown as PersonalizedPlanningStore,
    generator as unknown as PersonalizedInterviewPlanGenerator,
    profiles,
    performanceProfiles as unknown as PersonalizedPerformanceStore,
    practiceEvidenceStore as unknown as PracticeEvidenceStore
  );
  return { service, store, generator, performanceProfiles, practiceEvidenceStore };
}

describe("PersonalizedInterviewPlanningService", () => {
  it("reuses the active plan when the profile and target role inputs still match", async () => {
    const current = activePlan();
    const { service, store, generator } = dependencies({ storedPlan: current });

    await expect(service.activePlan(OWNER_ID, NOW)).resolves.toBe(current);
    expect(generator.generate).not.toHaveBeenCalled();
    expect(store.saveReadyPlan).not.toHaveBeenCalled();
  });

  it("keeps the active Interview plan when only the resume profile revision changes", async () => {
    const current = activePlan();
    const changedResume = {
      ...candidateProfile(),
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      revision: 3,
      sourceResumeFingerprint: "sha256-new-resume"
    };
    const { service, store, generator } = dependencies({
      storedPlan: current,
      candidate: changedResume
    });

    await expect(service.activePlan(OWNER_ID, NOW)).resolves.toBe(current);
    expect(generator.generate).not.toHaveBeenCalled();
    expect(store.saveReadyPlan).not.toHaveBeenCalled();
  });

  it("publishes a new plan when the declared target role changes", async () => {
    const stale = activePlan();
    const generated = activePlan({
      status: "draft",
      sourceSnapshot: {
        ...stale.sourceSnapshot,
        targetRole: { title: "Backend Engineer", family: "backend", source: "declared" }
      }
    });
    const { service, store, generator } = dependencies({
      storedPlan: stale,
      generatedPlan: generated,
      workspaceProfile: candidateWorkspaceProfile("backend")
    });

    const result = await service.activePlan(OWNER_ID, NOW);

    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRole: expect.objectContaining({ title: "Backend Engineer", family: "backend" })
      })
    );
    expect(store.saveReadyPlan).toHaveBeenCalledWith(OWNER_ID, generated);
    expect(result.status).toBe("ready");
  });

  it("returns only a blueprint from the active owner-scoped plan", async () => {
    const { service } = dependencies({ storedPlan: activePlan() });

    await expect(service.blueprint(OWNER_ID, BLUEPRINT_ID, PLAN_ID, NOW)).resolves.toMatchObject({
      plan: { id: PLAN_ID },
      blueprint: { id: BLUEPRINT_ID, kind: "problem-solving" }
    });
    await expect(
      service.blueprint(OWNER_ID, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", PLAN_ID, NOW)
    ).rejects.toMatchObject({ code: "INTERVIEW_BLUEPRINT_NOT_FOUND" });
  });

  it("rejects a stale plan link instead of silently launching a different session", async () => {
    const { service } = dependencies({ storedPlan: activePlan() });

    await expect(
      service.blueprint(OWNER_ID, BLUEPRINT_ID, "ffffffff-ffff-4fff-8fff-ffffffffffff", NOW)
    ).rejects.toMatchObject({ code: "PERSONALIZED_PLAN_CHANGED" });
  });

  it("regenerates a stale plan with the latest demonstrated skill profile", async () => {
    const performance = performanceProfile();
    const generated = activePlan({
      status: "draft",
      sourceSnapshot: {
        ...activePlan().sourceSnapshot,
        performanceProfile: { id: performance.id, revision: performance.revision }
      }
    });
    const { service, generator, store } = dependencies({
      storedPlan: activePlan(),
      generatedPlan: generated,
      performance
    });

    await service.activePlan(OWNER_ID, NOW);

    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        performance: {
          snapshot: { id: performance.id, revision: 4 },
          skills: performance.skills
        }
      })
    );
    expect(store.saveReadyPlan).toHaveBeenCalledWith(OWNER_ID, generated);
  });

  it("reuses a plan already generated from the latest performance revision", async () => {
    const performance = performanceProfile();
    const current = activePlan({
      sourceSnapshot: {
        ...activePlan().sourceSnapshot,
        performanceProfile: { id: performance.id, revision: performance.revision }
      }
    });
    const { service, generator } = dependencies({ storedPlan: current, performance });

    await expect(service.activePlan(OWNER_ID, NOW)).resolves.toBe(current);
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("publishes a future plan revision when verified Practice evidence changes", async () => {
    const evidence = practiceEvidence();
    const generated = activePlan({
      status: "draft",
      sourceSnapshot: {
        ...activePlan().sourceSnapshot,
        practiceEvidence: { id: evidence.id, revision: evidence.revision }
      }
    });
    const { service, generator, store } = dependencies({
      storedPlan: activePlan(),
      generatedPlan: generated,
      practice: evidence
    });

    await service.activePlan(OWNER_ID, NOW);

    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceEvidence: {
          snapshot: { id: evidence.id, revision: 2 },
          skills: evidence.skills
        }
      })
    );
    expect(store.saveReadyPlan).toHaveBeenCalledWith(OWNER_ID, generated);
  });
});
