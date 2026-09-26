import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemorySharedGuardBackend, SharedGuard } from "@/server/rate-limit/shared-guard";
import { rememberAcceptedRun } from "@/features/practice/dsa/server/accepted-run";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  review: vi.fn(),
  guard: { current: null as unknown }
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/features/interviews/server/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/server/rate-limit/shared-guard", async (original) => ({
  ...(await original<typeof import("@/server/rate-limit/shared-guard")>()),
  getSharedGuard: () => mocks.guard.current
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({ config: {}, dsaPracticeFeedbackService: { review: mocks.review } })
}));

import { POST } from "./route";

const code = "function twoSum(nums, target) { return [0, 1]; }";
const feedback = {
  headline: "Clean single pass",
  markdown: "### What you did well\nGood.\n\n### One thing to remember\nCheck first.",
  voiceScript: "Nice work. What if the array were sorted?",
  followUp: "What if the array were sorted?",
  highlight: { startLine: 1, endLine: 1 }
};

describe("POST /api/dsa/practice-feedback", () => {
  let guard: SharedGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new SharedGuard(new MemorySharedGuardBackend());
    mocks.guard.current = guard;
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.review.mockResolvedValue(feedback);
  });

  it("refuses a debrief when the runner never accepted this code, whatever the body claims", async () => {
    const response = await POST(request());

    expect(response.status).toBe(422);
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("reviews a verified solution once, then serves the saved debrief", async () => {
    await rememberAcceptedRun(guard, "owner-1", "two-sum", code);

    const first = await POST(request());
    const second = await POST(request());

    expect((await first.json()).data).toEqual(feedback);
    expect((await second.json()).data).toEqual(feedback);
    expect(mocks.review).toHaveBeenCalledOnce();
  });

  it("does not accept a verified run of different code", async () => {
    await rememberAcceptedRun(guard, "owner-1", "two-sum", "function twoSum() { return []; }");

    expect((await POST(request())).status).toBe(422);
  });
});

function request(): NextRequest {
  return new NextRequest("http://localhost/api/dsa/practice-feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: "two-sum",
      code,
      language: "javascript",
      testsPassed: 3,
      testCount: 3,
      teacherId: "pooja"
    })
  });
}
