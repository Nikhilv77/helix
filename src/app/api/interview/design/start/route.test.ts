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
  designEligibility: vi.fn(),
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
      eligibility: { forProfile: mocks.designEligibility },
      focus: { confirm: mocks.confirmFocus },
      ranking: { rankFirstScenario: vi.fn() },
      interviewRanking: { rankFirstScenario: mocks.rankFirstScenario }
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
    mocks.designEligibility.mockResolvedValue({ available: false });
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

  it("does not launch a generic backend design scenario for an AI/ML candidate", async () => {
    mocks.getProfile.mockResolvedValue({ targetRole: "ai-ml", level: "0-2" });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/design/start", { method: "POST" })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AI_ML_DESIGN_CONTENT_UNAVAILABLE" }
    });
    expect(mocks.confirmFocus).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("starts the reviewed AI/ML scenario through the shared System Design interview", async () => {
    mocks.getProfile.mockResolvedValue({ targetRole: "ai-ml", level: "3-5" });
    mocks.designEligibility.mockResolvedValue({ available: true });
    mocks.rankFirstScenario.mockReturnValue({
      selectedScenario: {
        scenarioKey: "retrieval-augmented-support-assistant",
        scenarioVersion: 1,
        difficulty: "standard"
      }
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/design/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    const [setup, ownerId, , plan] = mocks.start.mock.calls[0]!;
    expect(ownerId).toBe("user:test");
    expect(setup).toMatchObject({
      role: "ai-ml",
      dsaDesignRound: {
        designScenarioKey: "retrieval-augmented-support-assistant"
      }
    });
    expect(plan).toHaveLength(5);
    expect(plan[0]?.text).toContain("customer-support assistant");
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("starts a frontend System Design interview about the client, preferring interview-only scenarios", async () => {
    mocks.getProfile.mockResolvedValue({ targetRole: "frontend", level: "3-5" });
    mocks.rankFirstScenario.mockReturnValue({
      selectedScenario: {
        scenarioKey: "realtime-chat-web-client",
        scenarioVersion: 1,
        difficulty: "standard"
      }
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/design/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    // The first attempt excludes every Practice-path scenario, so an unseen
    // interview-only scenario wins when one exists.
    const [, firstContext] = mocks.rankFirstScenario.mock.calls[0]!;
    expect(firstContext.recentScenarioKeys).toContain("infinite-social-feed-client");
    expect(firstContext.recentScenarioKeys).not.toContain("realtime-chat-web-client");
    const [setup, , , plan] = mocks.start.mock.calls[0]!;
    expect(setup).toMatchObject({
      role: "frontend",
      agenda: expect.arrayContaining(["Sketch the client architecture"]),
      dsaDesignRound: { designScenarioKey: "realtime-chat-web-client" }
    });
    expect(plan[1]?.text).toContain("client architecture");
    expect(plan[1]?.mustHit).toContain("component boundaries and state ownership");
    expect(plan[3]?.text).toContain("what the user sees");
  });

  it("starts a data System Design interview about the pipeline", async () => {
    mocks.getProfile.mockResolvedValue({ targetRole: "data", level: "3-5" });
    mocks.rankFirstScenario.mockReturnValue({
      selectedScenario: {
        scenarioKey: "realtime-fraud-feature-pipeline",
        scenarioVersion: 1,
        difficulty: "standard"
      }
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/design/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    const [, firstContext] = mocks.rankFirstScenario.mock.calls[0]!;
    expect(firstContext.recentScenarioKeys).toContain("clickstream-analytics-pipeline");
    expect(firstContext.recentScenarioKeys).not.toContain("realtime-fraud-feature-pipeline");
    const [setup, , , plan] = mocks.start.mock.calls[0]!;
    expect(setup).toMatchObject({
      role: "data",
      agenda: expect.arrayContaining(["Sketch the pipeline and table design"]),
      dsaDesignRound: { designScenarioKey: "realtime-fraud-feature-pipeline" }
    });
    expect(setup.context).toContain("the pipeline and its tables are the system under design");
    expect(plan[0]?.text).toContain("fraud");
    expect(plan[1]?.mustHit).toContain("data contracts and stable record identity");
    expect(plan[3]?.text).toContain("how the data is corrected afterwards");
  });

  it("refuses a scenario from another role's path", async () => {
    mocks.getProfile.mockResolvedValue({ targetRole: "data", level: "3-5" });
    mocks.rankFirstScenario.mockReturnValue({
      selectedScenario: {
        scenarioKey: "infinite-social-feed-client",
        scenarioVersion: 1,
        difficulty: "standard"
      }
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/design/start", { method: "POST" })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DESIGN_SCENARIO_ROLE_MISMATCH" }
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("refuses System Design for a role without scenarios", async () => {
    mocks.getProfile.mockResolvedValue({ targetRole: "pm", level: "3-5" });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/design/start", { method: "POST" })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SYSTEM_DESIGN_ROLE_UNSUPPORTED" }
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
