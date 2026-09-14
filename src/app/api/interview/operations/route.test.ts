import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "operator-1" as string | null,
  operator: true,
  dashboard: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: mocks.userId }))
}));

vi.mock("@/features/interviews/server/interview-operations-access", () => ({
  canViewInterviewOperations: vi.fn(() => mocks.operator)
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { interviewOperationsAdminUserId: "operator-1" },
    interviewOperationsService: { dashboard: mocks.dashboard }
  })
}));

import { GET } from "./route";

describe("GET /api/interview/operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userId = "operator-1";
    mocks.operator = true;
    mocks.dashboard.mockResolvedValue({
      generatedAt: "2026-09-14T12:00:00.000Z",
      sessions: { total: 4 },
      alerts: []
    });
  });

  it("returns 404 without revealing the operations endpoint to non-operators", async () => {
    mocks.operator = false;

    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });

  it("returns aggregate dashboard data and forwards the requested window", async () => {
    const response = await GET(request("?hours=72"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.dashboard).toHaveBeenCalledWith(72);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        generatedAt: "2026-09-14T12:00:00.000Z",
        sessions: { total: 4 },
        alerts: []
      }
    });
  });

  it("uses the safe default window for a malformed query", async () => {
    await GET(request("?hours=not-a-number"));

    expect(mocks.dashboard).toHaveBeenCalledWith(24);
  });
});

function request(search = ""): NextRequest {
  return new NextRequest(`http://localhost/api/interview/operations${search}`);
}
