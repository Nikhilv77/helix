import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOwner: vi.fn(),
  enforce: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  getProfile: vi.fn(),
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
    interviewService: { start: mocks.start }
  })
}));

import { POST } from "./route";

describe("POST /api/interview/hiring-manager/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOwner.mockResolvedValue({ ownerId: "user:test" });
    mocks.acquire.mockResolvedValue({ release: mocks.release });
    mocks.getProfile.mockResolvedValue({
      targetRole: "backend",
      level: "3-5",
      targetCompany: "Acme",
      resume: {
        experience: [{ role: "Senior Engineer", organization: "Northstar" }],
        projects: [{ name: "Ledger Guard" }]
      }
    });
    mocks.start.mockImplementation(async (_setup, _ownerId, _now, plan) => ({
      state: { id: "11111111-1111-4111-8111-111111111111", plan },
      utterance: "Welcome"
    }));
  });

  it("freezes a resume- and target-job-personalized eight-question plan", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/interview/hiring-manager/start", { method: "POST" })
    );

    expect(response.status).toBe(200);
    expect(mocks.start).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "backend",
        level: "3-5",
        roundType: "hiring-manager",
        context: expect.stringContaining("Backend Engineer role at Acme")
      }),
      "user:test",
      expect.any(Number),
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("Senior Engineer at Northstar") }),
        expect.objectContaining({ text: expect.stringContaining("Ledger Guard") }),
        expect.objectContaining({ requiredForPacing: true })
      ])
    );
    await expect(response.json()).resolves.toMatchObject({
      data: { questionCount: 8 }
    });
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
