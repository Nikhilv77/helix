import type { PrismaService } from "../database/prisma.service";
import { PersonalizedPerformanceStore } from "./personalized-performance-store";
import type { InterviewState } from "./types";

const NOW = Date.UTC(2026, 7, 24, 12);
const OWNER_ID = "user:performance";

function completedState(): InterviewState {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    setup: {
      role: "frontend",
      level: "3-5",
      roundType: "technical",
      intensity: "realistic",
      context: "Built React applications.",
      personalizedPlanId: "22222222-2222-4222-8222-222222222222",
      personalizedBlueprint: {
        id: "33333333-3333-4333-8333-333333333333",
        kind: "core-technical",
        order: 2,
        title: "React Deep Dive",
        subtitle: "Technical depth",
        durationMinutes: 35,
        difficulty: "intermediate",
        rationale: "React is relevant.",
        topics: [
          {
            key: "react",
            label: "React",
            targetPercent: 100,
            skillKeys: ["react"],
            objectives: ["Explain rendering"]
          }
        ],
        structure: [
          { kind: "core", questionCount: 1, formats: ["spoken"], purpose: "Probe depth." }
        ],
        followUpPolicy: {
          maxPerQuestion: 2,
          probeWeakClaims: true,
          increaseDifficultyAfterStrongAnswer: true,
          stayWithinBlueprintTopics: true
        },
        rubric: [
          {
            key: "depth",
            label: "Depth",
            weightPercent: 100,
            strongSignals: ["Explains rendering"],
            weakSignals: ["Only names hooks"]
          }
        ]
      }
    },
    plan: [
      {
        text: "How does React render this update?",
        kind: "conversation",
        blueprintStage: "core",
        blueprintDifficulty: "intermediate",
        blueprintFormat: "spoken",
        topicKey: "react",
        skillKeys: ["react"],
        rubricKeys: ["depth"],
        mustHit: ["mechanism", "trade-off"],
        probeIfMissing: "What triggers the render?"
      }
    ],
    phase: "done",
    questionIndex: 1,
    followUpCount: 0,
    startedAt: NOW - 10_000,
    turns: [
      {
        speaker: "user",
        text: "I chose this boundary because it reduced rerenders by 25 percent.",
        startMs: 0,
        endMs: 5_000,
        questionIndex: 0
      }
    ],
    evidence: {}
  };
}

function prismaMock() {
  const mock = {
    interviewSession: {
      findMany: vi.fn().mockResolvedValue([
        {
          state: completedState(),
          startedAt: new Date(NOW - 10_000),
          touchedAt: new Date(NOW)
        }
      ])
    },
    candidatePerformanceProfileVersion: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  };
  mock.$transaction.mockImplementation(
    async (operation: (transaction: typeof mock) => Promise<unknown>) => operation(mock)
  );
  return mock;
}

describe("PersonalizedPerformanceStore", () => {
  it("creates the next immutable revision from completed sessions", async () => {
    const mock = prismaMock();
    mock.candidatePerformanceProfileVersion.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mock.candidatePerformanceProfileVersion.findFirst.mockResolvedValue({ revision: 2 });
    mock.candidatePerformanceProfileVersion.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        createdAt: new Date(NOW)
      })
    );
    const store = new PersonalizedPerformanceStore(mock as unknown as PrismaService);

    const profile = await store.refresh(OWNER_ID, NOW);

    expect(profile).toMatchObject({
      revision: 3,
      completedSessionCount: 1,
      answeredQuestionCount: 1,
      skills: [expect.objectContaining({ skillKey: "react", sampleSize: 1 })]
    });
    expect(mock.candidatePerformanceProfileVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: OWNER_ID,
        revision: 3,
        sourceSessionFingerprint: expect.stringMatching(/^sha256-/)
      })
    });
  });

  it("reuses an existing fingerprint-backed revision", async () => {
    const firstMock = prismaMock();
    firstMock.candidatePerformanceProfileVersion.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    firstMock.candidatePerformanceProfileVersion.findFirst.mockResolvedValue(null);
    firstMock.candidatePerformanceProfileVersion.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        createdAt: new Date(NOW)
      })
    );
    const firstStore = new PersonalizedPerformanceStore(firstMock as unknown as PrismaService);
    const stored = await firstStore.refresh(OWNER_ID, NOW);
    expect(stored).not.toBeNull();

    const secondMock = prismaMock();
    secondMock.candidatePerformanceProfileVersion.findUnique.mockResolvedValue({
      id: stored!.id,
      ownerId: OWNER_ID,
      revision: stored!.revision,
      schemaVersion: stored!.schemaVersion,
      sourceSessionFingerprint: stored!.sourceSessionFingerprint,
      completedSessionCount: stored!.completedSessionCount,
      answeredQuestionCount: stored!.answeredQuestionCount,
      profile: stored,
      generatedAt: new Date(stored!.generatedAt),
      createdAt: new Date(stored!.generatedAt)
    });
    const secondStore = new PersonalizedPerformanceStore(secondMock as unknown as PrismaService);

    await expect(secondStore.refresh(OWNER_ID, NOW + 1)).resolves.toEqual(stored);
    expect(secondMock.$transaction).not.toHaveBeenCalled();
  });
});
