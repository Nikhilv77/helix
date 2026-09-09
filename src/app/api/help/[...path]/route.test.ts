import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestGet: vi.fn(async () => Response.json({ handler: "request-get" })),
  requestPost: vi.fn(async () => Response.json({ handler: "request-post" })),
  requestDelete: vi.fn(async () => Response.json({ handler: "request-delete" })),
  requestIdPost: vi.fn(async () => Response.json({ handler: "request-id-post" })),
  roomGet: vi.fn(async () => Response.json({ handler: "room-get" })),
  roomPut: vi.fn(async () => Response.json({ handler: "room-put" }))
}));

vi.mock("../request/handler", () => ({
  GET: mocks.requestGet,
  POST: mocks.requestPost,
  DELETE: mocks.requestDelete
}));
vi.mock("../request/[id]/handler", () => ({ POST: mocks.requestIdPost }));
vi.mock("../room/[id]/handler", () => ({ GET: mocks.roomGet, PUT: mocks.roomPut }));

import { DELETE, GET, POST, PUT } from "./route";

describe("consolidated help route", () => {
  it.each([
    [GET, "GET", ["request"], mocks.requestGet],
    [POST, "POST", ["request"], mocks.requestPost],
    [DELETE, "DELETE", ["request"], mocks.requestDelete]
  ])("dispatches %s /%s", async (route, method, path, handler) => {
    const request = makeRequest(method as string, path as string[]);
    const response = await route(request, context(path as string[]));

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(request);
  });

  it.each([
    [POST, "POST", ["request", "request-1"], mocks.requestIdPost],
    [GET, "GET", ["room", "request-1"], mocks.roomGet],
    [PUT, "PUT", ["room", "request-1"], mocks.roomPut]
  ])("passes dynamic ids through %s /%s", async (route, method, path, handler) => {
    const request = makeRequest(method as string, path as string[]);
    const response = await route(request, context(path as string[]));

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ params: expect.any(Promise) })
    );
    await expect(handler.mock.calls.at(-1)?.[1].params).resolves.toEqual({ id: "request-1" });
  });

  it("returns 404 for an unknown help path", async () => {
    const path = ["unknown"];
    const response = await GET(makeRequest("GET", path), context(path));
    expect(response.status).toBe(404);
  });
});

function context(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

function makeRequest(method: string, path: string[]) {
  return new NextRequest(`http://localhost/api/help/${path.join("/")}`, { method });
}
