import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  coreAttempt: vi.fn(async () => Response.json({ handler: "core-attempt" })),
  appliedRun: vi.fn(async () => Response.json({ handler: "applied-run" })),
  architectureStart: vi.fn(async () => Response.json({ handler: "architecture-start" }))
}));

vi.mock("../../core-technical/attempt/handler", () => ({ POST: mocks.coreAttempt }));
vi.mock("../../applied-engineering/run/handler", () => ({ POST: mocks.appliedRun }));
vi.mock("../../architecture-design/assessment/start/handler", () => ({
  POST: mocks.architectureStart
}));

import { POST } from "./route";

describe("consolidated practice action route", () => {
  it.each([
    ["core-technical", ["attempt"], "core-attempt", mocks.coreAttempt],
    ["applied-engineering", ["run"], "applied-run", mocks.appliedRun],
    [
      "architecture-design",
      ["assessment", "start"],
      "architecture-start",
      mocks.architectureStart
    ]
  ])("dispatches %s/%s without changing its public URL", async (track, action, name, handler) => {
    const request = new NextRequest(
      `http://localhost/api/practice/${track}/${(action as string[]).join("/")}`,
      { method: "POST" }
    );

    const response = await POST(request, {
      params: Promise.resolve({ track: track as string, action: action as string[] })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ handler: name });
    expect(handler).toHaveBeenCalledWith(request);
  });

  it("returns 404 for actions that are not explicitly registered", async () => {
    const request = new NextRequest(
      "http://localhost/api/practice/architecture-design/run",
      { method: "POST" }
    );

    const response = await POST(request, {
      params: Promise.resolve({ track: "architecture-design", action: ["run"] })
    });

    expect(response.status).toBe(404);
  });
});
