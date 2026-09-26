import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  enforceAndAcquire: vi.fn(),
  release: vi.fn(),
  dsaTransfer: vi.fn(),
  coreTransfer: vi.fn(),
  runCore: vi.fn(),
  recordExecution: vi.fn(),
  setCached: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn()
}));
vi.mock("@/features/interviews/server/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { codeExecution: { namespace: "test" } },
  getSharedGuard: () => ({ enforceAndAcquire: mocks.enforceAndAcquire, setCached: mocks.setCached })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { rapidApiKey: "key", rapidApiHost: "judge0.test", judge0Url: "https://judge0.test" },
    dsaBlockAssessmentRuntimeService: { frozenTransferForRun: mocks.dsaTransfer },
    coreTechnicalAssessmentRuntimeService: { frozenTransferForRun: mocks.coreTransfer },
    coreTechnicalRunnerService: { run: mocks.runCore },
    interviewService: { recordCodeExecution: mocks.recordExecution }
  })
}));

import { buildTestCases, resultMarker } from "@/features/practice/dsa/server/code-test-harness";
import { findQuestion } from "@/features/practice/dsa/domain/dsa";
import { POST } from "./route";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("POST /api/code/run Core Technical assessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.enforceAndAcquire.mockResolvedValue({ release: mocks.release });
    mocks.dsaTransfer.mockResolvedValue(null);
    mocks.coreTransfer.mockResolvedValue({
      kind: "core-technical",
      slug: "core-technical-transfer-repair",
      question: { key: "frozen-question" }
    });
    mocks.runCore.mockResolvedValue({
      accepted: true,
      status: "accepted",
      publicTests: [{ name: "public", input: "visible", expected: "true", passed: true }],
      hiddenTests: { passed: 1, total: 1 },
      durationMs: 20,
      peakMemoryMb: 8
    });
  });

  it("uses the isolated Core runner without requiring Judge0 and redacts hidden cases", async () => {
    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.runCore).toHaveBeenCalledWith(
      { key: "frozen-question" },
      "export function repair() { return true; }"
    );
    expect(payload.data.tests).toEqual([
      expect.objectContaining({ visible: true, input: "visible", expectedOutput: "true" }),
      expect.objectContaining({ visible: false, input: "", expectedOutput: "", actualOutput: "" })
    ]);
    expect(mocks.recordExecution).toHaveBeenCalledWith(
      "owner-1",
      SESSION_ID,
      3,
      expect.objectContaining({ accepted: true, testsPassed: 2, testCount: 2 })
    );
  });

  it("rejects non-JavaScript languages before running the frozen question", async () => {
    const response = await POST(request("python"));

    expect(response.status).toBe(422);
    expect(mocks.runCore).not.toHaveBeenCalled();
  });
});

describe("POST /api/code/run standalone DSA practice", () => {
  const code = "function twoSum(nums, target) { return [0, 1]; }";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.enforceAndAcquire.mockResolvedValue({ release: mocks.release });
    mocks.setCached.mockResolvedValue(undefined);
  });

  function judge(passing: boolean) {
    const cases = buildTestCases(findQuestion("two-sum")!.question.examples!, "two-sum");
    const stdout = cases
      .map((testCase, index) =>
        passing
          ? `${resultMarker()}${index}:${JSON.stringify({ ok: true, value: testCase.expectedValue })}`
          : `${resultMarker()}${index}:${JSON.stringify({ ok: true, value: "wrong" })}`
      )
      .join("\n");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          stdout: Buffer.from(stdout).toString("base64"),
          status: { description: "Accepted" }
        })
      )
    );
  }

  it("records a verified acceptance before responding so the debrief can trust it", async () => {
    judge(true);
    const response = await POST(dsaRequest(code));

    expect((await response.json()).data.accepted).toBe(true);
    expect(mocks.setCached).toHaveBeenCalledWith(
      "dsa-accepted-run",
      expect.stringMatching(/^owner-1:two-sum:[a-f0-9]{64}$/),
      true,
      expect.any(Number)
    );
    vi.unstubAllGlobals();
  });

  it("records nothing for a failing run", async () => {
    judge(false);
    const response = await POST(dsaRequest(code));

    expect((await response.json()).data.accepted).toBe(false);
    expect(mocks.setCached).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

function dsaRequest(code: string): NextRequest {
  return new NextRequest("http://localhost/api/code/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requestId: "22222222-2222-4222-8222-222222222222",
      code,
      language: "javascript",
      slug: "two-sum"
    })
  });
}

function request(language = "javascript"): NextRequest {
  return new NextRequest("http://localhost/api/code/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: "export function repair() { return true; }",
      language,
      stdin: "",
      sessionId: SESSION_ID,
      questionIndex: 3
    })
  });
}
