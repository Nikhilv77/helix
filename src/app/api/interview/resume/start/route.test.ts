import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOwner: vi.fn(),
  enforce: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  findActive: vi.fn(),
  getProfile: vi.fn(),
  ensureKit: vi.fn(),
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
    resumeInterviewKitService: { ensure: mocks.ensureKit },
    interviewService: {
      start: mocks.start,
      findOwnedActiveByTemplate: mocks.findActive
    }
  })
}));

import { POST } from "./route";

describe("POST /api/interview/resume/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOwner.mockResolvedValue({ ownerId: "user:test" });
    mocks.acquire.mockResolvedValue({ release: mocks.release });
  });

  it("returns the unfinished resume interview without rebuilding or consuming quota", async () => {
    mocks.findActive.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      plan: [{ text: "Current question" }, { text: "Next question" }],
      turns: [{ speaker: "agent", text: "Current question" }]
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/resume/start", { method: "POST" })
    );

    await expect(response.json()).resolves.toMatchObject({
      data: {
        sessionId: "33333333-3333-4333-8333-333333333333",
        questionCount: 2
      }
    });
    expect(mocks.enforce).not.toHaveBeenCalled();
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.ensureKit).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
  });
});
