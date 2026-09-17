import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_SYSTEM_DESIGN_CANVAS } from "@/features/interviews/domain/system-design-canvas";
import { DesignCanvasVersionConflictError } from "@/features/interviews/server/session-store";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  getCanvas: vi.fn(),
  saveCanvas: vi.fn(),
  enforce: vi.fn()
}));

vi.mock("@/features/interviews/server/session-access", () => ({
  authorizeInterviewSession: mocks.authorize
}));
vi.mock("@/server/rate-limit/shared-guard", () => ({
  RATE_LIMIT_POLICIES: { practiceState: { namespace: "test" } },
  getSharedGuard: () => ({ enforce: mocks.enforce })
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    interviewService: {
      getSystemDesignCanvas: mocks.getCanvas,
      saveSystemDesignCanvas: mocks.saveCanvas
    }
  })
}));

import { GET, PUT } from "./route";

describe("system-design canvas API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ kind: "owner", ownerId: "user-1" });
    mocks.getCanvas.mockResolvedValue({
      document: EMPTY_SYSTEM_DESIGN_CANVAS,
      revision: 0,
      updatedAt: 1
    });
    mocks.saveCanvas.mockResolvedValue({
      document: { ...EMPTY_SYSTEM_DESIGN_CANVAS, notes: "99.9% availability" },
      revision: 1,
      updatedAt: 2
    });
  });

  it("loads and owner-scopes the durable diagram", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/interview/${SESSION_ID}/design-canvas`),
      { params: { sessionId: SESSION_ID } }
    );

    expect(response.status).toBe(200);
    expect(mocks.getCanvas).toHaveBeenCalledWith("user-1", SESSION_ID);
    expect((await response.json()).data.revision).toBe(0);
  });

  it("validates and saves an expected canvas revision", async () => {
    const document = { ...EMPTY_SYSTEM_DESIGN_CANVAS, notes: "99.9% availability" };
    const response = await PUT(
      new NextRequest(`http://localhost/api/interview/${SESSION_ID}/design-canvas`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: 0, document })
      }),
      { params: { sessionId: SESSION_ID } }
    );

    expect(response.status).toBe(200);
    expect(mocks.enforce).toHaveBeenCalled();
    expect(mocks.saveCanvas).toHaveBeenCalledWith("user-1", SESSION_ID, document, 0);
  });

  it("returns the authoritative document on an optimistic-write conflict", async () => {
    const current = {
      document: { ...EMPTY_SYSTEM_DESIGN_CANVAS, notes: "newer tab" },
      revision: 4,
      updatedAt: 4
    };
    mocks.saveCanvas.mockRejectedValue(new DesignCanvasVersionConflictError(SESSION_ID, current));
    const response = await PUT(
      new NextRequest(`http://localhost/api/interview/${SESSION_ID}/design-canvas`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: 3, document: EMPTY_SYSTEM_DESIGN_CANVAS })
      }),
      { params: { sessionId: SESSION_ID } }
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toMatchObject({
      code: "DESIGN_CANVAS_VERSION_CONFLICT",
      details: { current: { revision: 4 } }
    });
  });
});
