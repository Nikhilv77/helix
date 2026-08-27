import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  setHelp: vi.fn(),
  setTeacher: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/server/interview/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    notificationService: {
      setHelpNotifications: mocks.setHelp,
      setTeacherNotifications: mocks.setTeacher
    }
  })
}));

import { PUT } from "./route";

describe("PUT /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.setHelp.mockResolvedValue(undefined);
    mocks.setTeacher.mockResolvedValue(undefined);
  });

  it("requires authentication and at least one known preference", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null });
    expect((await PUT(request({ teacherNotificationsEnabled: false }))).status).toBe(401);
    expect((await PUT(request({}))).status).toBe(400);
    expect((await PUT(request({ unknown: true }))).status).toBe(400);
  });

  it("updates teacher coaching without changing peer-help delivery", async () => {
    const response = await PUT(request({ teacherNotificationsEnabled: false }));

    expect(response.status).toBe(200);
    expect(mocks.setTeacher).toHaveBeenCalledWith("owner-1", false);
    expect(mocks.setHelp).not.toHaveBeenCalled();
  });

  it("can update both optional channels together", async () => {
    const response = await PUT(
      request({ teacherNotificationsEnabled: true, helpNotificationsEnabled: false })
    );

    expect(response.status).toBe(200);
    expect(mocks.setTeacher).toHaveBeenCalledWith("owner-1", true);
    expect(mocks.setHelp).toHaveBeenCalledWith("owner-1", false);
  });
});

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/notifications/preferences", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
