import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOwner: vi.fn(),
  enforce: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  findActive: vi.fn(),
  getProfile: vi.fn(),
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

describe("POST /api/interview/design/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOwner.mockResolvedValue({ ownerId: "user:test" });
    mocks.acquire.mockResolvedValue({ release: mocks.release });
    mocks.findActive.mockResolvedValue(null);
    mocks.getProfile.mockResolvedValue({
      targetRole: "backend",
      level: "3-5"
    });
    mocks.history.mockResolvedValue([]);
    mocks.confirmFocus.mockResolvedValue({ focusFingerprint: "focus:test" });
    mocks.rankFirstScenario.mockReturnValue({
      selectedScenario: {
        scenarioKey: "global-media-processing",
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
      utterance: "Claire opens the design interview."
    }));
  });

  it("starts a dedicated five-act System Design interview", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/interview/design/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    const [setup, ownerId, , plan] = mocks.start.mock.calls[0]!;
    expect(ownerId).toBe("user:test");
    expect(setup).toMatchObject({
      templateId: "system-design",
      templateTitle: "System Design Interview",
      durationMinutes: 45,
      questionCount: 5,
      dsaDesignRound: {
        kind: "dsa-design-round",
        designScenarioKey: "global-media-processing"
      }
    });
    expect(plan).toHaveLength(5);
    expect(
      plan.map((question: { interviewSection?: string }) => question.interviewSection)
    ).toEqual(["design", "design", "design", "design", "design"]);
    expect(plan[0]?.text).toContain("Begin by asking me");
    expect(JSON.stringify(await response.json())).not.toContain("expectedAnswer");
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("resumes only an active System Design session", async () => {
    mocks.findActive.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      plan: [{ text: "Continue the design" }],
      turns: [{ speaker: "agent", action: "intro", text: "Welcome back." }]
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/design/start", { method: "POST" })
    );
    await expect(response.json()).resolves.toMatchObject({
      data: {
        sessionId: "22222222-2222-4222-8222-222222222222",
        questionCount: 1,
        utterance: "Welcome back."
      }
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
