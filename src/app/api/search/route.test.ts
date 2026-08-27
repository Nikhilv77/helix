import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  enforce: vi.fn(),
  search: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/server/interview/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { workspaceSearch: { namespace: "test" } },
  getSharedGuard: () => ({ enforce: mocks.enforce })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    workspaceSearchService: { search: mocks.search }
  })
}));

import { GET } from "./route";

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.search.mockResolvedValue({ query: "array", results: [] });
  });

  it("rejects unauthenticated search before querying private records", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const response = await GET(request("array"));

    expect(response.status).toBe(401);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("rejects missing and oversized queries", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("x".repeat(81)))).status).toBe(400);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("rate-limits and searches with the authenticated owner only", async () => {
    const response = await GET(request("array"));

    expect(response.status).toBe(200);
    expect(mocks.enforce).toHaveBeenCalledWith(expect.anything(), "owner-1");
    expect(mocks.search).toHaveBeenCalledWith("owner-1", "array");
  });
});

function request(query: string): NextRequest {
  const params = new URLSearchParams({ q: query });
  return new NextRequest(`http://localhost/api/search?${params.toString()}`);
}
