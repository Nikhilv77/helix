import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  history: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/server/interview/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({ helpHistoryService: { history: mocks.history } })
}));

import { GET } from "./route";

describe("GET /api/help/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.history.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null });

    expect((await GET(request())).status).toBe(401);
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("validates filters and scopes the query to the authenticated owner", async () => {
    expect((await GET(request("?side=somebody-else"))).status).toBe(400);

    const response = await GET(request("?side=given&status=resolved&limit=5"));
    expect(response.status).toBe(200);
    expect(mocks.history).toHaveBeenCalledWith({
      ownerId: "owner-1",
      side: "given",
      filter: "resolved",
      cursor: null,
      limit: 5
    });
  });
});

function request(search = ""): NextRequest {
  return new NextRequest(`http://localhost/api/help/history${search}`);
}
