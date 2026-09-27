import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  saveImages: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/features/interviews/server/owner", () => ({
  authenticatedOwnerId: (id: string) => `user:${id}`
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({ profileService: { saveImages: mocks.saveImages } })
}));

import { PUT } from "./route";

function put(body: unknown) {
  return new NextRequest("http://localhost/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("PUT /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "clerk-1" });
    mocks.saveImages.mockResolvedValue({ profileImage: "/images/profile/avatars/avatar-02.jpg" });
  });

  it("saves only the images, ignoring role, level and other profile fields", async () => {
    const response = await PUT(
      put({
        targetRole: "pm",
        level: "5-plus",
        headline: "Changed by a crafted request",
        stories: [],
        coverImage: "/images/profile/covers/cover-3.png",
        profileImage: "/images/profile/avatars/avatar-02.jpg"
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.saveImages).toHaveBeenCalledWith("user:clerk-1", {
      coverImage: "/images/profile/covers/cover-3.png",
      profileImage: "/images/profile/avatars/avatar-02.jpg"
    });
  });

  it("rejects an image outside the provided set", async () => {
    const response = await PUT(put({ profileImage: "https://example.com/me.png" }));
    expect(response.status).toBe(400);
    expect(mocks.saveImages).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await PUT(put({ coverImage: null }))).status).toBe(401);
  });
});
