import { describe, expect, it, vi } from "vitest";

import { NotificationKind } from "@/features/notifications/server/notification.service";
import { reconcileHelpForOwner, reconcileHelpForOwnerBestEffort } from "./help-maintenance";

describe("owner-driven help maintenance", () => {
  it("repairs only the owner and emits idempotent lifecycle notifications", async () => {
    const expireStaleForLearner = vi
      .fn()
      .mockResolvedValue([
        { id: "request-1", learnerId: "learner-1", questionSlug: "contains-duplicate" }
      ]);
    const reconcileStaleForOwner = vi
      .fn()
      .mockResolvedValue([{ id: "request-2", learnerId: "learner-1", questionSlug: "lru-cache" }]);
    const dispatch = vi.fn().mockResolvedValue({ recorded: true, emailed: false });

    await expect(
      reconcileHelpForOwner(
        {
          helpRequestService: { expireStaleForLearner },
          helpSessionService: { reconcileStaleForOwner },
          notificationDispatcher: { dispatch }
        },
        "learner-1"
      )
    ).resolves.toEqual({
      expiredRequests: 1,
      reconciledSessions: 1,
      failedNotifications: 0
    });
    expect(expireStaleForLearner).toHaveBeenCalledWith("learner-1");
    expect(reconcileStaleForOwner).toHaveBeenCalledWith("learner-1");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: NotificationKind.HELP_REQUEST_EXPIRED,
        subjectId: "request-1"
      })
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: NotificationKind.HELP_REQUEST_RESOLVED,
        subjectId: "request-2"
      })
    );
  });

  it("does not fail a user request when opportunistic maintenance fails", async () => {
    const app = {
      helpRequestService: {
        expireStaleForLearner: vi.fn().mockRejectedValue(new Error("database unavailable"))
      },
      helpSessionService: { reconcileStaleForOwner: vi.fn().mockResolvedValue([]) },
      notificationDispatcher: { dispatch: vi.fn() }
    };

    await expect(reconcileHelpForOwnerBestEffort(app, "learner-1")).resolves.toBeNull();
  });
});
