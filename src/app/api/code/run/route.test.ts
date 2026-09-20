import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  enforce: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  dsaTransfer: vi.fn(),
  coreTransfer: vi.fn(),
  runCore: vi.fn(),
  recordExecution: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/features/interviews/server/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { codeExecution: { namespace: "test" } },
  getSharedGuard: () => ({ enforce: mocks.enforce, acquire: mocks.acquire })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    dsaBlockAssessmentRuntimeService: { frozenTransferForRun: mocks.dsaTransfer },
    coreTechnicalAssessmentRuntimeService: { frozenTransferForRun: mocks.coreTransfer },
    coreTechnicalRunnerService: { run: mocks.runCore },
    interviewService: { recordCodeExecution: mocks.recordExecution }
  })
}));

import { POST } from "./route";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("POST /api/code/run Core Technical assessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.acquire.mockResolvedValue({ release: mocks.release });
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
