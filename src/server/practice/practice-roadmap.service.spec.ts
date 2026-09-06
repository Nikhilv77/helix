import { PracticeSessionAvailability, RoadmapProgressStatus } from "@prisma/client";
import type { PersonalizedInterviewPlan } from "@/lib/interviews/personalized-plan";
import { PRACTICE_SESSION_KEYS, projectPracticeSessions } from "@/lib/practice/practice-roadmap";
import type { PrismaService } from "../database/prisma.service";
import type { PersonalizedInterviewPlanningService } from "../interview/personalized-interview-planning.service";
import type { FrontendRoadmapService } from "../roadmap/frontend-roadmap.service";
import { PracticeRoadmapService } from "./practice-roadmap.service";

const templateSlugs = [
  "dsa",
  "core-technical",
  "applied-engineering",
  "architecture-system-design",
  "resume-behavioral-defense",
  "final-mock"
];

function plan(): PersonalizedInterviewPlan {
  const kinds = [
    "problem-solving",
    "core-technical",
    "applied-engineering",
    "architecture-system-design",
    "final-mock"
  ] as const;

  return {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000001",
    revision: 3,
    status: "ready",
    generatedAt: 1,
    sourceSnapshot: {
      candidateProfile: {
        id: "00000000-0000-4000-8000-000000000002",
        revision: 2,
        sourceResumeFingerprint: "resume"
      },
      targetRole: { title: "Engineer", family: "fullstack", source: "declared" },
      jobDescription: null,
      performanceProfile: null
    },
    rationale: "Evidence-grounded plan",
    sessions: kinds.map((kind, index) => ({
      id: `00000000-0000-4000-8000-00000000001${index}`,
      kind,
      order: index + 1,
      title: kind === "problem-solving" ? "Problem Solving · TypeScript" : `Title ${kind}`,
      subtitle: `Purpose ${kind}`,
      durationMinutes: 30,
      difficulty: "adaptive" as const,
      rationale: "Evidence",
      topics: [
        {
          key: "topic",
          label: "Topic",
          targetPercent: 100,
          skillKeys: [],
          objectives: ["Explain decisions"]
        }
      ],
      structure: [
        { kind: "core" as const, questionCount: 3, formats: ["spoken" as const], purpose: "Depth" }
      ],
      followUpPolicy: {
        maxPerQuestion: 2,
        probeWeakClaims: true,
        increaseDifficultyAfterStrongAnswer: true,
        stayWithinBlueprintTopics: true as const
      },
      rubric: [
        {
          key: "depth",
          label: "Depth",
          weightPercent: 100,
          strongSignals: ["Specific"],
          weakSignals: ["Vague"]
        }
      ]
    }))
  };
}

describe("PracticeRoadmapService", () => {
  it("reconciles the DSA Practice slot without writing over progress counters", async () => {
    const activePlan = plan();
    const transaction = practiceTransaction(activePlan, true);
    const prisma = {
      $transaction: vi.fn().mockImplementation((work) => work(transaction))
    } as unknown as PrismaService;
    const roadmaps = {
      home: vi.fn().mockResolvedValue({ roadmapId: "roadmap" })
    } as unknown as FrontendRoadmapService;
    const plans = {
      activePlan: vi.fn().mockResolvedValue(activePlan)
    } as unknown as PersonalizedInterviewPlanningService;

    const result = await new PracticeRoadmapService(prisma, roadmaps, plans).home("owner-1");

    expect(result?.sessions.map((session) => session.key)).toEqual(PRACTICE_SESSION_KEYS);
    expect(result?.sessions[0]).toMatchObject({
      availability: "available",
      href: "/practice/dsa",
      attemptedQuestions: 7,
      completedQuestions: 4
    });
    expect(transaction.userSessionProgress.update).toHaveBeenCalledTimes(1);
    for (const [{ data }] of transaction.userSessionProgress.update.mock.calls) {
      expect(data).not.toHaveProperty("status");
      expect(data).not.toHaveProperty("attemptedQuestions");
      expect(data).not.toHaveProperty("completedQuestions");
      expect(data).not.toHaveProperty("progressPercent");
    }
    expect(transaction.userSessionProgress.update.mock.calls[0]?.[0].data.availability).toBe(
      PracticeSessionAvailability.AVAILABLE
    );
  });

  it("performs no persistence writes when the plan and template inputs are unchanged", async () => {
    const activePlan = plan();
    const transaction = practiceTransaction(activePlan, false);
    const prisma = {
      $transaction: vi.fn().mockImplementation((work) => work(transaction))
    } as unknown as PrismaService;
    const service = new PracticeRoadmapService(
      prisma,
      {
        home: vi.fn().mockResolvedValue({ roadmapId: "roadmap" })
      } as unknown as FrontendRoadmapService,
      {
        activePlan: vi.fn().mockResolvedValue(activePlan)
      } as unknown as PersonalizedInterviewPlanningService
    );

    const result = await service.home("owner-1");

    expect(result?.sessions).toHaveLength(1);
    expect(transaction.userSessionProgress.create).not.toHaveBeenCalled();
    expect(transaction.userSessionProgress.update).not.toHaveBeenCalled();
    expect(transaction.userRoadmap.update).not.toHaveBeenCalled();
  });
});

