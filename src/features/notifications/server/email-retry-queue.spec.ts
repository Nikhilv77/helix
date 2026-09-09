import { send } from "@vercel/queue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTIFICATION_EMAIL_RETRY_TOPIC,
  VercelEmailRetryScheduler
} from "./email-retry-queue";

vi.mock("@vercel/queue", () => ({ send: vi.fn() }));

describe("VercelEmailRetryScheduler", () => {
  beforeEach(() => {
    vi.mocked(send).mockReset().mockResolvedValue({ messageId: "message-1" });
  });

  it("publishes a delayed, attempt-idempotent retry message", async () => {
    await new VercelEmailRetryScheduler().schedule(
      "00000000-0000-4000-8000-000000000001",
      3,
      5 * 60_000
    );

    expect(send).toHaveBeenCalledWith(
      NOTIFICATION_EMAIL_RETRY_TOPIC,
      {
        version: 1,
        notificationId: "00000000-0000-4000-8000-000000000001"
      },
      {
        delaySeconds: 300,
        retentionSeconds: 2 * 60 * 60,
        idempotencyKey:
          "notification-email-retry:00000000-0000-4000-8000-000000000001:3"
      }
    );
  });
});
