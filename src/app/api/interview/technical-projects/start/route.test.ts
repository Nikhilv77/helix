import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionBlueprint } from "@/features/interviews/domain/personalized-plan";

const mocks = vi.hoisted(() => ({
  resolveOwner: vi.fn(),
  findActive: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  enforce: vi.fn(),
  getProfile: vi.fn(),
  activePlan: vi.fn(),
  ensureKit: vi.fn(),
  start: vi.fn()
}));

vi.mock("@/features/interviews/server/owner", () => ({
  resolveInterviewOwner: mocks.resolveOwner,
  attachInterviewOwnerCookie: (response: Response) => response
}));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { interviewCreation: { namespace: "test" } },
  getSharedGuard: () => ({ acquire: mocks.acquire, enforce: mocks.enforce })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    interviewService: {
      findOwnedActiveByTemplate: mocks.findActive,
      start: mocks.start
    },
    profileService: { get: mocks.getProfile },
    personalizedInterviewPlanningService: { activePlan: mocks.activePlan },
    resumeInterviewKitService: { ensure: mocks.ensureKit }
  })
}));

import { POST } from "./route";

function blueprint(kind: "core-technical" | "applied-engineering"): SessionBlueprint {
  return {
    id: `${kind}-id`,
    kind,
    order: kind === "core-technical" ? 2 : 3,
    title: kind,
    subtitle: "test",
    durationMinutes: 35,
    difficulty: "intermediate",
    rationale: "test",
    topics: [
      {
        key: `${kind}-topic`,
        label: kind,
        targetPercent: 100,
        skillKeys: ["javascript"],
        objectives: ["Explain the mechanism"]
      }
    ],
    structure: [{ kind: "core", questionCount: 1, formats: ["spoken"], purpose: "test" }],
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
        strongSignals: ["Explains why"],
        weakSignals: ["Guesses"]
      }
    ]
  };
}

describe("POST /api/interview/technical-projects/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOwner.mockResolvedValue({ ownerId: "user:test" });
    mocks.findActive.mockResolvedValue(null);
    mocks.acquire.mockResolvedValue({ release: mocks.release });
    mocks.getProfile.mockResolvedValue({
      targetRole: "backend",
      level: "3-5",
      context: "Backend engineer",
      resume: null
    });
    mocks.activePlan.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      sessions: [blueprint("core-technical"), blueprint("applied-engineering")]
    });
    mocks.start.mockImplementation(async (setup, _ownerId, _now, plan) => ({
      state: {
        id: "22222222-2222-4222-8222-222222222222",
        setup,
        plan
      },
      utterance: "Claire opens the interview."
    }));
  });

  it("freezes a seven-question Claire-led round without private material in the response", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/interview/technical-projects/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    const [setup, ownerId, , plan] = mocks.start.mock.calls[0]!;
    expect(ownerId).toBe("user:test");
    expect(setup).toMatchObject({
      templateId: "technical-deep-dive",
      templateTitle: "Core Technical & Projects interview",
      durationMinutes: 40,
      questionCount: 7,
      technicalDeepDive: { kind: "technical-deep-dive", version: 2 }
    });
    expect(plan).toHaveLength(7);
    expect(plan.slice(0, 3).every((question: { kind?: string }) => question.kind === "mcq")).toBe(
      true
    );
    const payload = JSON.stringify(await response.json());
    expect(payload).not.toContain("answerIndex");
    expect(payload).not.toContain("technicalProjectInterviewerGuide");
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("resumes an active legacy round before acquiring a creation lease", async () => {
    mocks.findActive.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      plan: [{ text: "Legacy question" }],
      turns: [{ speaker: "agent", action: "intro", text: "Welcome back." }]
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/technical-projects/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
