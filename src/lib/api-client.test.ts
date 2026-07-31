import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, createProject, listProjects, setAuthTokenProvider } from "./api-client";
import type { Project } from "./types";

const project: Project = {
  id: "11111111-1111-4111-8111-111111111111",
  ownerId: "user_123",
  name: "Notifications",
  description: "Design notification delivery.",
  status: "ACTIVE",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("api client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    setAuthTokenProvider(null);
    vi.unstubAllGlobals();
  });

  it("unwraps success responses and forwards typed query parameters", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [project],
          meta: { pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
          timestamp: "2026-01-01T00:00:00.000Z"
        }),
        { status: 200 }
      )
    );

    const result = await listProjects({
      page: 1,
      limit: 10,
      status: "ACTIVE",
      search: "notify",
      sortBy: "updatedAt",
      sortOrder: "desc"
    });

    expect(result.projects).toEqual([project]);
    const calledUrl = fetchMock.mock.calls[0]?.[0];
    expect(String(calledUrl)).toContain("status=ACTIVE");
    expect(String(calledUrl)).toContain("search=notify");
  });

  it("serializes request bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: project,
          meta: {},
          timestamp: "2026-01-01T00:00:00.000Z"
        }),
        { status: 201 }
      )
    );

    await createProject({ name: "Notifications", description: "Design notification delivery." });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(
      JSON.stringify({ name: "Notifications", description: "Design notification delivery." })
    );
  });

  it("maps backend error envelopes into ApiClientError", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "PROJECT_NOT_FOUND",
            message: "Project not found",
            details: { projectId: project.id }
          },
          timestamp: "2026-01-01T00:00:00.000Z",
          path: "/api/v1/projects/example"
        }),
        { status: 404 }
      )
    );

    await expect(listProjects()).rejects.toMatchObject<ApiClientError>({
      code: "PROJECT_NOT_FOUND",
      message: "Project not found",
      status: 404,
      path: "/api/v1/projects/example"
    });
  });

  it("attaches Clerk bearer tokens when a provider is registered", async () => {
    setAuthTokenProvider(async () => "session-token");
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [project],
          meta: { pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
          timestamp: "2026-01-01T00:00:00.000Z"
        }),
        { status: 200 }
      )
    );

    await listProjects();

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ Authorization: "Bearer session-token" });
  });
});
