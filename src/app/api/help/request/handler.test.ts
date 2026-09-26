import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemorySharedGuardBackend, SharedGuard } from "@/server/rate-limit/shared-guard";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findHelpers: vi.fn(),
  open: vi.fn(),
  participant: vi.fn(),
  deliver: vi.fn(),
  guard: { current: null as unknown }
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn()
}));
vi.mock("@/features/interviews/server/owner", () => ({ authenticatedOwnerId: () => "owner-1" }));
vi.mock("@/features/analytics/server/refresh-candidate-analytics", () => ({
  scheduleCandidateAnalyticsRefresh: vi.fn()
}));
vi.mock("@/features/peer-help/server/help-maintenance", () => ({
  reconcileHelpForOwnerBestEffort: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/server/rate-limit/shared-guard", async (original) => ({
  ...(await original<typeof import("@/server/rate-limit/shared-guard")>()),
  getSharedGuard: () => mocks.guard.current
}));
vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: {},
    helperMatchingService: { findHelpers: mocks.findHelpers },
    helpRequestService: { open: mocks.open, cancel: vi.fn() },
    helpHistoryService: { participant: mocks.participant },
    notificationService: { deliverHelpRequestInvitations: mocks.deliver },
    stuckSummaryService: { summarize: vi.fn() }
  })
}));

import { MAX_HELP_INVITATIONS, POST } from "./handler";

describe("POST /api/help/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guard.current = new SharedGuard(new MemorySharedGuardBackend());
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    mocks.participant.mockResolvedValue({ label: "Asha" });
    mocks.open.mockResolvedValue({ id: "request-1", status: "OPEN", createdAt: new Date() });
    mocks.deliver.mockResolvedValue(2);
  });

  it("does not spend the ten-minute quota when nobody is available", async () => {
    mocks.findHelpers.mockResolvedValueOnce([]);
    const empty = await POST(request());
    expect(empty.status).toBe(409);

    mocks.findHelpers.mockResolvedValueOnce([{ ownerId: "helper-1" }, { ownerId: "helper-2" }]);
    const sent = await POST(request());

    expect(sent.status).toBe(200);
    expect((await sent.json()).data.invitationsSent).toBe(2);
  });

  it("invites every eligible mate while there are fewer than the cap", async () => {
    mocks.findHelpers.mockResolvedValue(
      Array.from({ length: 3 }, (_, index) => ({ ownerId: `helper-${index + 1}` }))
    );

    expect((await POST(request())).status).toBe(200);

    expect(mocks.deliver.mock.calls[0]![0]).toEqual(["helper-1", "helper-2", "helper-3"]);
  });

  it("invites only the best-ranked mates once more are eligible than the cap", async () => {
    mocks.findHelpers.mockResolvedValue(
      Array.from({ length: MAX_HELP_INVITATIONS + 50 }, (_, index) => ({
        ownerId: `helper-${index + 1}`
      }))
    );

    expect((await POST(request())).status).toBe(200);

    const invited = mocks.deliver.mock.calls[0]![0] as string[];
    expect(invited).toHaveLength(MAX_HELP_INVITATIONS);
    expect(invited[0]).toBe("helper-1");
    expect(invited.at(-1)).toBe(`helper-${MAX_HELP_INVITATIONS}`);
  });

  it("allows one routed request per ten minutes", async () => {
    mocks.findHelpers.mockResolvedValue([{ ownerId: "helper-1" }]);

    expect((await POST(request())).status).toBe(200);
    const second = await POST(request());

    expect(second.status).toBe(429);
    expect(mocks.open).toHaveBeenCalledOnce();
  });

  it("bounds how often availability can be checked", async () => {
    mocks.findHelpers.mockResolvedValue([]);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) statuses.push((await POST(request())).status);

    expect(statuses.slice(0, 6)).toEqual([409, 409, 409, 409, 409, 409]);
    expect(statuses[6]).toBe(429);
    expect(mocks.findHelpers).toHaveBeenCalledTimes(6);
  });
});

function request(): NextRequest {
  return new NextRequest("http://localhost/api/help/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: "two-sum", language: "javascript", code: "return [0, 1];" })
  });
}
