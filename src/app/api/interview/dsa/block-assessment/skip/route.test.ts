import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  enforce: vi.fn(),
  skip: vi.fn()
}));

vi.mock("@/server/interview/session-access", () => ({
  authorizeInterviewSession: mocks.authorize
}));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { answerEvaluation: { namespace: "test" } },
  getSharedGuard: () => ({ enforce: mocks.enforce })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    interviewService: { skipBlockAssessmentCodeOwned: mocks.skip },
    dsaBlockAssessmentFinalizationService: { finalizeOwned: vi.fn() }
  })
}));

import { POST } from "./route";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";

describe("POST /api/interview/dsa/block-assessment/skip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ kind: "owner", ownerId: "owner-1" });
    mocks.skip.mockResolvedValue({
      response: {
        action: "move_on",
        utterance: "Marked as skipped.",
        missing: "specificity",
        forcedBy: null,
        phase: "questioning",
        questionIndex: 7,
        questionCount: 8,
        followUpCount: 0,
        elapsedMs: 2_000
      }
    });
  });

  it("records the owner-scoped skip with its idempotency key", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith(expect.anything(), {}, SESSION_ID, "answer");
    expect(mocks.skip).toHaveBeenCalledWith(
      "owner-1",
      SESSION_ID,
      { startMs: 1_000, endMs: 2_000 },
      expect.any(Number),
      TURN_ID
    );
  });

  it("does not allow a voice-worker capability to invoke the candidate skip", async () => {
    mocks.authorize.mockResolvedValue({ kind: "agent" });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.skip).not.toHaveBeenCalled();
  });

  it("rejects malformed skip requests before mutating the session", async () => {
    const response = await POST(request({ sessionId: "not-a-uuid" }));

    expect(response.status).toBe(400);
    expect(mocks.skip).not.toHaveBeenCalled();
  });
});

function request(
  body: unknown = { sessionId: SESSION_ID, turnId: TURN_ID, startMs: 1_000, endMs: 2_000 }
): NextRequest {
  return new NextRequest("http://localhost/api/interview/dsa/block-assessment/skip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
