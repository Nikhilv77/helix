import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  secret: "1234567890abcdef",
  expireStaleAndReport: vi.fn(),
  reconcileStale: vi.fn(),
  dispatch: vi.fn(),
  purgeAllExpiredHelpRequestNotifications: vi.fn(),
  retryPending: vi.fn(),
  runEvaluationRecovery: vi.fn(),
  enforceInterviewRetention: vi.fn(),
  recoverDirtySnapshots: vi.fn()
}));

vi.mock("@/features/analytics/server/recover-dirty-snapshots", () => ({
  recoverDirtySnapshots: mocks.recoverDirtySnapshots
}));

vi.mock("@/server/app-container", () => ({
  getAppContainer: () => ({
    config: { cronSecret: mocks.secret },
    interviewEvaluationRecoveryService: { runBatch: mocks.runEvaluationRecovery },
    interviewOperationsService: { enforceRetention: mocks.enforceInterviewRetention },
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

describe("GET /api/cron/maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.runEvaluationRecovery.mockResolvedValue({
      claimed: 2,
      recovered: 1,
      superseded: 0,
      retried: 1,
      deadLettered: 0
    });
    mocks.enforceInterviewRetention.mockResolvedValue({
      cutoff: {
        authenticatedBefore: "2025-09-14T00:00:00.000Z",
        anonymousBefore: "2026-08-15T00:00:00.000Z",
        operationalBefore: "2026-08-15T00:00:00.000Z"
      },
      deleted: {
        authenticatedSessions: 1,
        anonymousSessions: 2,
        terminalAnswerRequests: 3,
        terminalEvaluationJobs: 4
      },
      batchLimit: 250,
      batchSaturated: false
    });
    mocks.recoverDirtySnapshots.mockResolvedValue({ attempted: 0, failed: 0 });
  });

  it("rejects calls without the scheduler bearer token", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.expireStaleAndReport).not.toHaveBeenCalled();
  });

  it("runs global help and interview maintenance in one daily function", async () => {
    const response = await GET(request(`Bearer ${mocks.secret}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        maintenance: {
          expiredRequests: 1,
          reconciledSessions: 0,
          lifecycleNotifications: 1,
          failedLifecycleNotifications: 0,
          purgedInvitations: 4,
          emailRetry: { attempted: 1, emailed: 1 }
        },
        interviewEvaluations: {
          claimed: 2,
          recovered: 1,
          superseded: 0,
          retried: 1,
          deadLettered: 0
        },
        interviewRetention: {
          cutoff: {
            authenticatedBefore: "2025-09-14T00:00:00.000Z",
            anonymousBefore: "2026-08-15T00:00:00.000Z",
            operationalBefore: "2026-08-15T00:00:00.000Z"
          },
          deleted: {
            authenticatedSessions: 1,
            anonymousSessions: 2,
            terminalAnswerRequests: 3,
            terminalEvaluationJobs: 4
          },
          batchLimit: 250,
          batchSaturated: false
        },
        snapshotRecovery: { attempted: 0, failed: 0 }
      }
    });
    expect(mocks.enforceInterviewRetention).toHaveBeenCalledTimes(1);
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
  return new NextRequest("http://localhost/api/cron/maintenance", {
    headers: authorization ? { authorization } : undefined
  });
}
