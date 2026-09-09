import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionBlueprint } from "@/features/interviews/domain/personalized-plan";

const mocks = vi.hoisted(() => ({
  resolveOwner: vi.fn(),
  enforce: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  selectTechnicalSources: vi.fn(),
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
    personalizedInterviewPlanningService: {
      technicalDeepDiveBlueprints: mocks.selectTechnicalSources,
      blueprint: vi.fn()
    },
    interviewService: { start: mocks.start }
  })
}));

import { POST } from "./handler";

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const CORE_ID = "22222222-2222-4222-8222-222222222222";
const APPLIED_ID = "33333333-3333-4333-8333-333333333333";

function blueprint(id: string, kind: "core-technical" | "applied-engineering"): SessionBlueprint {
  const label = kind === "core-technical" ? "Runtime" : "Production";
  return {
    id,
    kind,
    order: kind === "core-technical" ? 2 : 3,
    title: label,
    subtitle: `${label} depth`,
    durationMinutes: 30,
    difficulty: "intermediate",
    rationale: `Prioritize ${label}.`,
    topics: [
      {
        key: label.toLowerCase(),
        label,
        targetPercent: 100,
        skillKeys: [label.toLowerCase()],
        objectives: [`Explain a ${label} decision`]
      }
    ],
    structure: [{ kind: "core", questionCount: 2, formats: ["spoken"], purpose: `Test ${label}.` }],
    followUpPolicy: {
      maxPerQuestion: 1,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: [
      {
        key: `${label.toLowerCase()}-depth`,
        label: `${label} depth`,
        weightPercent: 100,
        strongSignals: ["Explains the mechanism"],
        weakSignals: ["Only names a tool"]
      }
    ]
  };
}

describe("POST /api/interview/start Technical Deep Dive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOwner.mockResolvedValue({ ownerId: "user:test" });
    mocks.acquire.mockResolvedValue({ release: mocks.release });
    mocks.selectTechnicalSources.mockResolvedValue({
      plan: {
        id: PLAN_ID,
        sourceSnapshot: { targetRole: { family: "fullstack" } }
      },
      coreBlueprint: blueprint(CORE_ID, "core-technical"),
      appliedBlueprint: blueprint(APPLIED_ID, "applied-engineering")
    });
    mocks.start.mockResolvedValue({
      state: {
        id: "44444444-4444-4444-8444-444444444444",
        phase: "intro",
        plan: [{}, {}, {}, {}],
        questionIndex: 0,
        startedAt: 100
      },
      utterance: "Welcome."
    });
  });

  it("resolves both active source blueprints and starts one trusted four-question round", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.selectTechnicalSources).toHaveBeenCalledWith(
      "user:test",
      CORE_ID,
      APPLIED_ID,
      PLAN_ID
    );
    expect(mocks.start).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "fullstack",
        roundType: "technical",
        templateId: "technical-deep-dive",
        templateTitle: "Technical Deep Dive",
        durationMinutes: 25,
        personalizedPlanId: PLAN_ID,
        questionCount: 4,
        technicalDeepDive: {
          kind: "technical-deep-dive",
          coreBlueprintId: CORE_ID,
          appliedBlueprintId: APPLIED_ID,
          questionSources: [
            expect.objectContaining({ blueprintId: CORE_ID, blueprintKind: "core-technical" }),
            expect.objectContaining({
              blueprintId: APPLIED_ID,
              blueprintKind: "applied-engineering"
            }),
            expect.objectContaining({ blueprintId: CORE_ID, blueprintKind: "core-technical" }),
            expect.objectContaining({
              blueprintId: APPLIED_ID,
              blueprintKind: "applied-engineering"
            })
          ]
        },
        personalizedBlueprint: expect.objectContaining({
          title: "Technical Deep Dive",
          topics: expect.arrayContaining([
            expect.objectContaining({ label: "Core · Runtime" }),
            expect.objectContaining({ label: "Applied · Production" })
          ])
        })
      }),
      "user:test"
    );
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rejects conflicting single and combined blueprint selections", async () => {
    const response = await POST(request({ blueprintId: CORE_ID }));

    expect(response.status).toBe(400);
    expect(mocks.selectTechnicalSources).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});

function request(extra: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost/api/interview/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      role: "frontend",
      level: "3-5",
      roundType: "technical",
      intensity: "realistic",
      context: "Built and operated a production payments service.",
      planId: PLAN_ID,
      technicalDeepDive: {
        kind: "technical-deep-dive",
        coreBlueprintId: CORE_ID,
        appliedBlueprintId: APPLIED_ID
      },
      ...extra
    })
  });
}