function practiceTransaction(activePlan: PersonalizedInterviewPlan, stale: boolean) {
  const projected = projectPracticeSessions(activePlan);
  const templates = templateSlugs.map((slug, index) => ({
    id: `00000000-0000-4000-8000-0000000003${index.toString().padStart(2, "0")}`,
    slug,
    _count: { questions: index === 0 ? 200 : 0 }
  }));
  const rows = projected.map((session, index) => ({
    id: `00000000-0000-4000-8000-0000000004${index.toString().padStart(2, "0")}`,
    sessionTemplateId: templates[index]!.id,
    practiceSessionKey: session.key,
    order: session.order,
    status: RoadmapProgressStatus.IN_PROGRESS,
    availability:
      index === 0 ? PracticeSessionAvailability.AVAILABLE : PracticeSessionAvailability.UNAVAILABLE,
    titleSnapshot: stale ? `Old ${session.title}` : session.title,
    purposeSnapshot: session.purpose,
    coversSnapshot: session.covers,
    difficultySnapshot: session.difficulty,
    durationMinutesSnapshot: session.durationMinutes,
    sourceBlueprintId: session.sourceBlueprintId,
    sourceBlueprintKind: session.sourceBlueprintKind,
    personalizedAt: new Date(1),
    totalQuestions: index === 0 ? 200 : 0,
    attemptedQuestions: 7,
    completedQuestions: 4,
    progressPercent: 35
  }));
  const update = vi.fn().mockImplementation(({ where, data }) => {
    const existing = rows.find((row) => row.id === where.id);
    return Promise.resolve({ ...existing, ...data });
  });

  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    userRoadmap: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000100",
        title: "Practice roadmap",
        templateId: "00000000-0000-4000-8000-000000000200",
        personalization: {},
        generatedAt: new Date(1),
        sourceInterviewPlanId: stale ? null : activePlan.id,
        sourceInterviewPlanRevision: stale ? null : activePlan.revision,
        sourceProfileVersionId: stale ? null : activePlan.sourceSnapshot.candidateProfile.id,
        sourceProfileRevision: stale ? null : activePlan.sourceSnapshot.candidateProfile.revision,
        practiceGenerationVersion: stale ? 1 : 2
      }),
      update: vi.fn().mockResolvedValue({ generatedAt: new Date(2) })
    },
    roadmapSessionTemplate: { findMany: vi.fn().mockResolvedValue(templates) },
    userSessionProgress: {
      findMany: vi.fn().mockResolvedValue(rows),
      create: vi.fn(),
      update
    },
    userQuestionProgress: {
      findMany: vi.fn().mockResolvedValue([])
    },
    candidateProfile: {
      findUnique: vi.fn().mockResolvedValue({ level: "3-5" })
    },
    practiceQuestionPlacement: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    }
  };
}
