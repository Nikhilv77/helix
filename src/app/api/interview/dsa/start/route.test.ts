import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findQuestion } from "@/features/practice/dsa/domain/dsa";

const mocks = vi.hoisted(() => ({
  resolveOwner: vi.fn(),
  enforce: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  findActive: vi.fn(),
  getProfile: vi.fn(),
  completedDsaQuestions: vi.fn(),
  refreshPerformance: vi.fn(),
  history: vi.fn(),
  confirmFocus: vi.fn(),
  rankFirstScenario: vi.fn(),
  start: vi.fn()
}));

vi.mock("@/features/interviews/server/owner", () => ({
  resolveInterviewOwner: mocks.resolveOwner,
  attachInterviewOwnerCookie: (response: Response) => response
}));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { interviewCreation: { namespace: "test" } },
  getSharedGuard: () => ({ enforce: mocks.enforce, acquire: mocks.acquire })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    profileService: { get: mocks.getProfile },
    frontendRoadmapService: { completedDsaQuestions: mocks.completedDsaQuestions },
    personalizedPerformanceStore: { refresh: mocks.refreshPerformance },
    interviewService: {
      history: mocks.history,
      start: mocks.start,
      findOwnedActiveByTemplate: mocks.findActive
    },
    architectureDesign: {
      focus: { confirm: mocks.confirmFocus },
      ranking: { rankFirstScenario: mocks.rankFirstScenario }
    }
  })
}));

import { POST } from "./route";

const solvedSlugs = [
  "two-sum",
  "longest-substring-without-repeating-characters",
  "3sum",
  "merge-intervals",
  "reverse-linked-list",
  "maximum-depth-of-binary-tree",
  "number-of-islands",
  "course-schedule",
  "valid-parentheses",
  "binary-search"
];

describe("POST /api/interview/dsa/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOwner.mockResolvedValue({ ownerId: "user:test" });
    mocks.acquire.mockResolvedValue({ release: mocks.release });
    mocks.findActive.mockResolvedValue(null);
    mocks.getProfile.mockResolvedValue({
      targetRole: "backend",
      level: "3-5",
      context: "Backend candidate"
    });
    mocks.completedDsaQuestions.mockResolvedValue(
      solvedSlugs.map((slug) => {
        const question = findQuestion(slug)?.question;
        if (!question) throw new Error(`Missing DSA fixture: ${slug}`);
        return question;
      })
    );
    mocks.refreshPerformance.mockResolvedValue(null);
    mocks.history.mockResolvedValue([]);
    mocks.confirmFocus.mockResolvedValue({ focusFingerprint: "focus:test" });
    mocks.rankFirstScenario.mockReturnValue({
      selectedScenario: {
        scenarioKey: "multi-tenant-webhook-delivery",
        scenarioVersion: 1,
        difficulty: "standard"
      }
    });
    mocks.start.mockImplementation(async (setup, _ownerId, _now, plan) => ({
      state: {
        id: "11111111-1111-4111-8111-111111111111",
        setup,
        plan,
        turns: []
      },
      utterance: "Claire opens the interview."
    }));
  });

  it("resumes an active DSA session without consuming quota or a creation lease", async () => {
    mocks.findActive.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      plan: [{ text: "Current problem" }],
      turns: [{ speaker: "agent", action: "intro", text: "Welcome back." }]
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/dsa/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        sessionId: "22222222-2222-4222-8222-222222222222",
        questionCount: 1,
        utterance: "Welcome back."
      }
    });
    expect(mocks.enforce).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("starts a private five-question backend DSA & Design round", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/interview/dsa/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    const [setup, ownerId, , plan] = mocks.start.mock.calls[0]!;
    expect(ownerId).toBe("user:test");
    expect(setup).toMatchObject({
      templateId: "dsa",
      templateTitle: "DSA & Design interview",
      durationMinutes: 40,
      questionCount: 5,
      dsaDesignRound: {
        kind: "dsa-design-round",
        designScenarioKey: "multi-tenant-webhook-delivery"
      }
    });
    expect(plan).toHaveLength(5);
    expect(
      plan.map((question: { interviewSection?: string }) => question.interviewSection)
    ).toEqual(["dsa", "dsa", "design", "design", "design"]);
    expect(JSON.stringify(await response.json())).not.toContain("expectedAnswer");
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rejects readiness when operation-only practice inflates the solved count", async () => {
    const operationQuestion = findQuestion("lru-cache")?.question;
    mocks.completedDsaQuestions.mockResolvedValue([
      ...solvedSlugs.slice(0, 9).map((slug) => findQuestion(slug)!.question),
      ...(operationQuestion ? [operationQuestion, operationQuestion] : [])
    ]);

    const response = await POST(
      new NextRequest("http://localhost/api/interview/dsa/start", { method: "POST" })
    );

    expect(response.status).toBe(409);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
