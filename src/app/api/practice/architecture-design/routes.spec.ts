import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  apiError: vi.fn(),
  eligibility: vi.fn(),
  owner: vi.fn(),
  parseJson: vi.fn()
}));

vi.mock("@/app/api/practice/architecture-design/_shared", () => ({
  apiError: mocks.apiError,
  architectureDesignOwner: mocks.owner,
  parseArchitectureDesignJson: mocks.parseJson,
  requireArchitectureDesignEligibility: mocks.eligibility
}));
vi.mock("@/server/rate-limit/shared-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rate-limit/shared-guard")>();
  return {
    ...actual,
    getSharedGuard: () => ({ acquire: mocks.acquire })
  };
});

import { POST as startAssessment } from "./assessment/start/route";
import { POST as confirm } from "./confirm/route";
import { POST as prepare } from "./prepare/route";

const FOCUS_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

describe("Architecture & Design representative API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseJson.mockImplementation((request: NextRequest) => request.json());
    mocks.eligibility.mockResolvedValue({ available: true });
    mocks.apiError.mockImplementation((error: unknown) =>
      Response.json({ error: error instanceof Error ? error.message : "unknown" }, { status: 500 })
    );
  });

  it("confirms only the server-owned role-aligned path through preparation", async () => {
    const confirmFocus = vi.fn().mockResolvedValue({ id: FOCUS_ID, revision: 1 });
    const app = {
      config: { nodeEnv: "test" },
      architectureDesign: { preparation: { confirm: confirmFocus } }
    };
    mocks.owner.mockResolvedValue({ ownerId: "owner-1", app, profile: { targetRole: "backend" } });

    const response = await confirm(post("/confirm", { path: "role-aligned" }));

    expect(response.status).toBe(200);
    expect(confirmFocus).toHaveBeenCalledWith("owner-1", { path: "role-aligned" });
    expect(mocks.eligibility).toHaveBeenCalledWith(app, { targetRole: "backend" });
    await expect(response.json()).resolves.toMatchObject({
      data: { focus: { id: FOCUS_ID, revision: 1 } }
    });
  });

  it("prepares under an owner-wide 300-second lease and releases it", async () => {
    const release = vi.fn();
    mocks.acquire.mockResolvedValue({ release });
    const prepareBlock = vi.fn().mockResolvedValue({ replayed: false, block: { id: "block-1" } });
    const app = {
      config: { nodeEnv: "test" },
      architectureDesign: { preparation: { prepare: prepareBlock } }
    };
    mocks.owner.mockResolvedValue({ ownerId: "owner-1", app, profile: { targetRole: "backend" } });

    const response = await prepare(
      post("/prepare", { requestId: REQUEST_ID, focusRevisionId: FOCUS_ID })
    );

    expect(response.status).toBe(200);
    expect(mocks.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "architecture-design-prepare",
        ttlMs: 300_000,
        code: "ARCHITECTURE_DESIGN_PREPARATION_IN_PROGRESS"
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
      architectureDesign: { assessment: { start } }
    };
    mocks.owner.mockResolvedValue({ ownerId: "owner-1", app, profile: {} });

    const response = await startAssessment(
      post("/assessment/start", { assessmentId: ASSESSMENT_ID, requestId: REQUEST_ID })
    );

    expect(response.status).toBe(200);
    expect(start).toHaveBeenCalledWith(
      "owner-1",
      { assessmentId: ASSESSMENT_ID, requestId: REQUEST_ID },
      { allowLocked: true }
    );
    expect(mocks.acquire).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "architecture-design-assessment-start" }),
      `owner-1:${ASSESSMENT_ID}`
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not expose an executable run route", () => {
    expect(
      existsSync(resolve(process.cwd(), "src/app/api/practice/architecture-design/run/route.ts"))
    ).toBe(false);
  });
});

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/practice/architecture-design${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}
