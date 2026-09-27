import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ResumeRoastResult,
  ResumeRoastTarget
} from "@/features/resume-roast/contracts/resume-roast";
import {
  ResumeRoastProviderRateLimitedError,
  ResumeRoastTimeoutError
} from "@/features/resume-roast/server/resume-roast.service";

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
  generationState: vi.fn(),
  delete: vi.fn(),
  scheduleAnalyticsRefresh: vi.fn(),
  refreshPage: vi.fn(),
  after: vi.fn()
}));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: mocks.after
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/features/interviews/server/owner", () => ({
  authenticatedOwnerId: (id: string) => `user:${id}`
}));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { resumeRoastGeneration: { namespace: "resume-roast-generate" } },
  getSharedGuard: () => ({ enforce: mocks.enforce })
}));
// GET reads the prepared page snapshot; its builder calls the service state.
vi.mock("@/features/resume-roast/server/resume-roast-page-data", () => ({
  loadResumeRoastPageData: async (ownerId: string) => ({ state: await mocks.state(ownerId) }),
  refreshResumeRoastPageData: mocks.refreshPage
}));
vi.mock("@/features/analytics/server/refresh-candidate-analytics", () => ({
  scheduleCandidateAnalyticsRefresh: mocks.scheduleAnalyticsRefresh
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    resumeRoastService: {
      state: mocks.state,
      prepare: mocks.prepare,
      finishClaim: mocks.finishClaim,
      generationState: mocks.generationState,
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
    mocks.refreshPage.mockResolvedValue(undefined);
    // The real prepare() runs the rate limit only when it will create a row.
    mocks.prepare.mockImplementation(
      async (_owner: string, _target: unknown, options?: { beforeGenerate?: () => Promise<void> }) => {
        await options?.beforeGenerate?.();
        return claimed;
      }
    );
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
    const response = await POST(request("POST", { target }));

    expect(response.status).toBe(200);
    expect(mocks.enforce).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "resume-roast-generate" }),
      "user:clerk-1"
    );
    expect(mocks.prepare).toHaveBeenCalledWith("user:clerk-1", target, {
      beforeGenerate: expect.any(Function)
    });
    expect(eventTypes(await response.text())).toEqual([
      "session",
      "opening_roast",
      "strength",
      "verdict",
      "action_plan",
      "done"
    ]);
  });

  it("points a second tab at the running roast without spending quota", async () => {
    const inProgress = { roastId: roast.id, target, startedAt: 1_000 };
    mocks.prepare.mockResolvedValueOnce({ kind: "joined", inProgress });

    const response = await POST(request("POST", { target }));

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({ data: { inProgress } });
    expect(mocks.enforce).not.toHaveBeenCalled();
    expect(mocks.finishClaim).not.toHaveBeenCalled();
  });

  it("streams a sanitized terminal error when a claimed generation fails", async () => {
    mocks.finishClaim.mockRejectedValueOnce(new Error("provider output includes private text"));

    const response = await POST(request("POST", { target }));
    const body = await response.text();
    expect(eventTypes(body)).toEqual(["session", "error"]);
    expect(body).toContain('"code":"generation-failed"');
    expect(body).not.toContain("private text");
  });

  it("streams a distinct timeout error without exposing provider details", async () => {
    mocks.finishClaim.mockRejectedValueOnce(new ResumeRoastTimeoutError());

    const response = await POST(request("POST", { target }));
    const body = await response.text();
    expect(eventTypes(body)).toEqual(["session", "error"]);
    expect(body).toContain('"code":"timeout"');
    expect(body).not.toContain("gemini");
  });

  it("streams a distinct provider rate-limit error", async () => {
    mocks.finishClaim.mockRejectedValueOnce(new ResumeRoastProviderRateLimitedError());

    const response = await POST(request("POST", { target }));
    expect(await response.text()).toContain('"code":"rate-limited"');
  });

  it("keeps generating after the browser disconnects, then refreshes the page", async () => {
    let finish: (value: typeof roast) => void = () => undefined;
    mocks.finishClaim.mockImplementationOnce(
      () => new Promise<typeof roast>((resolve) => (finish = resolve))
    );

    const response = await POST(request("POST", { target }));
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: session");
    await reader.cancel();

    // The generation is not tied to the request, so a disconnect can't abort it.
    expect(mocks.finishClaim).toHaveBeenCalledWith(
      "user:clerk-1",
      expect.objectContaining({ roastId: roast.id })
    );
    expect(mocks.after).toHaveBeenCalledTimes(1);
    const afterWork = (mocks.after.mock.calls[0]![0] as () => Promise<void>)();
    finish(roast);
    await afterWork;
    expect(mocks.refreshPage).toHaveBeenCalledWith("user:clerk-1");
  });

  it("still saves a roast whose request was already aborted, streaming nothing", async () => {
    const controller = new AbortController();
    controller.abort();

    const response = await POST(request("POST", { target }, controller.signal));
    expect(mocks.finishClaim).toHaveBeenCalledTimes(1);
    expect(eventTypes(await response.text())).toEqual([]);
  });

  it("refuses a roast over quota without streaming", async () => {
    mocks.enforce.mockRejectedValueOnce(new Error("limited"));

    const response = await POST(request("POST", { target }));

    expect(response.status).toBe(503);
    expect(mocks.finishClaim).not.toHaveBeenCalled();
  });

  it("reports a followed roast's status for the authenticated owner", async () => {
    mocks.generationState.mockResolvedValueOnce({ status: "failed" });

    const response = await GET(request("GET", undefined, undefined, `?roastId=${roast.id}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({ data: { status: "failed" } });
    expect(mocks.generationState).toHaveBeenCalledWith("user:clerk-1", roast.id);

    expect((await GET(request("GET", undefined, undefined, "?roastId=nope"))).status).toBe(400);
  });

  it("deletes only through the authenticated owner-scoped service", async () => {
    const response = await DELETE(request("DELETE", { roastId: roast.id }));

    expect(response.status).toBe(200);
    expect(mocks.delete).toHaveBeenCalledWith("user:clerk-1", roast.id);
    expect(mocks.scheduleAnalyticsRefresh).toHaveBeenCalledWith("user:clerk-1");
  });
});

const claimed = {
  kind: "claimed",
  roastId: roast.id,
  generationToken: "22222222-2222-4222-8222-222222222222",
  target,
  snapshot: {},
  assessment: null
};

function request(
  method: string,
  body?: unknown,
  signal?: AbortSignal,
  query = ""
): NextRequest {
  return new NextRequest(`http://localhost/api/resume-roast${query}`, {
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
