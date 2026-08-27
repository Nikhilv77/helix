import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  profile: vi.fn(),
  attempt: vi.fn(),
  enforce: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/server/interview/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { answerEvaluation: { namespace: "test" } },
  getSharedGuard: () => ({ enforce: mocks.enforce })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { practiceNonDsaEnabled: true },
    profileService: { get: mocks.profile },
    prepPracticeService: { attempt: mocks.attempt }
  })
}));

import { POST } from "./route";

describe("POST /api/practice/attempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.profile.mockResolvedValue({ onboardingCompletedAt: new Date() });
    mocks.attempt.mockResolvedValue({ recorded: true, replayed: false, status: "COMPLETED" });
  });

  it("rejects unauthenticated writes before touching Practice", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(mocks.attempt).not.toHaveBeenCalled();
  });

  it("validates and rate-limits an idempotent candidate attempt", async () => {
    const body = {
      requestId: "00000000-0000-4000-8000-000000000001",
      sessionKey: "core-technical",
      questionId: "frontend-react-keys-state-identity",
      action: "submit",
      answer: "Stable keys preserve identity across reconciliation.",
      selectedOptionIndex: null,
      durationMs: 12_000
    };
    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(mocks.enforce).toHaveBeenCalledWith(expect.anything(), "owner-1");
    expect(mocks.attempt).toHaveBeenCalledWith("owner-1", body);
  });

  it("rejects malformed session identities", async () => {
    const response = await POST(
      request({
        requestId: "00000000-0000-4000-8000-000000000001",
        sessionKey: "frontend-dsa",
        questionId: "question",
        action: "submit"
      })
    );
    expect(response.status).toBe(400);
    expect(mocks.attempt).not.toHaveBeenCalled();
  });

  it("rejects manual completion without an evaluated submission", async () => {
    const response = await POST(
      request({
        requestId: "00000000-0000-4000-8000-000000000001",
        sessionKey: "core-technical",
        questionId: "frontend-react-keys-state-identity",
        action: "complete",
        answer: ""
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.attempt).not.toHaveBeenCalled();
  });
});

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/practice/attempt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
