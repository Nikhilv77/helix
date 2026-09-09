import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchDaily: vi.fn(),
  secret: "1234567890abcdef",
  expireStaleAndReport: vi.fn(),
  reconcileStale: vi.fn(),
  dispatch: vi.fn(),
  purgeAllExpiredHelpRequestNotifications: vi.fn(),
  retryPending: vi.fn()
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { cronSecret: mocks.secret },
    teacherNotificationService: { dispatchDaily: mocks.dispatchDaily },
    helpRequestService: { expireStaleAndReport: mocks.expireStaleAndReport },
    helpSessionService: { reconcileStale: mocks.reconcileStale },
    notificationService: {
      purgeAllExpiredHelpRequestNotifications: mocks.purgeAllExpiredHelpRequestNotifications
    },
    notificationDispatcher: {
      dispatch: mocks.dispatch,
      retryPending: mocks.retryPending
    }
  })
}));

import { GET } from "./route";

describe("GET /api/cron/teacher-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dispatchDaily.mockResolvedValue({ candidates: 2, recorded: 3, failed: 0 });
    mocks.expireStaleAndReport.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        learnerId: "learner-1",
        questionSlug: "contains-duplicate"
      }
    ]);
    mocks.reconcileStale.mockResolvedValue([]);
    mocks.dispatch.mockResolvedValue({ recorded: true, emailed: false });
    mocks.purgeAllExpiredHelpRequestNotifications.mockResolvedValue(4);
    mocks.retryPending.mockResolvedValue({ attempted: 1, emailed: 1 });
  });

  it("rejects calls without the scheduler bearer token", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.dispatchDaily).not.toHaveBeenCalled();
    expect(mocks.expireStaleAndReport).not.toHaveBeenCalled();
  });

  it("runs teacher notifications and global maintenance in one daily function", async () => {
    const response = await GET(request(`Bearer ${mocks.secret}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        teacherNotifications: { candidates: 2, recorded: 3, failed: 0 },
        maintenance: {
          expiredRequests: 1,
          reconciledSessions: 0,
          lifecycleNotifications: 1,
          failedLifecycleNotifications: 0,
          purgedInvitations: 4,
          emailRetry: { attempted: 1, emailed: 1 }
        }
      }
    });
    expect(mocks.dispatchDaily).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "learner-1",
        kind: "HELP_REQUEST_EXPIRED",
        subjectId: "00000000-0000-4000-8000-000000000001"
      })
    );
  });
});

function request(authorization?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/teacher-notifications", {
    headers: authorization ? { authorization } : undefined
  });
}
