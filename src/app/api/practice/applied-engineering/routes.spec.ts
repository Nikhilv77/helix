import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  apiError: vi.fn(),
  eligibility: vi.fn(),
  owner: vi.fn(),
  parseJson: vi.fn()
}));

vi.mock("@/app/api/practice/applied-engineering/_shared", () => ({
  apiError: mocks.apiError,
  appliedEngineeringOwner: mocks.owner,
  parseAppliedEngineeringJson: mocks.parseJson,
  requireAppliedEngineeringEligibility: mocks.eligibility
}));
vi.mock("@/server/rate-limit/shared-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rate-limit/shared-guard")>();
  return {
    ...actual,
    getSharedGuard: () => ({ acquire: mocks.acquire })
  };
});

import { POST as confirm } from "./confirm/handler";
import { POST as prepare } from "./prepare/handler";
import { POST as startAssessment } from "./assessment/start/handler";

const FOCUS_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

describe("Applied Engineering representative API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseJson.mockImplementation((request: NextRequest) => request.json());
    mocks.eligibility.mockResolvedValue({ available: true });
    mocks.apiError.mockImplementation((error: unknown) =>
      Response.json({ error: error instanceof Error ? error.message : "unknown" }, { status: 500 })
    );
  });

  it("confirms through the persistence-owning preparation service", async () => {
    const confirmFocus = vi.fn().mockResolvedValue({ id: FOCUS_ID, revision: 1 });
    const rawFocusConfirm = vi.fn();
    const app = {
      config: { nodeEnv: "test" },
      appliedEngineeringPreparationService: { confirm: confirmFocus },
      appliedEngineeringFocusService: { confirm: rawFocusConfirm }
    };
    mocks.owner.mockResolvedValue({ ownerId: "owner-1", app, profile: { targetRole: "backend" } });
    const request = post("/confirm", { language: "javascript" });

    const response = await confirm(request);

    expect(response.status).toBe(200);
    expect(confirmFocus).toHaveBeenCalledWith("owner-1", { language: "javascript" });
    expect(rawFocusConfirm).not.toHaveBeenCalled();
    expect(mocks.eligibility).toHaveBeenCalledWith(app, { targetRole: "backend" });
    await expect(response.json()).resolves.toMatchObject({
      data: { focus: { id: FOCUS_ID, revision: 1 } }
    });
  });

  it("prepares under the owner-wide 300-second distributed lease and releases it", async () => {
    const release = vi.fn();
    mocks.acquire.mockResolvedValue({ release });
    const prepareBlock = vi.fn().mockResolvedValue({ replayed: false, block: { id: "block-1" } });
    const app = {
      config: { nodeEnv: "test" },
      appliedEngineeringPreparationService: { prepare: prepareBlock }
    };
    mocks.owner.mockResolvedValue({ ownerId: "owner-1", app, profile: { targetRole: "backend" } });
    const request = post("/prepare", { requestId: REQUEST_ID, focusRevisionId: FOCUS_ID });

    const response = await prepare(request);

    expect(response.status).toBe(200);
    expect(mocks.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "applied-engineering-prepare",
        ttlMs: 300_000,
        code: "APPLIED_ENGINEERING_PREPARATION_IN_PROGRESS"
      }),
      "owner-1"
    );
    expect(prepareBlock).toHaveBeenCalledWith("owner-1", {
      requestId: REQUEST_ID,
      focusRevisionId: FOCUS_ID
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it("passes the explicit development-only early-start flag to assessment start", async () => {
    const release = vi.fn();
    mocks.acquire.mockResolvedValue({ release });
    const start = vi.fn().mockResolvedValue({ id: ASSESSMENT_ID, status: "IN_PROGRESS" });
    const app = {
      config: { nodeEnv: "development" },
      appliedEngineeringAssessmentService: { start }
    };
    mocks.owner.mockResolvedValue({ ownerId: "owner-1", app, profile: {} });
    const request = post("/assessment/start", {
      assessmentId: ASSESSMENT_ID,
      requestId: REQUEST_ID
    });

    const response = await startAssessment(request);

    expect(response.status).toBe(200);
    expect(start).toHaveBeenCalledWith(
      "owner-1",
      { assessmentId: ASSESSMENT_ID, requestId: REQUEST_ID },
      { allowLocked: true }
    );
    expect(mocks.acquire).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "applied-engineering-assessment-start" }),
      `owner-1:${ASSESSMENT_ID}`
    );
    expect(release).toHaveBeenCalledOnce();
  });
});

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/practice/applied-engineering${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}
