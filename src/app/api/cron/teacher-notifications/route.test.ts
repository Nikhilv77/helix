import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchDaily: vi.fn(),
  secret: "1234567890abcdef"
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { cronSecret: mocks.secret },
    teacherNotificationService: { dispatchDaily: mocks.dispatchDaily }
  })
}));

import { GET } from "./route";

describe("GET /api/cron/teacher-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dispatchDaily.mockResolvedValue({ candidates: 2, recorded: 3, failed: 0 });
  });

  it("rejects calls without the scheduler bearer token", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.dispatchDaily).not.toHaveBeenCalled();
  });

  it("runs the bounded daily dispatch for an authenticated scheduler", async () => {
    const response = await GET(request(`Bearer ${mocks.secret}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { candidates: 2, recorded: 3, failed: 0 }
    });
    expect(mocks.dispatchDaily).toHaveBeenCalledTimes(1);
  });
});

function request(authorization?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/teacher-notifications", {
    headers: authorization ? { authorization } : undefined
  });
}
