import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  profile: vi.fn(),
  saveState: vi.fn(),
  enforce: vi.fn(),
  stateSaveSucceeded: vi.fn(),
  stateSaveFailed: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/server/interview/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { practiceState: { namespace: "test" } },
  getSharedGuard: () => ({ enforce: mocks.enforce })
}));
vi.mock("@/server/practice/practice-telemetry", () => ({
  practiceTelemetry: {
    stateSaveSucceeded: mocks.stateSaveSucceeded,
    stateSaveFailed: mocks.stateSaveFailed
  }
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { practiceNonDsaEnabled: true },
    profileService: { get: mocks.profile },
    prepPracticeService: { saveState: mocks.saveState }
  })
}));

import { PUT } from "./route";

describe("PUT /api/practice/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.profile.mockResolvedValue({
      onboardingCompletedAt: new Date(),
      preparationOnboarding: { completedAt: Date.now() }
    });
    mocks.saveState.mockResolvedValue({ savedAt: 1, revealedHintCount: 0 });
  });

  it("records content-safe save fields, retry count, and latency", async () => {
    const response = await PUT(
      request({
        sessionKey: "core-technical",
        questionId: "frontend-react-keys-state-identity",
        retryCount: 2,
        draftAnswer: "private draft",
        note: "private note"
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.saveState).toHaveBeenCalledWith("owner-1", {
      sessionKey: "core-technical",
      questionId: "frontend-react-keys-state-identity",
      draftAnswer: "private draft",
      note: "private note"
    });
    expect(mocks.stateSaveSucceeded).toHaveBeenCalledWith({
      ownerId: "owner-1",
      sessionKey: "core-technical",
      questionId: "frontend-react-keys-state-identity",
      changedFields: ["draftAnswer", "note"],
      retryCount: 2,
      durationMs: expect.any(Number)
    });
    expect(JSON.stringify(mocks.stateSaveSucceeded.mock.calls)).not.toContain("private draft");
  });

  it("emits the failure signal when the state service is unavailable", async () => {
    const outage = new Error("database unavailable");
    mocks.saveState.mockRejectedValue(outage);
    const response = await PUT(
      request({
        sessionKey: "core-technical",
        questionId: "frontend-react-keys-state-identity",
        draftAnswer: "private draft"
      })
    );

    expect(response.status).toBe(500);
    expect(mocks.stateSaveFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "owner-1",
        changedFields: ["draftAnswer"],
        retryCount: 0,
        durationMs: expect.any(Number),
        error: outage
      })
    );
  });
});

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/practice/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
