import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeRoastResult, ResumeRoastTarget } from "@/lib/resume-roast/contracts";
import { ResumeRoastTimeoutError } from "@/server/resume-roast/resume-roast.service";

const target: ResumeRoastTarget = {
  role: "backend-engineer",
  companyEnvironment: "product-company",
  level: "senior"
};
const roast = {
  id: "11111111-1111-4111-8111-111111111111",
  target,
  result: {
    openingRoast: "The bullet has misplaced its outcome.",
    strength: {
      headline: "Useful evidence",
      explanation: "The resume gives a concrete system result.",
      evidenceAnchors: ["experience-1-achievement-1"]
    },
    problems: [],
    rewrite: null,
    verdict: {
      band: "solid",
      explanation: "The available evidence is clear.",
      targetFitScore: 76
    },
    actionPlan: [
      { priority: 1, action: "Keep the evidence clear", rationale: "It is easy to scan." }
    ]
  } satisfies ResumeRoastResult
};

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  enforce: vi.fn(),
  state: vi.fn(),
  prepare: vi.fn(),
  finishClaim: vi.fn(),
  delete: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/server/interview/owner", () => ({ authenticatedOwnerId: (id: string) => `user:${id}` }));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { resumeRoastGeneration: { namespace: "resume-roast-generate" } },
  getSharedGuard: () => ({ enforce: mocks.enforce })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    resumeRoastService: {
      state: mocks.state,
      prepare: mocks.prepare,
      finishClaim: mocks.finishClaim,
      delete: mocks.delete
    }
  })
}));

import { DELETE, GET, POST } from "./route";

describe("/api/resume-roast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "clerk-1" });
    mocks.enforce.mockResolvedValue(undefined);
    mocks.state.mockResolvedValue({
      hasResume: true,
      target: null,
      suggestedTarget: null,
      previousRoast: null
    });
    mocks.delete.mockResolvedValue(true);
    mocks.finishClaim.mockResolvedValue(roast);
  });

  it("requires authentication before touching private state", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect((await GET(request("GET"))).status).toBe(401);
    expect((await POST(request("POST", { target }))).status).toBe(401);
    expect((await DELETE(request("DELETE", { roastId: roast.id }))).status).toBe(401);
    expect(mocks.state).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("validates client input without accepting owner or persistence dimensions", async () => {
    expect((await POST(request("POST", { target: { ...target, ownerId: "other" } }))).status).toBe(
      400
    );
    expect((await POST(request("POST", { target, promptVersion: "v2" }))).status).toBe(400);
    expect((await DELETE(request("DELETE", { roastId: "not-a-uuid" }))).status).toBe(400);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("returns no-store state and derives the owner only from Clerk", async () => {
    const response = await GET(request("GET"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.state).toHaveBeenCalledWith("user:clerk-1");
  });

  it("rate-limits and streams every newly generated section", async () => {
    mocks.prepare.mockResolvedValueOnce({
      kind: "claimed",
      roastId: roast.id,
      generationToken: "22222222-2222-4222-8222-222222222222",
      target,
      snapshot: {}
    });

    const response = await POST(request("POST", { target }));

    expect(response.status).toBe(200);
    expect(mocks.enforce).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "resume-roast-generate" }),
      "user:clerk-1"
    );
    expect(mocks.prepare).toHaveBeenCalledWith("user:clerk-1", target);
    expect(eventTypes(await response.text())).toEqual([
      "session",
      "opening_roast",
      "strength",
      "verdict",
      "action_plan",
      "done"
    ]);
  });

  it("streams a sanitized terminal error when a claimed generation fails", async () => {
    mocks.prepare.mockResolvedValueOnce({
      kind: "claimed",
      roastId: roast.id,
      generationToken: "22222222-2222-4222-8222-222222222222",
      target,
      snapshot: {}
    });
    mocks.finishClaim.mockRejectedValueOnce(new Error("provider output includes private text"));

    const response = await POST(request("POST", { target }));
    expect(eventTypes(await response.text())).toEqual(["session", "error"]);
    expect(mocks.prepare).toHaveBeenCalledWith("user:clerk-1", target);
    expect(mocks.enforce).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "resume-roast-generate" }),
      "user:clerk-1"
    );
    expect(mocks.finishClaim).toHaveBeenCalledWith(
      "user:clerk-1",
      expect.objectContaining({ roastId: roast.id }),
      expect.any(AbortSignal)
    );
  });

  it("streams a distinct timeout error without exposing provider details", async () => {
    mocks.prepare.mockResolvedValueOnce({
      kind: "claimed",
      roastId: roast.id,
      generationToken: "22222222-2222-4222-8222-222222222222",
      target,
      snapshot: {}
    });
    mocks.finishClaim.mockRejectedValueOnce(new ResumeRoastTimeoutError());

    const response = await POST(request("POST", { target }));
    const body = await response.text();
    expect(eventTypes(body)).toEqual(["session", "error"]);
    expect(body).toContain('"code":"timeout"');
    expect(body).not.toContain("gemini");
  });

  it("aborts an interrupted claimed stream and does not enqueue a completion", async () => {
    mocks.prepare.mockResolvedValueOnce({
      kind: "claimed",
      roastId: roast.id,
      generationToken: "22222222-2222-4222-8222-222222222222",
      target,
      snapshot: {}
    });
    const captured = { signal: null as AbortSignal | null };
    mocks.finishClaim.mockImplementationOnce(
      (_owner: string, _claim: unknown, passedSignal: AbortSignal) => {
        captured.signal = passedSignal;
        return new Promise(() => undefined);
      }
    );

    const response = await POST(request("POST", { target }));
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: session");
    await reader.cancel();

    expect(captured.signal?.aborted).toBe(true);
    expect(mocks.finishClaim).toHaveBeenCalledTimes(1);
  });

  it("forwards a pre-aborted request signal and emits no personalized completion", async () => {
    mocks.prepare.mockResolvedValueOnce({
      kind: "claimed",
      roastId: roast.id,
      generationToken: "22222222-2222-4222-8222-222222222222",
      target,
      snapshot: {}
    });
    const controller = new AbortController();
    controller.abort();

    const response = await POST(request("POST", { target }, controller.signal));
    expect(mocks.finishClaim).toHaveBeenCalledWith(
      "user:clerk-1",
      expect.objectContaining({ roastId: roast.id }),
      expect.objectContaining({ aborted: true })
    );
    expect(eventTypes(await response.text())).toEqual([]);
  });

  it("enforces generation quota before creating a history row", async () => {
    mocks.enforce.mockRejectedValueOnce(new Error("limited"));

    const response = await POST(request("POST", { target }));

    expect(response.status).toBe(503);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.finishClaim).not.toHaveBeenCalled();
  });

  it("deletes only through the authenticated owner-scoped service", async () => {
    const response = await DELETE(request("DELETE", { roastId: roast.id }));

    expect(response.status).toBe(200);
    expect(mocks.delete).toHaveBeenCalledWith("user:clerk-1", roast.id);
  });
});

function request(method: string, body?: unknown, signal?: AbortSignal): NextRequest {
  return new NextRequest("http://localhost/api/resume-roast", {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {})
        })
  });
}

function eventTypes(stream: string): string[] {
  return Array.from(stream.matchAll(/^event: ([^\n]+)$/gm), (match) => match[1]!);
}
